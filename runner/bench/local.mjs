// Banco de prueba de modelos locales (paso 3). Uso:
//   npm run bench:local -- [--models=id,id] [--tasks=V1,V3,S005:V1] [--list]
// Para cada candidato de config/local-bench.json y cada tarea (V0 desde el scaffold; Vn desde las referencias
// congeladas de F001), ejecuta el mismo pipeline que la generación real — contenedor aislado, protocolo 1.1,
// comandos visibles, oráculo en contenedor propio, arquitectura — con UN solo modelo (sin reasignación) y hasta
// 3 intentos con reparación visible. Nada de esto entra al corpus: todo queda en .artifacts/bench/ y un resumen
// en docs/verification/local-bench/. Ollama se alcanza en 127.0.0.1 (EVOGUARD_OLLAMA_PORT para el túnel).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runTask } from '../execution/engine.mjs';
import { loadCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';
import { evolutionSeed } from '../sandbox/lineage.mjs';
import { readContainerLock } from '../sandbox/lock.mjs';
import { createProviderAdapter, INSTRUCTION, ACTION_SCHEMA, RESPONSE_CONTRACT, PROTOCOL_VERSION } from '../providers/adapter.mjs';
import { ollamaBase } from '../providers/ollama.mjs';
import { loadContextPolicy, buildContextInput } from '../context/policy.mjs';
import { sandboxWorkspaces } from '../pipeline/workspace.mjs';
import { createPipelineEvaluator } from '../pipeline/evaluator.mjs';
import { createTaskStore, CORPUS_REFERENCES } from '../pipeline/store.mjs';
import { withRetries } from '../providers/retry.mjs';
import { loadRealFamily, makeRealPacket } from '../real/families.mjs';
import { readBases } from '../real/prepare.mjs';
import { realWorkspaces, createRealEvaluator } from '../real/pipeline.mjs';
import { hiddenTestsOf } from '../real/generate.mjs';
import { archivedReferences } from '../pipeline/revision.mjs';

// Tareas semi-reales del banco (2026-09-29): «Sxxx:V1», el primer turno de una familia sobre su imagen V0 (no
// necesita referencias previas). Miden si el candidato trabaja con un repositorio real y su contexto.
const REAL_TASK = /^(S\d{3}):V1$/;
function realTask(root, id) {
  const data = loadRealFamily(root, id);
  const base = readBases(root).bases[id];
  if (base?.status !== 'VERIFIED') throw new Error(`${id}: imagen sin verificar (npm run real:prepare)`);
  const m = data.manifest;
  return {
    packet: makeRealPacket(data, 'V1'), policy: data.policy, familyId: id,
    workspaces: realWorkspaces({ image: base.image_id, manifest: m, steps: [], v0Commit: base.v0_repo_commit }),
    evaluator: privateSink => createRealEvaluator({ image: base.image_id, manifest: m, steps: [], v0Commit: base.v0_repo_commit, version: 'V1', hiddenTests: hiddenTestsOf(data), privateSink }),
    finalize: { stackText: JSON.stringify(base), fixtureSha256: base.image_id.slice(7) }
  };
}

const VERSIONS = ['V0', 'V1', 'V2', 'V3'];
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

async function ollama(path, body) {
  const response = await fetch(`${ollamaBase()}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!response.ok) throw new Error(`Ollama ${path} HTTP ${response.status}`);
  return response.json();
}

// Presupuesto y estimador para este candidato. El estimador se mide con su propio tokenizador (dos muestras:
// núcleo V3 y fixture JSON), igual que la calibración oficial, porque cada familia de modelos tokeniza distinto.
async function candidatePolicy(root, candidate, data) {
  const base = loadContextPolicy(pathToFileURL(join(root, '/')));
  const policy = structuredClone(base);
  policy.applies_to = ['local_a'];
  policy.budget = { context_tokens: candidate.context, output_reserve_tokens: candidate.max_output_tokens, template_reserve_tokens: 512, input_tokens: candidate.context - candidate.max_output_tokens - 512 };
  const overhead = INSTRUCTION + JSON.stringify(ACTION_SCHEMA);
  const wide = structuredClone(policy); wide.estimator.bytes_per_token = 1000; wide.budget.input_tokens = 10 ** 9;
  const samples = [
    buildContextInput({ packet: makePacket(data, 'V3'), messages: [], attempt: 1, cycle: 1 }, { policy: wide, responseContract: RESPONSE_CONTRACT, overhead }).input,
    JSON.stringify({ fixture: readFileSync(join(root, 'archive/sintetico/families/F001-product-catalog/fixtures/products.json'), 'utf8') })
  ];
  const ratios = [];
  for (const input of samples) {
    const result = await ollama('/api/chat', { model: candidate.model, stream: false, keep_alive: candidate.keep_alive, messages: [{ role: 'system', content: INSTRUCTION }, { role: 'user', content: input }], options: { num_ctx: Math.max(candidate.context, 16384), num_predict: 1, temperature: 0, seed: 42 } });
    ratios.push(Buffer.byteLength(INSTRUCTION + input) / result.prompt_eval_count);
  }
  policy.estimator.bytes_per_token = Math.floor(Math.min(...ratios) * 100) / 100;
  policy.estimator.calibration = { bench: true, measured_bytes_per_token: ratios.map(r => +r.toFixed(3)) };
  return policy;
}

function summarize(result, privateRecords, calls) {
  const events = result.events;
  const actions = {};
  for (const event of events.filter(e => e.type === 'response')) actions[event.response.type] = (actions[event.response.type] ?? 0) + 1;
  const oracle = privateRecords.filter(r => r.stage === 'independent_oracle' && r.report).map(r => (r.report.passed !== undefined ? `${r.report.passed}/${r.report.total}` : r.report.status ?? r.status));
  const sum = key => calls.reduce((total, call) => total + (Number.isFinite(call.tokens?.[key]) ? call.tokens[key] : 0), 0);
  return {
    status: result.status,
    attempts: result.attempts.map(a => ({ attempt: a.attempt, outcome: a.outcome, reason: a.reason, cycles: a.cycles, duration_s: Math.round(a.duration_ms / 1000), validation: a.validation })),
    oracle_results: oracle,
    actions,
    loops: events.filter(e => e.type === 'loop_detected').length,
    invalid_outputs: events.filter(e => e.type === 'model_output_error').map(e => e.code),
    calls: calls.length,
    tokens: { input: sum('input'), output: sum('output') },
    median_call_s: calls.length ? Math.round(calls.map(c => c.duration_ms).sort((a, b) => a - b)[Math.floor(calls.length / 2)] / 100) / 10 : null,
    max_output_tokens_used: Math.max(0, ...calls.map(c => c.tokens?.output ?? 0)),
    thinking_chars: calls.reduce((t, c) => t + (c.thinking_chars ?? 0), 0),
    truncated_calls: calls.filter(c => c.finish_reason === 'length').length,
    max_context_estimate: Math.max(0, ...calls.map(c => c.context?.estimated_tokens ?? 0)),
    context_omitted_steps: Math.max(0, ...calls.map(c => c.context?.steps_omitted ?? 0))
  };
}

// options.config sustituye a config/local-bench.json (autoprueba); options.outputs=false no escribe en docs/.
export async function runBench(root, { models, tasks, adapterFactory, config: override, outputs = true } = {}) {
  const config = override ?? JSON.parse(readFileSync(join(root, 'config/local-bench.json'), 'utf8'));
  const data = loadCorpus(root);
  // El contenedor sintético (F001, archivado) solo hace falta para las tareas V0–V3. Las tareas semi-reales (Sxxx:V1)
  // usan la imagen de su familia, así que no exigen ese manifiesto, que quedó obsoleto al archivar el estrato sintético.
  const synthetic = (tasks ?? config.tasks).some(v => VERSIONS.includes(v));
  const lock = synthetic ? readContainerLock(root) : { image_id: null };
  const candidates = config.candidates.filter(c => !models || models.includes(c.id)).map(c => ({ ...config.defaults, ...c }));
  const selectedTasks = (tasks ?? config.tasks).filter(v => VERSIONS.includes(v) || REAL_TASK.test(v));
  if (!candidates.length || !selectedTasks.length) throw new Error('Sin candidatos o tareas seleccionados');
  // Referencias de F001: las de la familia si está congelada; si se abrió una revisión nueva (DRAFT), las de la última
  // revisión archivada, para que el banco siga midiendo sobre las mismas tareas.
  const archived = data.family.status === 'FROZEN' ? null : archivedReferences(root, 'F001');
  const referencesDir = archived ?? CORPUS_REFERENCES(root);
  const hasReference = version => (archived ? existsSync(join(archived, version, 'reference.json')) : Boolean(data.family.reference_versions[version]));
  for (const v of selectedTasks) if (VERSIONS.includes(v) && v !== 'V0' && !hasReference(VERSIONS[VERSIONS.indexOf(v) - 1])) throw new Error(`${v} requiere la referencia congelada previa`);
  const runId = `${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
  const report = { artifact_type: 'local_model_bench', experimental: false, run_id: runId, protocol_version: PROTOCOL_VERSION, image_id: lock.image_id, ollama: ollamaBase(), started_at: new Date().toISOString(), candidates: [] };
  const tags = adapterFactory ? null : await ollama('/api/tags');
  for (const candidate of candidates) {
    const entry = { id: candidate.id, model: candidate.model, context: candidate.context, max_output_tokens: candidate.max_output_tokens, reasoning: candidate.reasoning ?? null, temperature: candidate.temperature, sampling: candidate.sampling ?? null, digest: null, tasks: {} };
    report.candidates.push(entry);
    let policy;
    try {
      if (!adapterFactory) {
        const tag = tags.models?.find(m => m.name === candidate.model);
        if (!tag) { entry.error = 'modelo no descargado en Ollama (ollama pull)'; log(`${candidate.id}: ${entry.error}`); continue; }
        entry.digest = tag.digest;
        entry.quantization = tag.details?.quantization_level ?? null;
        policy = await candidatePolicy(root, candidate, data);
        entry.bytes_per_token = policy.estimator.bytes_per_token;
      }
    } catch (error) { entry.error = error.message; log(`${candidate.id}: ${error.message}`); continue; }
    const modelConfig = { display_name: candidate.model, api_model_id: candidate.model, transport: 'ollama', context: candidate.context, max_output_tokens: candidate.max_output_tokens, reasoning: candidate.reasoning ?? null, temperature: candidate.temperature, seed: candidate.seed, ...(candidate.sampling ? { sampling: candidate.sampling } : {}), digest: entry.digest, keep_alive: candidate.keep_alive };
    for (const version of selectedTasks) {
      const real = REAL_TASK.test(version) ? realTask(root, version.match(REAL_TASK)[1]) : null;
      const store = createTaskStore(root, { mode: 'bench', version: real ? 'V1' : version, ...(real ? { familyId: real.familyId } : {}), taskId: `${runId}-${candidate.id}-${version.replace(':', '-')}` });
      const calls = [], privateRecords = [];
      const adapter = adapterFactory ? adapterFactory({ candidate, version, store, calls }) : createProviderAdapter({ provider: 'local_a', config: modelConfig, contextPolicy: policy, onCall: call => { calls.push(call); store.call(call); } });
      log(`${candidate.id} ${version}: inicio`);
      const started = Date.now();
      let result;
      try {
        result = await runTask({
          mode: 'rehearsal', singleProvider: true, initialProvider: 'local_a', packet: real ? real.packet : makePacket(data, version), policy: real ? real.policy : data.policy,
          adapter: withRetries(adapter, { delays: [2000, 10000, 30000], before: context => store.track(context), onRetry: ({ context, code, wait }) => log(`  ${candidate.id} c${context.cycle}: ${code}; reintento en ${wait / 1000}s`) }),
          workspaces: real ? real.workspaces : sandboxWorkspaces(root, { seed: evolutionSeed(root, version, referencesDir) }),
          evaluator: real ? real.evaluator(record => { privateRecords.push(record); store.private(record); }) : createPipelineEvaluator({ root, version, privateSink: record => { privateRecords.push(record); store.private(record); } }),
          emit: event => store.event(event)
        });
      } catch (error) { entry.tasks[version] = { status: 'INFRA_ERROR', error: error.message }; log(`${candidate.id} ${version}: INFRA_ERROR ${error.message}`); continue; }
      store.finalize(result, real
        ? { packet: real.packet, models: { local_a: modelConfig }, ...real.finalize }
        : { packet: makePacket(data, version), models: { local_a: modelConfig }, stackText: readFileSync(join(root, 'config/stack.json'), 'utf8'), fixtureSha256: data.family.fixture.sha256 });
      entry.tasks[version] = { ...summarize(result, privateRecords, calls), wall_s: Math.round((Date.now() - started) / 1000), logs: store.dir.slice(root.length + 1).split('\\').join('/') };
      const t = entry.tasks[version];
      log(`${candidate.id} ${version}: ${t.status} — ${t.attempts.map(a => `${a.outcome}${a.reason ? `(${a.reason})` : ''}`).join(', ')}; oráculo ${t.oracle_results.join(', ') || '—'}; acciones ${JSON.stringify(t.actions)}`);
    }
    entry.accepted = Object.values(entry.tasks).filter(t => t.status === 'ACCEPTED').length;
  }
  report.finished_at = new Date().toISOString();
  const text = JSON.stringify(report, null, 2) + '\n';
  mkdirSync(join(root, '.artifacts/bench'), { recursive: true });
  writeFileSync(join(root, '.artifacts/bench', `${runId}.json`), text);
  if (!adapterFactory && outputs) {
    mkdirSync(join(root, 'docs/verification/local-bench'), { recursive: true });
    writeFileSync(join(root, 'docs/verification/local-bench', `${runId}.json`), text);
  }
  console.log('\nResumen (tareas aceptadas por candidato):');
  for (const c of report.candidates) console.log(`  ${c.id.padEnd(18)} ${c.error ? `ERROR: ${c.error}` : `${c.accepted}/${Object.keys(c.tasks).length}  ${Object.entries(c.tasks).map(([v, t]) => `${v}:${t.status}${t.oracle_results?.length ? `[${t.oracle_results.at(-1)}]` : ''}`).join(' ')}`}`);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const value = name => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1]?.split(',').filter(Boolean);
  if (args.includes('--list')) {
    const config = JSON.parse(readFileSync(join(root, 'config/local-bench.json'), 'utf8'));
    for (const c of config.candidates) console.log(`${c.id.padEnd(18)} ${c.model.padEnd(20)} ctx ${c.context}  out ${c.max_output_tokens}  ${c.note ?? ''}`);
  } else if (args.some(a => !/^--(models|tasks)=/.test(a))) {
    console.error('Uso: npm run bench:local -- [--models=id,id] [--tasks=V0,V1,V2,V3,S005:V1] | --list');
    process.exitCode = 1;
  } else {
    runBench(root, { models: value('models'), tasks: value('tasks') }).catch(error => { console.error(error.stack); process.exitCode = 1; });
  }
}
