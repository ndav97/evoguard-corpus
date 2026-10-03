// Generación experimental del corpus (Pasos 7–8), una familia por invocación.
// Uso: npm run corpus:generate -- [Fxxx] V0|V1|V2|V3|all [--no-commit]   (sin familia: F001)
// Cada versión: preflight despejado → seed desde la referencia previa → runTask(mode: experimental) con los
// cinco proveedores reales → registros en runs/ y evaluator/runs/ → si ACCEPTED, referencia en
// families/<Fxxx-slug>/generation/<V>/ y actualización de family/provenance/turnos → commit Git.
// Nunca corrige código de un candidato ni revela resultados del oráculo al constructor.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runTask } from '../execution/engine.mjs';
import { loadCorpus, validateCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';
import { generationBlockers } from '../preflight.mjs';
import { createProviderPool } from '../providers/adapter.mjs';
import { credentialsFromEnv } from '../providers/connection.mjs';
import { withRetries } from '../providers/retry.mjs';
import { seedFiles } from '../sandbox/policy.mjs';
import { evolutionSeed } from '../sandbox/lineage.mjs';
import { sandboxWorkspaces } from './workspace.mjs';
import { createPipelineEvaluator } from './evaluator.mjs';
import { createTaskStore, saveReference, CORPUS_REFERENCES } from './store.mjs';
import { familyDir } from '../families.mjs';

let root = fileURLToPath(new URL('../../', import.meta.url));
const VERSIONS = ['V0', 'V1', 'V2', 'V3'];
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const writeJson = (path, value) => writeFileSync(join(root, path), JSON.stringify(value, null, 2) + '\n');
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

// Reintentos de errores transitorios del transporte: runner/providers/retry.mjs.
const retrying = (pool, store) => withRetries(pool, { before: context => store.track(context), onRetry: ({ context, code, wait }) => log(`  ${context.provider} a${context.attempt} c${context.cycle}: ${code}; reintento en ${wait / 1000}s`) });

function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }

// Registra la referencia aceptada en los manifiestos de la familia.
function recordReference(familyId, version, reference, record, { instrumental = false } = {}) {
  const dir = familyDir(root, familyId);
  const familyPath = `${dir}/family.yaml`;
  const provenancePath = `${dir}/provenance.yaml`;
  const family = readJson(familyPath);
  const provenance = readJson(provenancePath);
  family.reference_versions[version] = reference.candidate_commit;
  provenance.references[version] = reference.candidate_commit;
  provenance.artifact_scope = 'specification_scaffold_and_references';
  provenance.authorship.reference_application_generator = 'multimodel_pipeline';
  const models = provenance.models;
  const observed = record.generator.model;
  if (observed === 'no-observado' && !instrumental) throw new Error('Referencia sin modelo observado: no se registra procedencia');
  models[record.generator.provider] = models[record.generator.provider] && models[record.generator.provider] !== observed ? `${models[record.generator.provider]}; ${observed}` : observed;
  const count = Object.values(family.reference_versions).filter(Boolean).length;
  family.status = count === 4 ? 'VALIDATED' : 'GENERATED';
  writeJson(familyPath, family);
  writeJson(provenancePath, provenance);
  if (version !== 'V0') {
    const turn = `${dir}/turns/T00${VERSIONS.indexOf(version)}.yaml`;
    const data = readJson(turn);
    data.reference_commit = reference.candidate_commit;
    data.patch_path = `generation/${version}/reference.patch`;
    writeJson(turn, data);
  }
}

// options.adapterFactory y repoRoot: solo para ensayos en una copia desechable del repositorio.
export async function generate(version, { familyId = 'F001', commit = true, repoRoot, adapterFactory } = {}) {
  if (repoRoot) root = repoRoot;
  const blockers = generationBlockers(root, familyId);
  if (blockers.length) throw new Error('Preflight bloquea la generación:\n' + blockers.map(b => `- ${b}`).join('\n'));
  const data = loadCorpus(root, familyId);
  const index = VERSIONS.indexOf(version);
  if (data.family.reference_versions[version]) throw new Error(`${version} ya tiene referencia; no se regenera`);
  if (index > 0 && !data.family.reference_versions[VERSIONS[index - 1]]) throw new Error(`${version} requiere la referencia ${VERSIONS[index - 1]}`);
  const models = readJson('config/models.json').models;
  const credentials = adapterFactory ? {} : credentialsFromEnv(models, process.env);
  const missing = adapterFactory ? [] : ['openai', 'anthropic', 'google'].filter(provider => !credentials[provider]);
  if (missing.length) throw new Error(`Faltan credenciales en el entorno para: ${missing.join(', ')} (usar .env con SYNTEROLINK_API_KEY)`);

  const packet = makePacket(data, version);
  const seed = evolutionSeed(root, version, CORPUS_REFERENCES(root, familyId), { familyId });
  const taskText = index === 0 ? seedFiles(root, 'V0', familyId)['TASK.json'] : seed.task;
  const store = createTaskStore(root, { mode: 'experimental', familyId, version });
  const initialProvider = data.family.generation_plan[version];
  log(`${familyId} ${version}: tarea ${store.taskId}, proveedor inicial ${initialProvider}`);
  const pool = adapterFactory ? adapterFactory({ store, version }) : createProviderPool({ models, credentials, onCall: call => store.call(call) });
  const result = await runTask({
    mode: 'experimental', preflightBlockers: [], packet, policy: data.policy, initialProvider,
    adapter: retrying(pool, store),
    workspaces: sandboxWorkspaces(root, { seed, onOpen: () => log(`  workspace abierto`) }),
    evaluator: createPipelineEvaluator({ root, version, familyId, privateSink: record => store.private(record) }),
    emit: event => {
      store.event(event);
      if (event.type === 'evaluation') log(`  ${event.provider} a${event.attempt} ${event.stage}: ${event.status}`);
      if (event.type === 'attempt_finished') log(`  ${event.provider} a${event.attempt}: ${event.outcome}${event.reason ? ` (${event.reason})` : ''}, ${event.cycles} ciclos`);
      if (event.type === 'model_output_error') log(`  ${event.provider} a${event.attempt} c${event.cycle}: salida inválida ${event.code}`);
    }
  });
  const { summary, records } = store.finalize(result, { packet, models, stackText: readFileSync(join(root, 'config/stack.json'), 'utf8'), fixtureSha256: data.family.fixture.sha256 });
  let reference = null;
  if (summary.status === 'ACCEPTED') {
    const record = records.find(r => r.outcome === 'ACCEPTED');
    const patch = readFileSync(join(store.dir, 'attempts', record.id, 'patch.diff'), 'utf8');
    reference = saveReference(root, CORPUS_REFERENCES(root, familyId), { version, record, patch, taskText, taskDir: store.dir, familyId });
    recordReference(familyId, version, reference, record, { instrumental: Boolean(adapterFactory) });
    const errors = validateCorpus(loadCorpus(root, familyId), root);
    if (errors.length) throw new Error('Corpus inconsistente tras registrar la referencia:\n' + errors.join('\n'));
    log(`${familyId} ${version}: ACEPTADA (${record.generator.provider}, ${record.id}) commit ${reference.candidate_commit}`);
  } else log(`${familyId} ${version}: ${summary.status} — sin referencia`);
  if (commit) {
    git(['add', 'runs/corpus-generation', 'evaluator/runs', familyDir(root, familyId)]);
    const message = reference
      ? `corpus: ${familyId} ${version} reference generated by ${reference.generator.provider}\n\nTask ${store.taskId}; accepted attempt ${reference.attempt}; candidate ${reference.candidate_commit}.`
      : `corpus: ${familyId} ${version} attempt without reference (${summary.status})\n\nTask ${store.taskId}; records kept for audit.`;
    git(['commit', '-q', '-m', message]);
    log(`  commit ${git(['rev-parse', '--short', 'HEAD'])}`);
  }
  return summary.status;
}

async function main() {
  const args = process.argv.slice(2);
  if (/^S\d{3}$/.test(args[0] ?? '')) {
    // Estrato semi-real: V1–V3 sobre la imagen de la familia (runner/real/generate.mjs).
    const { generateReal } = await import('../real/generate.mjs');
    const { loadRealFamily, REAL_VERSIONS } = await import('../real/families.mjs');
    const [familyId, target, ...flags] = args;
    if (!['all', ...REAL_VERSIONS].includes(target) || flags.some(f => f !== '--no-commit')) throw new Error('Uso: npm run corpus:generate -- Sxxx V1|V2|V3|all [--no-commit]');
    const references = loadRealFamily(root, familyId).manifest.generation.references;
    for (const version of target === 'all' ? REAL_VERSIONS.filter(v => !references[v]) : [target]) {
      const status = await generateReal(root, familyId, version, { commit: !flags.includes('--no-commit') });
      if (status !== 'ACCEPTED') { log(`Detenido en ${familyId} ${version} (${status}).`); process.exitCode = 2; return; }
    }
    log(`Generación de ${familyId} completa.`);
    return;
  }
  if (!/^F\d{3}$/.test(args[0] ?? '')) throw new Error('Uso: npm run corpus:generate -- Sxxx V1|V2|V3|all [--no-commit] (el estrato sintético Fxxx está archivado)');
  const familyId = args.shift();
  const [target, ...flags] = args;
  const commit = !flags.includes('--no-commit');
  if (!['all', ...VERSIONS].includes(target) || flags.some(f => f !== '--no-commit')) throw new Error('Uso: npm run corpus:generate -- [Fxxx] V0|V1|V2|V3|all [--no-commit]');
  const data = loadCorpus(root, familyId);
  const pending = target === 'all' ? VERSIONS.filter(v => !data.family.reference_versions[v]) : [target];
  for (const version of pending) {
    const status = await generate(version, { familyId, commit });
    if (status !== 'ACCEPTED') { log(`Detenido en ${familyId} ${version} (${status}).`); process.exitCode = 2; return; }
  }
  log(`Generación de ${familyId} completa.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error(`[${new Date().toISOString()}] ERROR: ${error.stack ?? error.message}`); process.exitCode = 1; });
}
