import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import Ajv from 'ajv';

export const FAMILY_PATH = 'families/F001-product-catalog';
export const read = path => YAML.parse(readFileSync(path, 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const yamlFiles = path => readdirSync(path).filter(p => p.endsWith('.yaml')).sort();

export function loadCorpus(root) {
  const familyRoot = join(root, FAMILY_PATH);
  const requirementFiles = yamlFiles(join(familyRoot, 'requirements'));
  const turnFiles = yamlFiles(join(familyRoot, 'turns'));
  return {
    family: read(join(familyRoot, 'family.yaml')),
    provenance: read(join(familyRoot, 'provenance.yaml')),
    products: read(join(familyRoot, 'fixtures/products.json')),
    requirements: requirementFiles.map(p => read(join(familyRoot, 'requirements', p))),
    turns: turnFiles.map(p => read(join(familyRoot, 'turns', p))),
    requirementFiles, turnFiles,
    oracleCases: yamlFiles(join(root, 'oracle/F001')).map(p => read(join(root, 'oracle/F001', p))),
    policy: read(join(root, 'config/policy.json')),
    stack: read(join(root, 'config/stack.json')),
    prompts: Object.fromEntries(['common','generate-v0','evolve-turn','repair'].map(p => [p, readFileSync(join(root, 'prompts', `${p}.md`), 'utf8')]))
  };
}

export function schemaValidators(root) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  return Object.fromEntries(readdirSync(join(root, 'schema')).filter(p => p.endsWith('.schema.json')).map(p => [p.replace('.schema.json',''), ajv.compile(read(join(root,'schema',p)))]));
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
  const check = (kind, value) => {
    const validator = validators[kind];
    if (!validator(value)) errors.push(`${kind}: ${JSON.stringify(validator.errors)}`);
  };
  check('family', data.family); check('provenance', data.provenance); check('products', data.products);
  data.requirements.forEach(r => check('requirement', r));
  data.turns.forEach(t => check('turn', t));
  data.oracleCases.forEach(c => check('oracle-case', c));
  check('policy', data.policy); check('stack', data.stack);
  if (errors.length) return errors;
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const equal = (a,b,message) => demand(isDeepStrictEqual(a,b), message);
  const {family:f, provenance:p, requirements:rs, turns:ts, products:ps} = data;
  const reqIds = ['R001','R002','R003','R004','R005'];
  equal(rs.map(r=>r.id), reqIds, 'Requisitos R001–R005 completos, únicos y ordenados');
  equal(ts.map(t=>t.id), ['T001','T002','T003'], 'Turnos T001–T003 completos y únicos');
  equal(data.requirementFiles, reqIds.map(id=>`${id}.yaml`), 'Nombres de archivos de requisitos inválidos');
  equal(data.turnFiles, ['T001.yaml','T002.yaml','T003.yaml'], 'Nombres de archivos de turnos inválidos');
  equal(f.pilot.initial_requirements, ['R001','R002'], 'V0 solo puede incluir R001 y R002');
  equal(f.pilot.turns, ts.map(t=>t.id), 'Lista de turnos de family no coincide');
  equal(f.generation_plan, {V0:'openai',V1:'anthropic',V2:'google',V3:'local_a'}, 'Asignación F001 inválida');
  demand(f.family_id === 'F001' && p.family_id === f.family_id, 'Familia/procedencia inválida');
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
  equal(ps.map(p=>p.id), Array.from({length:30},(_,i)=>`P${String(i+1).padStart(3,'0')}`), 'IDs de productos deben ser P001–P030 únicos y ordenados');
  demand(new Set(ps.map(p=>p.name.toLowerCase())).size === 30, 'Nombres de productos no únicos');
  for (const [category,count] of Object.entries(f.fixture.category_counts)) demand(ps.filter(p=>p.category===category).length === count, `Conteo incorrecto de ${category}`);
  demand(ps.some((p,i)=>i>0 && ps[i-1].price>p.price), 'Fixture debe tener precios fuera de orden');
  demand(new Set(ps.map(p=>p.price)).size < ps.length, 'Fixture debe incluir empates');
  const fixtureBytes = readFileSync(join(root,FAMILY_PATH,'fixtures/products.json'));
  equal(ps, JSON.parse(fixtureBytes.toString('utf8')), 'contenido del fixture distinto de los bytes originales');
  demand(f.fixture.sha256 === sha256(fixtureBytes) && p.fixture.sha256 === f.fixture.sha256, 'Hash de fixture inconsistente');
  demand(f.fixture.path === 'fixtures/products.json' && p.fixture.path === f.fixture.path, 'Ruta de fixture inválida');
  demand(f.technology.stack_manifest === 'config/stack.json' && p.scaffold.path === 'templates/react-vite', 'Ruta del stack/scaffold inválida');
  demand(f.oracle.path === 'oracle/F001', 'Ruta de oráculo inválida');
  equal(p.references, f.reference_versions, 'Referencias y procedencia no coinciden');
  // Ciclo de vida: DRAFT (sin referencias) → GENERATED (≥1, consecutivas desde V0) → VALIDATED (V0–V3)
  // → AUDITED (auditoría aprobada) → FROZEN (además estabilidad del oráculo registrada).
  const versions = ['V0','V1','V2','V3'];
  const refs = versions.map(v => f.reference_versions[v]);
  const count = refs.filter(Boolean).length;
  demand(refs.every((r,i) => !r || refs.slice(0,i).every(Boolean)), 'Referencias no consecutivas desde V0');
  for (const [i,v] of versions.entries()) {
    if (!refs[i]) continue;
    const refPath = join(root, FAMILY_PATH, 'generation', v, 'reference.json');
    if (!existsSync(refPath)) { demand(false, `${v}: falta generation/${v}/reference.json`); continue; }
    const ref = JSON.parse(readFileSync(refPath, 'utf8'));
    demand(ref.candidate_commit === refs[i] && ref.version === v, `${v}: reference.json no coincide con family.yaml`);
    demand(existsSync(join(root, FAMILY_PATH, 'generation', v, 'reference.patch')) && existsSync(join(root, FAMILY_PATH, 'generation', v, 'task.json')), `${v}: faltan parche o tarea de la referencia`);
    demand(p.models[ref.generator?.provider] !== null, `${v}: procedencia sin modelo del generador`);
  }
  const needed = { DRAFT: [0,0], GENERATED: [1,4], VALIDATED: [4,4], AUDITED: [4,4], FROZEN: [4,4] }[f.status];
  demand(needed && count >= needed[0] && count <= needed[1], `Estado ${f.status} incompatible con ${count} referencias`);
  if (f.status === 'DRAFT') demand(Object.values(p.models).every(v=>v===null), 'DRAFT no registra modelos de ejecuciones');
  demand(count === 0 ? p.artifact_scope === 'specification_and_neutral_scaffold_only' && p.authorship.reference_application_generator === null : p.artifact_scope === 'specification_scaffold_and_references' && p.authorship.reference_application_generator === 'multimodel_pipeline', 'Alcance/autoría de procedencia inconsistente con las referencias');
  demand(['AUDITED','FROZEN'].includes(f.status) === (p.audit.status === 'PASSED'), 'Estado de auditoría inconsistente');
  demand(data.stack.experimental_frozen === (f.status === 'FROZEN'), 'experimental_frozen solo cuando la familia está FROZEN');
  equal(data.oracleCases.map(c=>c.requirement_id), reqIds, 'Oráculo incompleto');
  rs.forEach((r,i)=> {
    const c = data.oracleCases.find(c=>c.requirement_id===r.id);
    if (c) {
      equal(c.cases.map(x=>x.id), r.acceptance.map(x=>x.id), `${r.id}: cobertura de criterios incompleta`);
      demand(c.minimum_version === `V${Math.max(0,i-1)}`, `${r.id}: versión de oráculo incorrecta`);
    }
  });
  for (const path of ['README.md','templates/react-vite/package-lock.json','templates/react-vite/src/App.tsx','oracle/F001/adapter.ts','runner/agents/contracts.ts','runs/corpus-generation','runs/pi0',...['V0','V1','V2','V3'].map(v=>`${FAMILY_PATH}/generation/${v}`)]) demand(existsSync(join(root,path)), `Falta ${path}`);
  for (const dir of ['', 'templates/react-vite']) {
    const packagePath = join(root,dir,'package.json');
    const lockPath = join(root,dir,'package-lock.json');
    if (!existsSync(lockPath)) { errors.push(`Falta ${lockPath}`); continue; }
    const pkg = read(packagePath); const lock = read(lockPath);
    for (const kind of ['dependencies','devDependencies']) {
      equal(pkg[kind] ?? {}, lock.packages[''][kind] ?? {}, `Lockfile ${dir} no coincide con ${kind}`);
      for (const [name,v] of Object.entries(pkg[kind] ?? {})) {
        demand(/^\d+\.\d+\.\d+$/.test(v), `Versión no exacta: ${name}`);
        demand(lock.packages[`node_modules/${name}`]?.version === v, `Paquete ${name} no resuelto a versión exacta`);
        if (dir) demand(data.stack.scaffold[name] === v, `Stack distinto a package: ${name}`);
      }
    }
  }
  return errors;
}
