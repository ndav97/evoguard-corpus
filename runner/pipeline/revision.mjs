// Nueva revisión de una familia sintética congelada (tarea 10 de docs/progreso-tareas-sin-modelos.md).
// Uso: npm run corpus:revision -- F001 --reason "texto" [--no-commit]
// Motivo: F001 se generó y congeló con el protocolo de acciones 1.0; para compararla con F002–F010 (protocolo 1.1)
// hay que regenerarla. La revisión congelada NO se modifica ni se borra: se archiva íntegra y la familia vuelve a
// DRAFT con la misma especificación, fixture y oráculo.
//   families/<familia>/revisions/rN/generation/V0..V3   referencias congeladas (tal cual)
//   families/<familia>/revisions/rN/{family,provenance}.yaml, turns/, audit.json, manifest.json (hashes y motivo)
//   runs/archive/<familia>-rN/                          registros públicos de la generación archivada
//   evaluator/archive/<familia>-rN/                     registros privados del evaluador archivados
// Después: generation/V0..V3 vacíos, family.yaml DRAFT sin referencias, provenance sin modelos ni auditoría y
// stack.experimental_frozen solo si queda alguna familia FROZEN. La validación del corpus debe pasar.
// Aplicar solo cuando los modelos estén listos: el banco de modelos locales usa las referencias de F001 (lee el
// archivo de la revisión si la familia ya no las tiene).
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus } from '../validation/corpus.mjs';
import { familyDir, listFamilies } from '../families.mjs';

const VERSIONS = ['V0', 'V1', 'V2', 'V3'];
const sha = text => createHash('sha256').update(text).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

export const revisionsOf = (root, familyId) => {
  const dir = join(root, familyDir(root, familyId), 'revisions');
  return existsSync(dir) ? readdirSync(dir).filter(name => /^r\d+$/.test(name)).map(name => Number(name.slice(1))).sort((a, b) => a - b) : [];
};
// Directorio de referencias de la última revisión archivada (null si no hay).
export function archivedReferences(root, familyId) {
  const list = revisionsOf(root, familyId);
  return list.length ? join(root, familyDir(root, familyId), 'revisions', `r${list.at(-1)}`, 'generation') : null;
}

export function openRevision(root, familyId, { reason, now = new Date().toISOString() } = {}) {
  if (!reason || reason.trim().length < 10) throw new Error('Indica el motivo de la revisión (--reason "…")');
  const data = loadCorpus(root, familyId);
  if (data.family.status !== 'FROZEN') throw new Error(`${familyId} no está FROZEN (${data.family.status}): no hay revisión que archivar`);
  const dir = familyDir(root, familyId);
  const number = (revisionsOf(root, familyId).at(-1) ?? 0) + 1;
  const archive = join(root, dir, 'revisions', `r${number}`);
  if (existsSync(archive)) throw new Error(`Ya existe ${archive}`);
  mkdirSync(archive, { recursive: true });

  // 1. Referencias congeladas y manifiestos, tal cual.
  const references = {};
  for (const version of VERSIONS) {
    const source = join(root, dir, 'generation', version);
    const target = join(archive, 'generation', version);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(source, target);
    const patchPath = join(target, 'reference.patch');
    references[version] = { commit: data.family.reference_versions[version], patch_sha256: existsSync(patchPath) ? sha(readFileSync(patchPath)) : null };
  }
  cpSync(join(root, dir, 'family.yaml'), join(archive, 'family.yaml'));
  cpSync(join(root, dir, 'provenance.yaml'), join(archive, 'provenance.yaml'));
  cpSync(join(root, dir, 'turns'), join(archive, 'turns'), { recursive: true });
  const auditPath = join(root, 'docs/verification', `${familyId.toLowerCase()}-audit.json`);
  if (existsSync(auditPath)) cpSync(auditPath, join(archive, 'audit.json'));

  // 2. Registros de la generación archivada (públicos y privados).
  const moved = {};
  for (const [from, to] of [[`runs/corpus-generation/${familyId}`, `runs/archive/${familyId}-r${number}`], [`evaluator/runs/${familyId}`, `evaluator/archive/${familyId}-r${number}`]]) {
    if (!existsSync(join(root, from))) continue;
    mkdirSync(dirname(join(root, to)), { recursive: true });
    renameSync(join(root, from), join(root, to));
    moved[from] = to;
  }
  const manifest = {
    artifact_type: 'family_revision_archive', family_id: familyId, revision: number, archived_at: now, reason: reason.trim(),
    status_at_archive: 'FROZEN', references, records_moved: moved,
    family_yaml_sha256: sha(readFileSync(join(archive, 'family.yaml'))), provenance_sha256: sha(readFileSync(join(archive, 'provenance.yaml'))),
    audit_sha256: existsSync(join(archive, 'audit.json')) ? sha(readFileSync(join(archive, 'audit.json'))) : null
  };
  writeJson(join(archive, 'manifest.json'), manifest);

  // 3. La familia vuelve a DRAFT con la misma especificación.
  for (const version of VERSIONS) {
    mkdirSync(join(root, dir, 'generation', version), { recursive: true });
    writeFileSync(join(root, dir, 'generation', version, '.gitkeep'), '');
  }
  const family = readJson(join(root, dir, 'family.yaml'));
  family.status = 'DRAFT';
  family.reference_versions = Object.fromEntries(VERSIONS.map(v => [v, null]));
  writeJson(join(root, dir, 'family.yaml'), family);
  const provenance = readJson(join(root, dir, 'provenance.yaml'));
  provenance.models = Object.fromEntries(Object.keys(provenance.models).map(k => [k, null]));
  provenance.audit = { status: 'NOT_STARTED', reviewer: null, evidence: [] };
  provenance.similarity_review = { ...provenance.similarity_review, status: 'NOT_STARTED' };
  provenance.references = Object.fromEntries(VERSIONS.map(v => [v, null]));
  provenance.artifact_scope = 'specification_and_neutral_scaffold_only';
  provenance.authorship = { ...provenance.authorship, reference_application_generator: null };
  writeJson(join(root, dir, 'provenance.yaml'), provenance);
  for (const name of readdirSync(join(root, dir, 'turns')).filter(n => /^T\d{3}\.yaml$/.test(n))) {
    const turn = readJson(join(root, dir, 'turns', name));
    turn.reference_commit = null;
    turn.patch_path = null;
    writeJson(join(root, dir, 'turns', name), turn);
  }
  const stack = readJson(join(root, 'config/stack.json'));
  stack.experimental_frozen = listFamilies(root).some(f => f.id !== familyId && loadCorpus(root, f.id).family.status === 'FROZEN');
  writeJson(join(root, 'config/stack.json'), stack);

  const errors = validateCorpus(loadCorpus(root, familyId), root);
  if (errors.length) throw new Error('Corpus inconsistente tras abrir la revisión:\n' + errors.join('\n'));
  return { revision: number, next: number + 1, archive: archive.slice(root.length + 1), manifest };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const familyId = args.find(a => /^F\d{3}$/.test(a));
  const reasonIndex = args.indexOf('--reason');
  const reason = reasonIndex >= 0 ? args[reasonIndex + 1] : null;
  if (!familyId || !reason) { console.error('Uso: npm run corpus:revision -- Fxxx --reason "motivo" [--no-commit]'); process.exit(1); }
  try {
    const result = openRevision(root, familyId, { reason });
    console.log(`${familyId}: revisión ${result.revision} archivada en ${result.archive}; la familia vuelve a DRAFT para generar la revisión ${result.next}.`);
    if (!args.includes('--no-commit')) {
      const git = a => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
      git(['add', '-A', familyDir(root, familyId), 'config/stack.json', 'runs', 'evaluator']);
      git(['commit', '-q', '-m', `corpus: ${familyId} revision ${result.revision} archived; revision ${result.next} opened\n\nReason: ${reason}`]);
      console.log(`commit ${git(['rev-parse', '--short', 'HEAD'])}`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
