// R4 — Generación experimental de una familia semi-real (V1–V3), con los mismos proveedores y registros que el
// estrato sintético. Uso: npm run corpus:generate -- Sxxx V1|V2|V3|all [--no-commit]
// Cada versión: preflight despejado → workspace desde la imagen de la familia + referencias aceptadas → runTask
// (experimental) → registros en runs/corpus-generation/Sxxx/ y evaluator/runs/Sxxx/ → si ACCEPTED, referencia en
// families-real/Sxxx/generation/<V>/ y actualización de family.yaml → commit Git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { runTask } from '../execution/engine.mjs';
import { createProviderPool } from '../providers/adapter.mjs';
import { credentialsFromEnv } from '../providers/connection.mjs';
import { withRetries } from '../providers/retry.mjs';
import { createTaskStore, saveReference } from '../pipeline/store.mjs';
import { loadRealFamily, makeRealPacket, REAL_VERSIONS } from './families.mjs';
import { readBases } from './prepare.mjs';
import { realWorkspaces, createRealEvaluator } from './pipeline.mjs';
import { realSteps } from './lineage.mjs';
import { realBlockers } from './preflight.mjs';

const log = message => console.log(`[${new Date().toISOString()}] ${message}`);
export const realReferencesDir = (root, data) => join(root, data.familyDir, 'generation');
export const hiddenTestsOf = data => data.turns.map(t => ({ id: t.id, file: basename(t.hidden_tests), text: t.hiddenTestsText }));

// Registra la referencia aceptada en family.yaml conservando comentarios y formato.
export function recordRealReference(root, data, version, reference) {
  const path = join(root, data.familyDir, 'family.yaml');
  const doc = YAML.parseDocument(readFileSync(path, 'utf8'));
  doc.setIn(['generation', 'references', version], reference.candidate_commit);
  const refs = REAL_VERSIONS.map(v => doc.getIn(['generation', 'references', v]));
  doc.setIn(['generation', 'status'], refs.every(Boolean) ? 'VALIDATED' : 'GENERATED');
  const provider = reference.generator.provider;
  const previous = doc.getIn(['generation', 'models', provider]);
  const observed = reference.generator.model;
  doc.setIn(['generation', 'models', provider], previous && previous !== observed ? `${previous}; ${observed}` : observed);
  writeFileSync(path, String(doc));
}

export async function generateReal(root, familyId, version, { commit = true, adapterFactory, blockers = realBlockers } = {}) {
  const problems = blockers(root, familyId);
  if (problems.length) throw new Error('Preflight bloquea la generación:\n' + problems.map(b => `- ${b}`).join('\n'));
  const data = loadRealFamily(root, familyId);
  const m = data.manifest;
  const index = REAL_VERSIONS.indexOf(version);
  if (index < 0) throw new Error(`Versión semi-real desconocida: ${version}`);
  if (m.generation.references[version]) throw new Error(`${version} ya tiene referencia; no se regenera`);
  if (index > 0 && !m.generation.references[REAL_VERSIONS[index - 1]]) throw new Error(`${version} requiere la referencia ${REAL_VERSIONS[index - 1]}`);
  const base = readBases(root).bases[familyId];
  const models = JSON.parse(readFileSync(join(root, 'config/models.json'), 'utf8')).models;
  const credentials = adapterFactory ? {} : credentialsFromEnv(models, process.env);
  const missing = adapterFactory ? [] : ['openai', 'anthropic', 'google'].filter(p => !credentials[p]);
  if (missing.length) throw new Error(`Faltan credenciales en el entorno para: ${missing.join(', ')} (usar .env con SYNTEROLINK_API_KEY)`);
  const packet = makeRealPacket(data, version);
  const referencesDir = realReferencesDir(root, data);
  const steps = realSteps(version, referencesDir);
  const store = createTaskStore(root, { mode: 'experimental', familyId, version });
  const initialProvider = m.generation.plan[version];
  log(`${familyId} ${version}: tarea ${store.taskId}, proveedor inicial ${initialProvider}`);
  const pool = adapterFactory ? adapterFactory({ store, version }) : createProviderPool({ models, credentials, onCall: call => store.call(call) });
  const adapter = withRetries(pool, { before: context => store.track(context), onRetry: ({ context, code, wait }) => log(`  ${context.provider} a${context.attempt} c${context.cycle}: ${code}; reintento en ${wait / 1000}s`) });
  const result = await runTask({
    mode: 'experimental', preflightBlockers: [], packet, policy: data.policy, initialProvider, adapter,
    workspaces: realWorkspaces({ image: base.image_id, manifest: m, steps, v0Commit: base.v0_repo_commit, onOpen: () => log('  workspace abierto') }),
    evaluator: createRealEvaluator({ image: base.image_id, manifest: m, steps, v0Commit: base.v0_repo_commit, version, hiddenTests: hiddenTestsOf(data), privateSink: record => store.private(record) }),
    emit: event => {
      store.event(event);
      if (event.type === 'evaluation') log(`  ${event.provider} a${event.attempt} ${event.stage}: ${event.status}`);
      if (event.type === 'attempt_finished') log(`  ${event.provider} a${event.attempt}: ${event.outcome}${event.reason ? ` (${event.reason})` : ''}, ${event.cycles} ciclos`);
      if (event.type === 'model_output_error') log(`  ${event.provider} a${event.attempt} c${event.cycle}: salida inválida ${event.code}`);
    }
  });
  const { summary, records } = store.finalize(result, { packet, models, stackText: JSON.stringify(base), fixtureSha256: base.image_id.slice(7) });
  let reference = null;
  if (summary.status === 'ACCEPTED') {
    const record = records.find(r => r.outcome === 'ACCEPTED');
    const patch = readFileSync(join(store.dir, 'attempts', record.id, 'patch.diff'), 'utf8');
    reference = saveReference(root, referencesDir, { version, record, patch, taskText: JSON.stringify(packet, null, 2) + '\n', taskDir: store.dir, familyId });
    if (record.generator.model === 'no-observado' && !adapterFactory) throw new Error('Referencia sin modelo observado: no se registra procedencia');
    recordRealReference(root, data, version, reference);
    log(`${familyId} ${version}: ACEPTADA (${record.generator.provider}, ${record.id}) commit ${reference.candidate_commit}`);
  } else log(`${familyId} ${version}: ${summary.status} — sin referencia`);
  if (commit) {
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git(['add', 'runs/corpus-generation', 'evaluator/runs', data.familyDir]);
    git(['commit', '-q', '-m', reference
      ? `corpus: ${familyId} ${version} reference generated by ${reference.generator.provider}\n\nTask ${store.taskId}; accepted attempt ${reference.attempt}; candidate ${reference.candidate_commit}.`
      : `corpus: ${familyId} ${version} attempt without reference (${summary.status})\n\nTask ${store.taskId}; records kept for audit.`]);
    log(`  commit ${git(['rev-parse', '--short', 'HEAD'])}`);
  }
  return summary.status;
}
