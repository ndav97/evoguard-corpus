// Exportación auditada de historia para evolución (V1–V3).
// El workspace de Vn se reconstruye desde las referencias validadas: scaffold V0 (con el TASK.json que recibió V0),
// y por cada versión previa Vk: commit "task: Vk" (k>0) y commit "reference: Vk" aplicando su parche.
// Cada hash debe coincidir con el registrado; si no, la historia no es reproducible y no se abre el workspace.
// Solo viaja historia ya ocurrida: ningún requisito futuro, oráculo, procedencia ni métrica.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { seedFiles } from './policy.mjs';
import { loadCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';

export const VERSIONS = ['V0', 'V1', 'V2', 'V3'];
const sha = text => createHash('sha256').update(text).digest('hex');
const SECRET = /((?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{16,}|(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|SYNTEROLINK_[A-Z_]*KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY)/;
const FORBIDDEN_PATH = /^(TASK\.json|fixtures\/|node_modules\/|dist\/|coverage\/|\.git\/|\.env)|(^|\/)\.\.(\/|$)/;

// Rechaza parches que tocan archivos del pipeline, rutas peligrosas, secretos o tamaños excesivos.
export function auditPatch(patch, label = 'parche') {
  const problems = [];
  // Un parche vacío es válido: la versión se aceptó sin cambios de código (commit vacío reproducible).
  if (typeof patch !== 'string') problems.push('no textual');
  else if (patch.length) {
    if (Buffer.byteLength(patch) > 4 * 1024 * 1024) problems.push('mayor de 4 MiB');
    const paths = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].flatMap(m => [m[1], m[2]]);
    if (!paths.length) problems.push('sin cabeceras diff --git');
    for (const path of new Set(paths)) if (FORBIDDEN_PATH.test(path) || path.startsWith('/')) problems.push(`ruta no permitida: ${path}`);
    if (SECRET.test(patch)) problems.push('posible secreto');
    if (/^(new|deleted) file mode 120000|^new mode 120000/m.test(patch)) problems.push('enlace simbólico');
  }
  if (problems.length) throw new Error(`Exportación rechazada (${label}): ${problems.join('; ')}`);
  return true;
}

export function loadReference(referencesDir, version) {
  const dir = join(referencesDir, version);
  if (!existsSync(join(dir, 'reference.json'))) throw new Error(`Falta la referencia validada ${version}`);
  const reference = JSON.parse(readFileSync(join(dir, 'reference.json'), 'utf8'));
  const patch = readFileSync(join(dir, 'reference.patch'), 'utf8');
  const task = readFileSync(join(dir, 'task.json'), 'utf8');
  if (sha(patch) !== reference.patch_sha256) throw new Error(`Parche de ${version} alterado`);
  if (sha(task) !== reference.task_packet_sha256) throw new Error(`Tarea de ${version} alterada`);
  if (reference.version !== version || !/^[a-f0-9]{40}$/.test(reference.base_commit ?? '') || !/^[a-f0-9]{40}$/.test(reference.candidate_commit ?? '')) throw new Error(`Referencia ${version} incompleta`);
  return { reference, patch, task };
}

// Seed para abrir el workspace de `version` (V0 devuelve el scaffold sin pasos).
// through: true reconstruye hasta la referencia de `version` inclusive, sin tarea siguiente (auditoría).
export function evolutionSeed(root, version, referencesDir, { through = false, familyId = 'F001' } = {}) {
  const index = VERSIONS.indexOf(version);
  if (index < 0) throw new Error(`Versión desconocida: ${version}`);
  const files = seedFiles(root, 'V0', familyId);
  if (index === 0 && !through) return { files, steps: [] };
  const previous = VERSIONS.slice(0, index + (through ? 1 : 0)).map(v => ({ version: v, ...loadReference(referencesDir, v) }));
  // La base debe ser exactamente la que recibió V0 (su TASK.json histórico).
  files['TASK.json'] = previous[0].task;
  const steps = [{ type: 'expect', expect: previous[0].reference.base_commit }];
  for (const [k, item] of previous.entries()) {
    if (k > 0) steps.push({ type: 'task', content: item.task, message: `task: ${item.version}`, expect: item.reference.base_commit });
    auditPatch(item.patch, `reference ${item.version}`);
    steps.push({ type: 'patch', patch: item.patch, message: `reference: ${item.version}`, expect: item.reference.candidate_commit });
  }
  if (through) return { files, steps, task: previous.at(-1).task };
  const data = loadCorpus(root, familyId);
  const current = JSON.stringify(makePacket(data, version), null, 2) + '\n';
  steps.push({ type: 'task', content: current, message: `task: ${version}` });
  return { files, steps, task: current };
}
