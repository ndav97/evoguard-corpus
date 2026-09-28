// Estrato semi-real: familias families-real/Sxxx-slug/ (base V0 real + cambios T001–T003 redactados por el equipo).
// Carga, validación y paquete de turno. El paquete solo contiene lo que ve el constructor: la petición del turno,
// la zona del cambio y los comandos visibles; nunca tests ocultos, parches de referencia ni el manifiesto.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import Ajv from 'ajv';

export const REAL_ID = /^S\d{3}$/;
export const REAL_VERSIONS = ['V1', 'V2', 'V3'];
export const TURN_OF = { V1: 'T001', V2: 'T002', V3: 'T003' };
const read = path => readFileSync(path, 'utf8');

export function listRealFamilies(root) {
  const base = join(root, 'families-real');
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^S\d{3}-[a-z0-9-]+$/.test(entry.name) && existsSync(join(base, entry.name, 'family.yaml')))
    .map(entry => ({ id: entry.name.slice(0, 4), dir: `families-real/${entry.name}` }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function realFamilyDir(root, id) {
  if (!REAL_ID.test(id)) throw new Error(`Identificador de familia semi-real inválido: ${id}`);
  const found = listRealFamilies(root).filter(f => f.id === id);
  if (found.length !== 1) throw new Error(`Familia ${id} ${found.length ? 'duplicada' : 'no encontrada'} en families-real/`);
  return found[0].dir;
}

export function loadRealFamily(root, id) {
  const dir = realFamilyDir(root, id);
  const manifest = YAML.parse(read(join(root, dir, 'family.yaml')));
  const file = rel => (typeof rel === 'string' && existsSync(join(root, dir, rel)) ? read(join(root, dir, rel)) : null);
  const turns = (manifest.turns ?? []).map(turn => ({ ...turn, requestText: file(turn.request), hiddenTestsText: file(turn.hidden_tests), patchText: file(turn.reference_patch) }));
  return {
    familyId: id, familyDir: dir, manifest, turns,
    policy: JSON.parse(read(join(root, 'config/policy.json'))),
    prompt: read(join(root, 'prompts/real-turn.md'))
  };
}

export const expectedRealPlan = (id, ring) => Object.fromEntries(REAL_VERSIONS.map((version, index) => [version, ring[(Number(id.slice(1)) - 1 + index + 1) % ring.length]]));

// Ruta de un archivo dentro del paquete de la app (package_path relativo a la raíz del repositorio).
export const inPackage = (manifest, rel) => (manifest.package_path === '.' ? rel : `${manifest.package_path}/${rel}`);

// Comandos visibles del constructor (y de las etapas visibles del pipeline), ejecutados en el paquete de la app.
export function visibleChecks(manifest) {
  const tests = manifest.runner === 'vitest'
    ? ['npx', '--no-install', 'vitest', 'run', '--maxWorkers=2']
    : ['npx', '--no-install', 'jest', '--ci', '--maxWorkers=2'];
  const checks = { development_tests: tests };
  if (manifest.checks?.typecheck) checks.typecheck = manifest.checks.typecheck;
  return checks;
}

// Nombres e identificadores que no pueden aparecer en lo que ve el constructor.
const PRIVATE = /(oracle|evoguard|hidden[_ -]?tests?|reference[_ ]patch|spec-lock|calibra|openai|anthropic|gemini|qwen|granite|local_a|local_b|SYNTEROLINK)/i;

export function validateRealFamily(data, root) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const schema = JSON.parse(read(join(root, 'schema/real-family.schema.json')));
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const m = data.manifest;
  if (!validate(m)) return [`real-family: ${JSON.stringify(validate.errors)}`];
  demand(m.id === data.familyId && data.familyDir === `families-real/${m.id}-${m.slug}`, 'Directorio, id y slug no coinciden');
  demand(JSON.stringify(m.turns.map(t => t.id)) === JSON.stringify(['T001', 'T002', 'T003']), 'Turnos T001–T003 incompletos o desordenados');
  demand(JSON.stringify(m.generation.plan) === JSON.stringify(expectedRealPlan(m.id, data.policy.provider_ring)), 'Plan de generación distinto de la rotación por fila');
  demand(m.package_path === '.' || m.focus.startsWith(`${m.package_path}/`), 'focus debe ser relativo a la raíz del repositorio y estar dentro del paquete');
  demand(m.provenance.status === 'CALIBRATED', 'Familia sin calibrar (provenance.status)');
  for (const [index, turn] of data.turns.entries()) {
    const n = index + 1;
    demand(turn.request === `turns/T00${n}.md` && turn.reference_patch === `reference/T00${n}.patch` && turn.hidden_tests.startsWith(`oracle/T00${n}.test.`), `${turn.id}: rutas inesperadas`);
    demand(turn.requestText && turn.requestText.trim().length > 50, `${turn.id}: falta la petición`);
    demand(turn.hiddenTestsText && /\b(it|test)\s*\(/.test(turn.hiddenTestsText), `${turn.id}: faltan tests ocultos`);
    demand(turn.patchText && /^diff --git a\//m.test(turn.patchText), `${turn.id}: falta el parche de referencia`);
    if (turn.requestText) {
      demand(!PRIVATE.test(turn.requestText), `${turn.id}: la petición menciona material privado (${turn.requestText.match(PRIVATE)?.[0]})`);
      for (const later of ['T001', 'T002', 'T003'].slice(n)) demand(!turn.requestText.includes(later), `${turn.id}: la petición menciona un turno futuro`);
    }
    if (turn.patchText) {
      // El parche de referencia es relativo al paquete y no toca tests existentes, dependencias ni configuración.
      const paths = [...turn.patchText.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].flatMap(x => [x[1], x[2]]);
      for (const path of new Set(paths)) demand(!scopeViolation(path), `${turn.id}: el parche de referencia toca ${path}`);
    }
  }
  const refs = REAL_VERSIONS.map(v => m.generation.references[v]);
  demand(refs.every((r, i) => !r || refs.slice(0, i).every(Boolean)), 'Referencias no consecutivas desde V1');
  const count = refs.filter(Boolean).length;
  const needed = { DRAFT: [0, 0], GENERATED: [1, 3], VALIDATED: [3, 3], AUDITED: [3, 3], FROZEN: [3, 3] }[m.generation.status];
  demand(count >= needed[0] && count <= needed[1], `Estado ${m.generation.status} incompatible con ${count} referencias`);
  return errors;
}

// Control de alcance (rutas relativas al paquete): dependencias, lockfiles, configuración de tests/build/lint,
// archivos de CI y rutas peligrosas. Los tests existentes se controlan aparte (no se pueden modificar ni borrar).
export function scopeViolation(path) {
  if (path.startsWith('/') || path.split('/').includes('..')) return 'ruta fuera del repositorio';
  if (/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|\.npmrc|\.yarnrc(\.yml)?|\.nvmrc|\.node-version)$/.test(path)) return 'dependencias o gestor de paquetes';
  if (/(^|\/)(vite|vitest|jest|babel|webpack|tsconfig|eslint|\.eslintrc|prettier|\.prettierrc|playwright|cypress)[^/]*\.(c|m)?(js|ts|json|cjs|mjs)$|(^|\/)(\.babelrc|\.eslintrc|tsconfig\.json|jest\.config\.[a-z]+|setupTests\.[jt]sx?)$/.test(path)) return 'configuración de tests, build o lint';
  if (/(^|\/)(node_modules|\.git|\.github|dist|build|coverage)\//.test(path)) return 'directorio no permitido';
  return null;
}

export function makeRealPacket(data, version) {
  if (!REAL_VERSIONS.includes(version)) throw new Error('versión no admitida (semi-real: V1–V3)');
  const turn = data.turns.find(t => t.id === TURN_OF[version]);
  if (!turn?.requestText) throw new Error(`Falta la petición de ${TURN_OF[version]}`);
  const m = data.manifest;
  return {
    family_id: m.id, stratum: 'semi-real', version,
    prompt: data.prompt,
    request: turn.requestText,
    repository: { package_path: m.package_path, focus: m.focus, test_runner: m.runner, package_manager: m.package_manager },
    checks: Object.fromEntries(Object.entries(visibleChecks(m)).map(([name, argv]) => [name, `(en ${m.package_path}) ${argv.join(' ')}`]))
  };
}

export function validateAllReal(root) {
  return Object.fromEntries(listRealFamilies(root).map(({ id }) => {
    try { return [id, validateRealFamily(loadRealFamily(root, id), root)]; }
    catch (error) { return [id, [error.message]]; }
  }));
}
