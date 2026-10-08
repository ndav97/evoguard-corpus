// Ejecutor de episodios: línea base y comparación final con las métricas de EvoGenUI-Bench
// (docs/diseno-linea-base-episodios.md, config/experiment.json).
//
// Un episodio es una familia semi-real recorrida por UN modelo, turno a turno, sobre su propia salida:
//   - cada turno usa el motor (runner/execution/engine.mjs) con singleProvider: sin reasignación;
//   - el agente puede ejecutar run_checks (tests visibles), pero el pipeline no repara ni da feedback tras la entrega;
//   - el oráculo (tests ocultos T1..Tt + suite del repositorio) mide el turno y NUNCA se muestra al agente;
//   - el turno siguiente parte del código que dejó el agente (aunque falle). Si no entregó, del código que dejó en
//     el workspace; si no hay snapshot (límite de tiempo), del estado anterior.
// El motor solo ve etapas que no fallan (el resultado real se guarda aparte): así nunca repara ni reasigna.
//
// Uso:
//   node runner/episode/run.mjs plan --phase pilot [--arm B] [--providers a,b] [--families S001,S002]
//   node runner/episode/run.mjs run  --phase pilot --family S001 --provider openai --repetition 1 [--arm B]
//   node runner/episode/run.mjs all  --phase pilot [--arm B] [--providers …] [--families …]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runTask } from '../execution/engine.mjs';
import { createProviderPool } from '../providers/adapter.mjs';
import { credentialsFromEnv } from '../providers/connection.mjs';
import { withRetries } from '../providers/retry.mjs';
import { loadRealFamily, validateRealFamily, makeRealPacket, realVersions, TURN_OF, visibleChecks } from '../real/families.mjs';
import { readBases } from '../real/prepare.mjs';
import { realWorkspaces, createRealEvaluator, runRealOracle, scopeCheck } from '../real/pipeline.mjs';
import { hiddenTestsOf } from '../real/generate.mjs';
import { rehearsalCurrent } from '../real/rehearsal-status.mjs';
import { REAL_PIPELINE_SOURCES } from '../real/sources.mjs';
import { modelBlockers } from '../preflight-models.mjs';
import { docker } from '../sandbox/docker.mjs';
import { execReal } from '../real/docker.mjs';
import { createEpisodeStore, episodeComplete } from './store.mjs';
import { summarizeEpisode, turnPassed, TURN_ID } from './metrics.mjs';
import { loadBudget, turnCost, budgetBlocker } from './budget.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);
export const RING = ['openai', 'anthropic', 'google', 'local_a', 'local_b'];
export const loadExperiment = root => JSON.parse(readFileSync(join(root, 'config/experiment.json'), 'utf8'));

// Código que ejecuta los episodios: si cambia, hay que repetir su ensayo (episode:rehearse). Las métricas y la
// configuración de fases no cambian lo que se ejecuta ni lo que se registra, así que no forman parte.
export const EPISODE_SOURCES = ['runner/episode/run.mjs', 'runner/episode/store.mjs', 'runner/episode/budget.mjs', ...REAL_PIPELINE_SOURCES];
export const episodeFingerprint = root => Object.fromEntries(EPISODE_SOURCES.map(path => [path, sha(readFileSync(join(root, path)))]));
const CODE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Huella del código y de los modelos con que se produjo cada registro: el análisis avisa si se mezclan versiones.
export const provenance = () => ({
  code_sha256: sha(JSON.stringify(episodeFingerprint(CODE_ROOT))),
  models_sha256: sha(readFileSync(join(CODE_ROOT, 'config/models.json')))
});

// Parche del workspace respecto de la BASE del turno (no de HEAD): si el agente hace su propio commit, reset o
// checkout, su trabajo sigue contando. Primera línea: {head, bytes, oversize}; después, el parche si cabe.
const SNAPSHOT_FROM_BASE = `const {execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const [base,limit]=[process.argv[1],Number(process.argv[2])];
const idx=path.join(os.tmpdir(),'evoguard-index-'+process.pid);const own=execFileSync('git',['rev-parse','--git-path','index'],{encoding:'utf8'}).trim();
if(fs.existsSync(own))fs.copyFileSync(own,idx);const env={...process.env,GIT_INDEX_FILE:idx};
try{execFileSync('git',['add','--all'],{env});const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const diff=execFileSync('git',['diff','--cached','--binary','--no-ext-diff',base],{env,maxBuffer:256*1024*1024});
const oversize=diff.length>limit;process.stdout.write(JSON.stringify({head,bytes:diff.length,oversize})+'\\n');if(!oversize)process.stdout.write(diff);}
finally{fs.rmSync(idx,{force:true});}`;
export const SNAPSHOT_LIMIT = 12 * 1024 * 1024;

// Envuelve los workspaces del estrato semi-real para el episodio:
//   snapshot(): parche respecto de la base del turno (con aviso si el agente movió HEAD o si el parche es enorme);
//   commit():   vuelve HEAD a la base (reset --soft, conserva el trabajo) y hace el commit determinista del motor,
//               de modo que el turno siguiente lo reproduce por hash con applySteps.
// last() devuelve el estado del último workspace abierto (un solo intento por turno con singleProvider).
export function episodeWorkspaces(inner, { exec = execReal, limit = SNAPSHOT_LIMIT } = {}) {
  let state = null;
  return {
    last: () => state,
    async open() {
      const ws = await inner.open();
      const baseline = ws.initialization?.baseline_commit;
      if (!/^[a-f0-9]{40}$/.test(baseline ?? '')) throw new Error('Workspace sin commit base');
      const own = { head_moved: false, oversize: false, bytes: null };
      state = own;
      return {
        ...ws,
        episodeState: own,
        async snapshot({ timeout = 120000 } = {}) {
          const out = exec(ws.session, ['node', '-e', SNAPSHOT_FROM_BASE, baseline, String(limit)], { raw: true, timeout });
          const newline = out.indexOf('\n');
          const header = JSON.parse(out.slice(0, newline));
          if (header.head !== baseline) own.head_moved = true;
          own.bytes = header.bytes;
          if (header.oversize) { own.oversize = true; return ''; }
          return out.slice(newline + 1);
        },
        async commit(message, options = {}) {
          const head = exec(ws.session, ['git', 'rev-parse', 'HEAD'], { timeout: 60000 }).trim();
          if (head !== baseline) { own.head_moved = true; exec(ws.session, ['git', 'reset', '-q', '--soft', baseline], { timeout: 60000 }); }
          return ws.commit(message, options);
        }
      };
    }
  };
}

const dockerHealthy = () => { try { docker(['info', '--format', '{{.ServerVersion}}'], { timeout: 60000 }); return true; } catch { return false; } };
// Resultado de un turno que no se pudo medir por culpa del código del agente: todo falla.
export const failAll = (position, cause) => ({ status: 'FAIL', cause, requirements: Object.fromEntries(Array.from({ length: position }, (_, i) => [TURN_ID(i + 1), false])), suite_ok: false, suite_failing: null, suite_broken: null, seconds: null });

// Oráculo con distinción entre infraestructura y código del agente: si la suite agota su tiempo, se repite una vez;
// si vuelve a agotarlo con Docker respondiendo, el turno falla por el código (bucle, test que no termina…).
export async function measureOracle(deps, args, position) {
  let report;
  for (let attempt = 1; attempt <= 2; attempt++) {
    report = await deps.runRealOracle(args);
    const summary = summarizeOracle(report, position);
    if (!(summary.status === 'INFRA_ERROR' && summary.error === 'TIMEOUT')) return { report, summary };
    if (!(deps.dockerHealthy ?? dockerHealthy)()) return { report, summary };
  }
  return { report, summary: failAll(position, 'oracle_timeout') };
}

// Paquete del turno según el brazo. B: el paquete textual del estrato semi-real, sin añadidos.
export function armPacket(arm, packet) {
  if (arm === 'B') return packet;
  throw new Error(`Brazo ${arm} pendiente: necesita la guía de EvoGuard UI (OE2–OE4)`);
}

// Informe del oráculo → estado de los requisitos T1..Tt y de la suite.
// SIN_INFORME (la suite no produjo informe con el código del agente) cuenta como fallo de todo, no como infraestructura.
export function summarizeOracle(report, position) {
  const run = report?.runs?.[0];
  if (!run || (run.error && run.error !== 'SIN_INFORME')) return { status: 'INFRA_ERROR', error: run?.error ?? 'sin ejecución' };
  const ids = Array.from({ length: position }, (_, i) => TURN_ID(i + 1));
  if (run.error === 'SIN_INFORME') return { ...failAll(position, 'no_report'), seconds: run.seconds ?? null };
  const requirements = Object.fromEntries(ids.map(id => {
    const t = run.hidden?.[id];
    return [id, Boolean(t && t.tests > 0 && !t.failing.length && !t.compile_error)];
  }));
  return {
    status: report.status, requirements,
    suite_ok: !(run.suite_failing?.length) && !(run.suite_broken?.length),
    suite_failing: run.suite_failing?.length ?? 0, suite_broken: run.suite_broken?.length ?? 0,
    hidden_failing: Object.fromEntries(ids.map(id => [id, run.hidden?.[id]?.failing?.length ?? null])),
    seconds: run.seconds ?? null
  };
}

const realDeps = { runTask, realWorkspaces, createRealEvaluator, runRealOracle, scopeCheck, execIn: execReal, dockerHealthy: () => dockerHealthy() };

// Evaluador del episodio para el motor: ejecuta el oráculo y el control de alcance, guarda el resultado real en
// `captured` y devuelve al motor estados que no provocan reparación ni reasignación.
export function episodeEvaluator({ image, manifest, steps, v0Commit, version, hiddenTests, captured, privateSink, deps = realDeps }) {
  const real = deps.createRealEvaluator({ image, manifest, steps, v0Commit, version, hiddenTests, privateSink });
  const position = realVersions(manifest).indexOf(version) + 1;
  const stages = {
    async typecheck(workspace, options) {
      if (!visibleChecks(manifest).typecheck) { captured.typecheck = 'NOT_APPLICABLE'; return { status: 'NOT_APPLICABLE' }; }
      const result = await real.check('typecheck', workspace, options);
      captured.typecheck = result.status;
      await privateSink({ stage: 'typecheck', status: result.status });
      return { status: result.status === 'INFRA_ERROR' ? 'INFRA_ERROR' : 'PASS' };
    },
    async independent_oracle(workspace) {
      const patch = await workspace.snapshot({ timeout: 120000 });
      if (workspace.episodeState?.oversize) {
        captured.oracle = failAll(position, 'patch_oversize');
        await privateSink({ stage: 'independent_oracle', status: 'FAIL', cause: 'patch_oversize', bytes: workspace.episodeState.bytes });
        return { status: 'PASS' };
      }
      const { report, summary } = await measureOracle(deps, { image, manifest, steps, v0Commit, patch, hiddenTests, version, runs: 1 }, position);
      captured.oracle = summary;
      await privateSink({ stage: 'independent_oracle', status: report.status, report, cause: summary.cause });
      return { status: summary.status === 'INFRA_ERROR' ? 'INFRA_ERROR' : 'PASS' };
    },
    async architecture(workspace) {
      const patch = await workspace.snapshot({ timeout: 120000 });
      captured.scope = deps.scopeCheck(patch, { manifest, existingTests: workspace.existingTests ?? new Set() });
      await privateSink({ stage: 'architecture', status: captured.scope.length ? 'FAIL' : 'PASS', report: { violations: captured.scope } });
      return { status: 'PASS' };
    }
  };
  return {
    async check(stage, workspace, options = {}) {
      if (stage === 'build' || stage === 'development_tests') return { status: 'NOT_APPLICABLE' };
      if (!stages[stage]) throw new Error(`Etapa desconocida: ${stage}`);
      // Cualquier excepción del evaluador es infraestructura explícita (el episodio se repite), nunca un TIMEOUT
      // que el motor atribuiría al modelo.
      try { return await stages[stage](workspace, options); }
      catch (error) {
        captured.evaluator_error = `${stage}: ${error.message.slice(0, 500)}`;
        await privateSink({ stage, infra_error: error.message.slice(0, 2000) });
        return { status: 'INFRA_ERROR' };
      }
    }
  };
}

// Tokens de las llamadas que los informan (las fallidas y reintentadas no los tienen; se cuentan aparte).
const sumTokens = (calls, key) => { const known = calls.filter(c => Number.isFinite(c.tokens?.[key])); return known.length ? known.reduce((t, c) => t + c.tokens[key], 0) : null; };

// Ejecuta un episodio completo. adapterFor({ turn, version }) devuelve el adaptador del turno (modelo real o guion).
export async function runEpisode({ root, data, base, provider, arm = 'B', experiment, phase, episode = 1, repetition = 1, rehearsal = false, adapterFor, deps = realDeps, say = log }) {
  if (!RING.includes(provider)) throw new Error(`Proveedor desconocido: ${provider}`);
  const m = data.manifest;
  const versions = realVersions(m);
  const hiddenTests = hiddenTestsOf(data);
  const spec = { experiment, arm, provider, familyId: data.familyId, episode, repetition, rehearsal };
  const store = createEpisodeStore(root, spec);
  const steps = [];
  const records = [];
  const origin = provenance();
  const budget = loadBudget(CODE_ROOT);
  const common = { schema_version: '1.0.0', artifact_type: 'episode_turn', experiment, phase, arm, provider, family_id: data.familyId, episode, repetition, turns_total: versions.length, rehearsal, ...origin };
  say(`${data.familyId} · ${provider} · brazo ${arm} · e${episode}-r${repetition}: ${versions.length} turnos`);
  let status = 'COMPLETE';
  for (const [index, version] of versions.entries()) {
    const turnId = TURN_OF[version];
    const ts = store.turn(turnId);
    const captured = {};
    const packet = armPacket(arm, makeRealPacket(data, version));
    const started = new Date().toISOString();
    const evaluator = episodeEvaluator({ image: base.image_id, manifest: m, steps: [...steps], v0Commit: base.v0_repo_commit, version, hiddenTests, captured, privateSink: record => ts.private(record), deps });
    const workspaces = episodeWorkspaces(deps.realWorkspaces({ image: base.image_id, manifest: m, steps: [...steps], v0Commit: base.v0_repo_commit }), { exec: deps.execIn ?? execReal });
    const result = await deps.runTask({
      mode: 'rehearsal', singleProvider: true, initialProvider: provider, packet, policy: data.policy,
      adapter: adapterFor({ turn: ts, version, position: index + 1 }),
      workspaces, evaluator, emit: event => ts.event(event)
    });
    const row = result.attempts[0];
    const wsState = workspaces.last() ?? {};
    const delivered = row?.outcome === 'ACCEPTED';
    // Parche enorme: no se puede reproducir; el turno falla y el siguiente parte del estado anterior.
    const patch = !wsState.oversize && typeof row?.snapshot === 'string' ? row.snapshot : '';
    // Infraestructura: no se pudo abrir el workspace (sin intento), el intento terminó en INFRA_ERROR (Docker,
    // oráculo) o el evaluador lanzó una excepción. Un fallo al cerrar el contenedor tras un intento válido no
    // invalida el turno.
    let infra = !row || row.outcome === 'INFRA_ERROR' || Boolean(captured.evaluator_error);
    // Sin entrega: se mide igualmente el código que hereda el turno siguiente.
    if (!infra && !captured.oracle) {
      if (wsState.oversize) captured.oracle = failAll(index + 1, 'patch_oversize');
      else {
        try {
          const { report, summary } = await measureOracle(deps, { image: base.image_id, manifest: m, steps: [...steps], v0Commit: base.v0_repo_commit, patch, hiddenTests, version, runs: 1 }, index + 1);
          captured.oracle = summary;
          ts.private({ stage: 'independent_oracle', status: report.status, report, cause: summary.cause, after: 'sin_entrega' });
        } catch (error) { captured.oracle = { status: 'INFRA_ERROR', error: error.message.slice(0, 500) }; }
      }
    }
    if (captured.oracle?.status === 'INFRA_ERROR') infra = true;
    const modelErrors = ts.events.filter(e => e.type === 'model_output_error').length;
    const record = {
      ...common, turn: turnId, version, position: index + 1,
      delivered, outcome: row?.outcome ?? null, failure_reason: row?.reason ?? null, infra_error: infra || undefined,
      scope_ok: captured.scope ? captured.scope.length === 0 : null, scope_violations: captured.scope ?? null,
      typecheck: captured.typecheck ?? (visibleChecks(m).typecheck ? null : 'NOT_APPLICABLE'),
      oracle: captured.oracle ?? null,
      cycles: row?.cycles ?? null, duration_seconds: Number.isFinite(row?.duration_ms) ? row.duration_ms / 1000 : null,
      model_output_errors: modelErrors,
      head_moved: wsState.head_moved ?? null, patch_oversize: wsState.oversize ?? null, evaluator_error: captured.evaluator_error ?? null,
      calls: ts.calls.length, calls_without_tokens: ts.calls.filter(c => !Number.isFinite(c.tokens?.input)).length,
      transport_retries: ts.retries.length, transport_retry_wait_seconds: ts.retries.reduce((t, r) => t + r.wait / 1000, 0),
      observed_models: [...new Set(ts.calls.map(c => c.observed_model).filter(Boolean))],
      tokens: { input: sumTokens(ts.calls, 'input'), output: sumTokens(ts.calls, 'output'), reasoning: sumTokens(ts.calls, 'reasoning'), cached: sumTokens(ts.calls, 'cached') },
      base_commit: row?.base_commit ?? null, candidate_commit: row?.candidate_commit ?? null,
      patch_sha256: sha(patch), patch_bytes: Buffer.byteLength(patch),
      started_at: started, finished_at: new Date().toISOString()
    };
    // Costo real del turno (tokens × precios de config/experiment.json); los locales cuentan como horas de GPU.
    const cost = turnCost(ts.calls, provider, budget);
    record.cost_usd = cost.usd; record.cost_unknown_calls = cost.unknown_calls;
    record.passed = turnPassed(record);
    // El motor solo vio etapas enmascaradas (nunca FAIL): el resultado real del turno queda también en los eventos.
    ts.event({ type: 'episode_evaluation', note: 'resultado real del turno; las etapas del motor están enmascaradas para que no repare ni reasigne', passed: record.passed, delivered, scope_ok: record.scope_ok, typecheck: record.typecheck, requirements: record.oracle?.requirements ?? null, suite_ok: record.oracle?.suite_ok ?? null, cause: record.oracle?.cause ?? null, infra_error: infra });
    ts.patch(patch);
    ts.finish(record);
    records.push(record);
    say(`  ${turnId}: ${infra ? 'ERROR DE INFRAESTRUCTURA' : `${record.passed ? 'APROBADO' : 'no aprobado'} (${delivered ? 'entregó' : `sin entrega: ${record.failure_reason}`}${record.oracle ? `; requisitos ${Object.entries(record.oracle.requirements ?? {}).map(([k, v]) => `${k}${v ? '✓' : '✗'}`).join(' ')}; suite ${record.oracle.suite_ok ? '✓' : '✗'}` : ''})`}`);
    if (infra) { status = 'INFRA_ERROR'; break; }
    // El turno siguiente parte del código que dejó el agente; el commit del motor (si entregó) se reproduce por hash.
    steps.push({ version, patch, message: `reference: ${version}`, base: row.base_commit ?? undefined, expect: delivered && !wsState.oversize ? row.candidate_commit ?? undefined : undefined });
  }
  const summary = summarizeEpisode(records);
  const episodeRecord = {
    schema_version: '1.0.0', artifact_type: 'episode', experiment, phase, arm, provider, family_id: data.familyId, episode, repetition, rehearsal,
    status, image_id: base.image_id, v0_commit: base.v0_repo_commit, turns_total: versions.length, ...origin,
    passes: summary.passes ?? null, success: summary.success ?? null, cpt: summary.cpt ?? null, regression: summary.regression ?? null,
    problems: summary.problems, finished_at: new Date().toISOString()
  };
  if (status === 'COMPLETE') store.finish(episodeRecord);
  say(`${data.familyId} · ${provider}: ${status === 'COMPLETE' ? `${summary.success ? 'EPISODIO EXITOSO' : 'episodio no exitoso'} (aprobados ${summary.passes.map(p => (p ? 1 : 0)).join('')}, CPT ${summary.cpt}${summary.regression ? ', con regresión' : ''})` : 'interrumpido por infraestructura; se repetirá'}`);
  return { status, records, summary, dir: store.dir };
}

// Bloqueos antes de medir con modelos reales.
export function episodeBlockers(root, familyId, { providers = RING, checkImage = true } = {}) {
  const blockers = [];
  const data = loadRealFamily(root, familyId);
  blockers.push(...validateRealFamily(data, root).filter(e => !/sin calibrar/.test(e)).map(e => `${familyId}: ${e}`));
  if (data.manifest.provenance.status !== 'CALIBRATED') blockers.push(`${familyId}: familia sin calibrar`);
  const base = readBases(root).bases[familyId];
  if (!base || base.status !== 'VERIFIED') blockers.push(`${familyId}: imagen sin preparar o sin verificar`);
  else if (checkImage) { try { docker(['image', 'inspect', base.image_id]); } catch { blockers.push(`${familyId}: la imagen no existe en este Docker`); } }
  const family = rehearsalCurrent(root, familyId);
  if (!family.current) blockers.push(`${familyId}: ensayo de la familia no vigente (${family.reason}); scripts\\real\\ensayar-familias.cmd`);
  const mini = rehearsalCurrent(root, '--mini');
  if (!mini.current) blockers.push(`Ensayo general del pipeline no vigente (${mini.reason})`);
  const evidencePath = join(root, 'docs/verification/episode-rehearsal.json');
  if (!existsSync(evidencePath)) blockers.push('Falta el ensayo del ejecutor de episodios: npm run episode:rehearse -- S001');
  else {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    const current = episodeFingerprint(root);
    const changed = Object.keys(current).filter(p => evidence.sources_sha256?.[p] !== current[p]);
    if (evidence.status !== 'PASS') blockers.push('El ensayo del ejecutor de episodios no pasó');
    if (changed.length) blockers.push(`Cambió código del ejecutor de episodios (${changed.join(', ')}); repetir npm run episode:rehearse`);
  }
  blockers.push(...modelBlockers(root, providers));
  return blockers;
}

// Episodios de una fase, en orden: repetición → proveedor → familia (mantiene caliente el modelo local).
export function planEpisodes(root, { phase = 'pilot', arm = 'B', providers, families, rehearsal = false } = {}) {
  const config = loadExperiment(root).phases[phase];
  if (!config) throw new Error(`Fase desconocida: ${phase}`);
  if (!config.arms.includes(arm)) throw new Error(`El brazo ${arm} no forma parte de la fase ${phase}`);
  if (!Array.isArray(config.families)) throw new Error(`La fase ${phase} aún no tiene familias asignadas`);
  const list = [];
  for (let repetition = 1; repetition <= config.repetitions; repetition++)
    for (const provider of providers ?? config.providers)
      for (const familyId of families ?? config.families)
        for (let episode = 1; episode <= config.episodes_per_family; episode++) {
          const spec = { experiment: config.experiment, arm, provider, familyId, episode, repetition, rehearsal };
          list.push({ ...spec, phase, done: episodeComplete(root, spec) });
        }
  return list;
}

function modelAdapterFactory(root, provider) {
  const models = JSON.parse(readFileSync(join(root, 'config/models.json'), 'utf8')).models;
  const credentials = credentialsFromEnv(models, process.env);
  if (!provider.startsWith('local_') && !credentials[provider]) throw new Error(`Faltan credenciales de ${provider} (usar .env con SYNTEROLINK_API_KEY)`);
  return ({ turn }) => withRetries(createProviderPool({ models, credentials, onCall: call => turn.call(call) }), {
    before: context => turn.track(context),
    onRetry: ({ context, code, wait, retry }) => { turn.retry({ cycle: context.cycle, code, wait, retry }); log(`  ${context.provider} c${context.cycle}: ${code}; reintento en ${wait / 1000}s`); }
  });
}

// Error previo al episodio (configuración, preflight, credenciales): repetir no sirve. El lanzador lo reconoce.
export const NOT_STARTED = 'EPISODIO NO INICIADO';
const notStarted = message => Object.assign(new Error(`${NOT_STARTED}: ${message}`), { notStarted: true });

export async function runOne(root, { phase, arm = 'B', familyId, provider, episode = 1, repetition }) {
  let config, data, adapterFor;
  try {
    config = loadExperiment(root).phases[phase];
    if (!config) throw new Error(`fase desconocida: ${phase}`);
    if (!config.arms.includes(arm)) throw new Error(`el brazo ${arm} no forma parte de la fase ${phase}`);
    armPacket(arm, {});
    const blockers = episodeBlockers(root, familyId, { providers: [provider] });
    // Tope de gasto (S/ 5 000 menos la reserva): no se inicia un episodio que pudiera superarlo.
    const overBudget = budgetBlocker(root, provider, config.turns);
    if (overBudget) blockers.push(overBudget);
    if (blockers.length) throw new Error('el episodio está bloqueado:\n' + blockers.map(b => `- ${b}`).join('\n'));
    data = loadRealFamily(root, familyId);
    if (realVersions(data.manifest).length !== config.turns) throw new Error(`${familyId} tiene ${realVersions(data.manifest).length} turnos y la fase ${phase} pide ${config.turns}`);
    adapterFor = modelAdapterFactory(root, provider);
  } catch (error) { throw error.notStarted ? error : notStarted(error.message); }
  const base = readBases(root).bases[familyId];
  return runEpisode({ root, data, base, provider, arm, experiment: config.experiment, phase, episode, repetition, adapterFor });
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    if (!key || rest[i + 1] === undefined) throw new Error(`Argumento incompleto: ${rest[i]}`);
    options[key] = rest[i + 1];
  }
  const list = value => (value ? value.split(',').map(s => s.trim()).filter(Boolean) : undefined);
  return { command, phase: options.phase ?? 'pilot', arm: options.arm ?? 'B', providers: list(options.providers), families: list(options.families), familyId: options.family, provider: options.provider, repetition: options.repetition ? Number(options.repetition) : undefined, episode: options.episode ? Number(options.episode) : 1 };
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'plan') {
    let plan;
    try { plan = planEpisodes(root, args); } catch (error) { throw notStarted(error.message); }
    for (const e of plan.filter(e => !e.done)) console.log(`${e.familyId} ${e.provider} ${e.repetition} ${e.episode}`);
    console.error(`${plan.filter(e => e.done).length} de ${plan.length} episodios completos.`);
    return;
  }
  if (args.command === 'run') {
    if (!args.familyId || !args.provider || !args.repetition) throw new Error('Uso: run --phase pilot --family Sxxx --provider p --repetition n [--episode n] [--arm B]');
    const { status } = await runOne(root, args);
    process.exitCode = status === 'COMPLETE' ? 0 : 3;
    return;
  }
  if (args.command === 'all') {
    for (const e of planEpisodes(root, args).filter(e => !e.done)) {
      const { status } = await runOne(root, { ...args, familyId: e.familyId, provider: e.provider, repetition: e.repetition, episode: e.episode });
      if (status !== 'COMPLETE') { log('Detenido por un error de infraestructura.'); process.exitCode = 3; return; }
    }
    return;
  }
  throw new Error('Uso: node runner/episode/run.mjs plan|run|all --phase pilot …');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(error => { console.error(error.message); process.exitCode = 1; });
