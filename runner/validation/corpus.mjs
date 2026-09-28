import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { specHash } from '../oracle/spec.mjs';
import Ajv from 'ajv';

import { listFamilies, familyDir, expectedPlan } from '../families.mjs';
import { FAMILY_ORACLES } from '../oracle/families/index.mjs';

// Compatibilidad: ruta de F001. El resto del código usa familyDir(root, id).
export const FAMILY_PATH = 'families/F001-product-catalog';
export const read = path => YAML.parse(readFileSync(path, 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const yamlFiles = path => existsSync(path) ? readdirSync(path).filter(p => p.endsWith('.yaml')).sort() : [];
const PROMPTS = ['common', 'evolve-turn', 'repair'];

// Carga una familia. Prompts: comunes en prompts/ y propios de la familia en <familia>/prompts/
// (architecture.md: restricciones de arquitectura del perfil estructural; generate-v0.md: encargo de V0).
export function loadCorpus(root, familyId = 'F001') {
  const dir = familyDir(root, familyId);
  const familyRoot = join(root, dir);
  const family = read(join(familyRoot, 'family.yaml'));
  const requirementFiles = yamlFiles(join(familyRoot, 'requirements'));
  const turnFiles = yamlFiles(join(familyRoot, 'turns'));
  const fixturePath = family.fixture?.path;
  const fixture = typeof fixturePath === 'string' && /^fixtures\/[a-z0-9-]+\.json$/.test(fixturePath) ? read(join(familyRoot, fixturePath)) : null;
  const oracleDir = join(root, 'oracle', familyId);
  return {
    familyId, familyDir: dir,
    family,
    provenance: read(join(familyRoot, 'provenance.yaml')),
    fixture,
    // F001: alias histórico del fixture (mismo objeto).
    ...(familyId === 'F001' ? { products: fixture } : {}),
    requirements: requirementFiles.map(p => read(join(familyRoot, 'requirements', p))),
    turns: turnFiles.map(p => read(join(familyRoot, 'turns', p))),
    requirementFiles, turnFiles,
    oracleCases: yamlFiles(oracleDir).map(p => read(join(oracleDir, p))),
    oracleFiles: yamlFiles(oracleDir),
    policy: read(join(root, 'config/policy.json')),
    stack: read(join(root, 'config/stack.json')),
    prompts: {
      ...Object.fromEntries(PROMPTS.map(p => [p, readFileSync(join(root, 'prompts', `${p}.md`), 'utf8')])),
      architecture: readFileSync(join(familyRoot, 'prompts/architecture.md'), 'utf8'),
      'generate-v0': readFileSync(join(familyRoot, 'prompts/generate-v0.md'), 'utf8')
    }
  };
}

export const loadAllCorpora = root => listFamilies(root).map(f => loadCorpus(root, f.id));

export function schemaValidators(root) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  const validators = Object.fromEntries(readdirSync(join(root, 'schema')).filter(p => p.endsWith('.schema.json')).map(p => [p.replace('.schema.json',''), ajv.compile(read(join(root,'schema',p)))]));
  // Esquemas de fixture declarados por los módulos de oráculo de cada familia (clave fixture:Fxxx).
  for (const [id, oracle] of Object.entries(FAMILY_ORACLES)) {
    validators[`fixture:${id}`] = typeof oracle.FIXTURE_SCHEMA === 'string' ? validators[oracle.FIXTURE_SCHEMA] : new Ajv({ allErrors: true, strict: true }).compile(oracle.FIXTURE_SCHEMA);
  }
  return validators;
}

export function validateRecord(record, kind, validators) {
  const errors = [];
  const validate = validators[kind];
  if (!validate(record)) return [`${kind}: ${JSON.stringify(validate.errors)}`];
  if (kind === 'generation') {
    if (record.repair_count !== record.attempt - 1) errors.push('generation: repair_count no corresponde al intento');
    if (record.outcome === 'ACCEPTED' && (Object.values(record.validation).some(x => x !== 'PASS') || !record.candidate_commit || !record.finished_at)) errors.push('generation: ACCEPTED requiere comprobaciones PASS, commit y finalización');
    if (record.validation.independent_oracle === 'FAIL' && record.outcome !== 'REASSIGN') errors.push('generation: fallo de oráculo exige REASSIGN');
    if (record.outcome === 'REPAIR' && (record.attempt === 3 || record.validation.independent_oracle !== 'NOT_RUN')) errors.push('generation: reparación inválida');
  }
  if (kind === 'run') {
    const seen = new Set();
    for (const outcome of record.outcomes) {
      if (seen.has(outcome.requirement_id)) errors.push('run: requisito repetido');
      seen.add(outcome.requirement_id);
      const eligible = record.previous_active_requirements.includes(outcome.requirement_id) && outcome.previous_result === 'PASS' && ['PASS','FAIL'].includes(outcome.current_result) && !record.infrastructure_error;
      const expected = eligible ? outcome.current_result === 'FAIL' : null;
      if (outcome.regression !== expected) errors.push('run: etiqueta de regresión inválida');
    }
    if (record.previous_active_requirements.some(id => !seen.has(id))) errors.push('run: faltan resultados de requisitos previamente activos');
  }
  return errors;
}


export function validateCorpus(data, root) {
  const errors = [];
  const validators = schemaValidators(root);
  const id = data.familyId ?? data.family?.family_id;
  const oracle = FAMILY_ORACLES[id];
  if (!oracle) return [`${id}: falta módulo de oráculo runner/oracle/families/${id}/index.mjs`];
  const check = (kind, value, label = kind) => {
    const validator = validators[kind];
    if (!validator(value)) errors.push(`${label}: ${JSON.stringify(validator.errors)}`);
  };
  check('family', data.family); check('provenance', data.provenance); check(`fixture:${id}`, data.fixture, id === 'F001' ? 'products' : 'fixture');
  data.requirements.forEach(r => check('requirement', r));
  data.turns.forEach(t => check('turn', t));
  data.oracleCases.forEach(c => check('oracle-case', c));
  check('policy', data.policy); check('stack', data.stack);
  if (errors.length) return errors;
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const equal = (a,b,message) => demand(isDeepStrictEqual(a,b), message);
  const {family:f, provenance:p, requirements:rs, turns:ts} = data;
  const dir = data.familyDir;
  const reqIds = ['R001','R002','R003','R004','R005'];
  demand(f.family_id === id && p.family_id === id, 'Familia/procedencia inválida');
  demand(dir === `families/${id}-${f.slug}`, `Directorio ${dir} no coincide con family_id y slug`);
  equal(rs.map(r=>r.id), reqIds, 'Requisitos R001–R005 completos, únicos y ordenados');
  equal(ts.map(t=>t.id), ['T001','T002','T003'], 'Turnos T001–T003 completos y únicos');
  equal(data.requirementFiles, reqIds.map(r=>`${r}.yaml`), 'Nombres de archivos de requisitos inválidos');
  equal(data.turnFiles, ['T001.yaml','T002.yaml','T003.yaml'], 'Nombres de archivos de turnos inválidos');
  equal(f.pilot.initial_requirements, ['R001','R002'], 'V0 solo puede incluir R001 y R002');
  equal(f.pilot.turns, ts.map(t=>t.id), 'Lista de turnos de family no coincide');
  equal(f.generation_plan, expectedPlan(id, data.policy.provider_ring), `Asignación ${id} inválida (rotación por fila)`);
  demand(id === 'F001' || typeof f.pilot.initial_request === 'string', 'Falta pilot.initial_request (solicitud de V0)');
  rs.forEach((r,i) => {
    demand(r.introduced_at === (i < 2 ? 'V0' : `T00${i-1}`), `${r.id}: introduced_at incorrecto`);
    equal(r.acceptance.map(a=>a.id), r.acceptance.map((_,j)=>`${r.id}-A${String(j+1).padStart(2,'0')}`), `${r.id}: criterios incorrectos`);
  });
  ts.forEach((t,i) => {
    demand(t.from_version === `V${i}` && t.to_version === `V${i+1}`, `${t.id}: transición inválida`);
    equal(t.preserves, reqIds.slice(0,i+2), `${t.id}: preserves inválido`);
    equal(t.introduces, [reqIds[i+2]], `${t.id}: introduces inválido`);
    equal(t.active_after, reqIds.slice(0,i+3), `${t.id}: active_after inválido`);
    demand(t.provider === f.generation_plan[t.to_version], `${t.id}: proveedor inválido`);
    demand(t.reference_commit === f.reference_versions[t.to_version], `${t.id}: referencia distinta al manifiesto`);
    demand(t.patch_path === (t.reference_commit ? `generation/${t.to_version}/reference.patch` : null), `${t.id}: patch_path inconsistente con su referencia`);
  });
  // Fixture: invariantes propias de la familia, bytes originales y hash.
  demand(f.fixture.path === oracle.FIXTURE && p.fixture.path === f.fixture.path, 'Ruta de fixture inválida');
  errors.push(...oracle.checkFixture(data.fixture, f));
  const fixtureFile = join(root, dir, oracle.FIXTURE);
  if (existsSync(fixtureFile)) {
    const fixtureBytes = readFileSync(fixtureFile);
    equal(data.fixture, JSON.parse(fixtureBytes.toString('utf8')), 'contenido del fixture distinto de los bytes originales');
    demand(f.fixture.sha256 === sha256(fixtureBytes) && p.fixture.sha256 === f.fixture.sha256, 'Hash de fixture inconsistente');
  } else demand(false, `Falta ${dir}/${oracle.FIXTURE}`);
  demand(f.technology.stack_manifest === 'config/stack.json' && p.scaffold.path === 'templates/react-vite', 'Ruta del stack/scaffold inválida');
  demand(f.oracle.path === `oracle/${id}`, 'Ruta de oráculo inválida');
  equal(p.references, f.reference_versions, 'Referencias y procedencia no coinciden');
  // Ciclo de vida: DRAFT (sin referencias) → GENERATED (≥1, consecutivas desde V0) → VALIDATED (V0–V3)
  // → AUDITED (auditoría aprobada) → FROZEN (además estabilidad del oráculo registrada).
  const versions = ['V0','V1','V2','V3'];
  const refs = versions.map(v => f.reference_versions[v]);
  const count = refs.filter(Boolean).length;
  demand(refs.every((r,i) => !r || refs.slice(0,i).every(Boolean)), 'Referencias no consecutivas desde V0');
  for (const [i,v] of versions.entries()) {
    if (!refs[i]) continue;
    const refPath = join(root, dir, 'generation', v, 'reference.json');
    if (!existsSync(refPath)) { demand(false, `${v}: falta generation/${v}/reference.json`); continue; }
    const ref = JSON.parse(readFileSync(refPath, 'utf8'));
    demand(ref.candidate_commit === refs[i] && ref.version === v, `${v}: reference.json no coincide con family.yaml`);
    demand(existsSync(join(root, dir, 'generation', v, 'reference.patch')) && existsSync(join(root, dir, 'generation', v, 'task.json')), `${v}: faltan parche o tarea de la referencia`);
    demand(p.models[ref.generator?.provider] !== null, `${v}: procedencia sin modelo del generador`);
  }
  const needed = { DRAFT: [0,0], GENERATED: [1,4], VALIDATED: [4,4], AUDITED: [4,4], FROZEN: [4,4] }[f.status];
  demand(needed && count >= needed[0] && count <= needed[1], `Estado ${f.status} incompatible con ${count} referencias`);
  if (f.status === 'DRAFT') demand(Object.values(p.models).every(v=>v===null), 'DRAFT no registra modelos de ejecuciones');
  demand(count === 0 ? p.artifact_scope === 'specification_and_neutral_scaffold_only' && p.authorship.reference_application_generator === null : p.artifact_scope === 'specification_scaffold_and_references' && p.authorship.reference_application_generator === 'multimodel_pipeline', 'Alcance/autoría de procedencia inconsistente con las referencias');
  demand(['AUDITED','FROZEN'].includes(f.status) === (p.audit.status === 'PASSED'), 'Estado de auditoría inconsistente');
  // El stack experimental se congela con la primera familia FROZEN; una familia FROZEN exige stack congelado.
  if (f.status === 'FROZEN') demand(data.stack.experimental_frozen === true, 'experimental_frozen solo cuando la familia está FROZEN');
  // Oráculo: un archivo por requisito, cobertura exacta de criterios, versión mínima, planes y vinculación por hash.
  equal(data.oracleFiles, reqIds.map(r => `${r}.cases.yaml`), 'Archivos del oráculo inválidos');
  equal(data.oracleCases.map(c=>c.requirement_id), reqIds, 'Oráculo incompleto');
  rs.forEach((r,i)=> {
    const c = data.oracleCases.find(c=>c.requirement_id===r.id);
    if (c) {
      equal(c.cases.map(x=>x.id), r.acceptance.map(x=>x.id), `${r.id}: cobertura de criterios incompleta`);
      demand(c.minimum_version === `V${Math.max(0,i-1)}`, `${r.id}: versión de oráculo incorrecta`);
    }
  });
  const caseIds = data.oracleCases.flatMap(c => c.cases.map(x => x.id));
  equal(Object.keys(oracle.PLANS).sort(), [...caseIds].sort(), `${id}: planes ejecutables no coinciden con los casos`);
  const unlocked = data.oracleCases.flatMap(c => c.cases).filter(spec => oracle.lock.cases?.[spec.id] !== specHash(spec)).map(spec => spec.id);
  demand(!unlocked.length && Object.keys(oracle.lock.cases ?? {}).length === caseIds.length, `${id}: spec-lock desactualizado (${unlocked.join(', ') || 'casos sobrantes'}); revisar planes y ejecutar npm run oracle:lock -- ${id}`);
  // Contrato de interfaz: cada control con nombre del contrato está en CONTROL con el mismo rol, y viceversa.
  const named = rs.flatMap(r => r.ui_contract.elements.filter(e => e.name && !['listitem', 'list'].includes(e.role)).map(e => `${e.role}:${e.name}`));
  equal(Object.values(oracle.CONTROL ?? {}).map(c => `${c.role}:${c.name}`).sort(), [...new Set(named)].sort(), `${id}: CONTROL del oráculo no coincide con los controles con nombre del ui_contract`);
  const listNames = rs.flatMap(r => r.ui_contract.elements.filter(e => e.role === 'list' && e.name).map(e => e.name));
  if (id !== 'F001') equal(Object.values(oracle.LISTS ?? {}).map(l => l.name).filter(Boolean).sort(), [...new Set(listNames)].sort(), `${id}: LISTS del oráculo no coincide con las listas con nombre del ui_contract`);
  // Nombres sin ambigüedad: dentro de un mismo rol, ningún nombre contiene a otro (búsqueda por subcadena del adaptador).
  const byRole = {};
  for (const c of Object.values(oracle.CONTROL ?? {})) (byRole[c.role] ??= []).push(c.name.toLowerCase());
  for (const [role, names] of Object.entries(byRole)) for (const a of names) for (const b of names) if (a !== b && b.includes(a)) errors.push(`${id}: nombre ambiguo en ${role}: «${a}» está contenido en «${b}»`);
  const required = ['README.md','templates/react-vite/package-lock.json','templates/react-vite/src/App.tsx','runner/agents/contracts.ts','runs/corpus-generation','runs/pi0',
    `${dir}/prompts/architecture.md`, `${dir}/prompts/generate-v0.md`, ...(id === 'F001' ? ['oracle/F001/adapter.ts', ...versions.map(v=>`${dir}/generation/${v}`)] : [])];
  for (const path of required) demand(existsSync(join(root,path)), `Falta ${path}`);
  for (const pkgDir of ['', 'templates/react-vite']) {
    const packagePath = join(root,pkgDir,'package.json');
    const lockPath = join(root,pkgDir,'package-lock.json');
    if (!existsSync(lockPath)) { errors.push(`Falta ${lockPath}`); continue; }
    const pkg = read(packagePath); const lock = read(lockPath);
    for (const kind of ['dependencies','devDependencies']) {
      equal(pkg[kind] ?? {}, lock.packages[''][kind] ?? {}, `Lockfile ${pkgDir} no coincide con ${kind}`);
      for (const [name,v] of Object.entries(pkg[kind] ?? {})) {
        demand(/^\d+\.\d+\.\d+$/.test(v), `Versión no exacta: ${name}`);
        demand(lock.packages[`node_modules/${name}`]?.version === v, `Paquete ${name} no resuelto a versión exacta`);
        if (pkgDir) demand(data.stack.scaffold[name] === v, `Stack distinto a package: ${name}`);
      }
    }
  }
  return errors;
}

// Validación de todas las familias más las reglas que cruzan familias.
export function validateAll(root) {
  const results = {};
  const corpora = [];
  for (const { id } of listFamilies(root)) {
    try { const data = loadCorpus(root, id); corpora.push(data); results[id] = validateCorpus(data, root); }
    catch (error) { results[id] = [error.message]; }
  }
  const cross = [];
  const slugs = corpora.map(d => d.family.slug);
  if (new Set(slugs).size !== slugs.length) cross.push('slugs de familia repetidos');
  const stack = read(join(root, 'config/stack.json'));
  if (stack.experimental_frozen && !corpora.some(d => d.family.status === 'FROZEN')) cross.push('experimental_frozen sin ninguna familia FROZEN');
  // Prefijos de identificadores del fixture distintos entre familias (evita ambigüedad en listas y fugas en auditoría).
  const prefixes = Object.entries(FAMILY_ORACLES).map(([fid, o]) => [fid, o.ID_PREFIX ?? (fid === 'F001' ? 'P' : null)]).filter(([, prefix]) => prefix);
  const seen = new Map();
  for (const [fid, prefix] of prefixes) { if (seen.has(prefix)) cross.push(`prefijo de ID ${prefix} repetido en ${seen.get(prefix)} y ${fid}`); seen.set(prefix, fid); }
  if (cross.length) results['*'] = cross;
  return results;
}
