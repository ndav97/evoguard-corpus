// Linaje del estrato semi-real: Vn parte de la imagen V0 de la familia más los parches ACEPTADOS de V1..Vn−1
// (generados por modelos, no las referencias de calibración). Cada paso produce un commit determinista cuyo hash
// debe coincidir con el registrado; si no, la historia no es reproducible y el workspace no se abre.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { auditPatch } from '../sandbox/lineage.mjs';
import { REAL_VERSIONS } from './families.mjs';
import { execReal } from './docker.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');

export function loadRealReference(referencesDir, version) {
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

// Pasos para abrir el workspace de `version` (through: incluye la propia referencia; auditoría).
export function realSteps(version, referencesDir, { through = false } = {}) {
  const index = REAL_VERSIONS.indexOf(version);
  if (index < 0) throw new Error(`Versión semi-real desconocida: ${version}`);
  return REAL_VERSIONS.slice(0, index + (through ? 1 : 0)).map(v => {
    const { reference, patch } = loadRealReference(referencesDir, v);
    auditPatch(patch, `reference ${v}`);
    return { version: v, patch, message: `reference: ${v}`, expect: reference.candidate_commit, base: reference.base_commit };
  });
}

const COMMIT = `const {execFileSync}=require('node:child_process');
const env={...process.env,GIT_AUTHOR_NAME:'EvoGuard Pipeline',GIT_AUTHOR_EMAIL:'pipeline@evoguard.invalid',GIT_COMMITTER_NAME:'EvoGuard Pipeline',GIT_COMMITTER_EMAIL:'pipeline@evoguard.invalid',GIT_AUTHOR_DATE:'2000-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2000-01-01T00:00:00Z'};
const patch=require('node:fs').readFileSync(0);
// Las capas de la imagen cambian los metadatos de los archivos: se refresca el índice antes de aplicar.
try{execFileSync('git',['update-index','-q','--refresh'],{env});}catch{}
if(patch.length) execFileSync('git',['apply','--index','--binary','--whitespace=nowarn','-'],{env,input:patch});
execFileSync('git',['-c','core.hooksPath=/dev/null','commit','--no-verify','--allow-empty','-q','-m',process.argv[1]],{env});
process.stdout.write(execFileSync('git',['rev-parse','HEAD'],{env,encoding:'utf8'}).trim());`;

// Aplica los pasos en un contenedor ya abierto y comprueba cada hash. Devuelve el commit final.
export function applySteps(session, steps, { v0Commit } = {}) {
  // Índice al día con el árbol de la imagen (las capas alteran mtime/inode): git del constructor y parches lo necesitan.
  execReal(session, ['sh', '-c', 'git update-index -q --refresh || true']);
  let head = execReal(session, ['git', 'rev-parse', 'HEAD']);
  if (v0Commit && head !== v0Commit) throw new Error(`La imagen no está en el V0 registrado (${head} ≠ ${v0Commit})`);
  for (const step of steps) {
    if (step.base && step.base !== head) throw new Error(`Historia no reproducible antes de ${step.version}: ${head} ≠ ${step.base}`);
    head = execReal(session, ['node', '-e', COMMIT, step.message], { input: step.patch, timeout: 300000 });
    if (step.expect && head !== step.expect) throw new Error(`Historia no reproducible en ${step.version}: ${head} ≠ ${step.expect}`);
  }
  return head;
}
