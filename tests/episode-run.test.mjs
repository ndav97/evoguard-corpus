// Ejecutor de episodios (runner/episode/run.mjs) con dobles del motor, los contenedores y el oráculo.
// El «código» del agente se modela como el conjunto de requisitos que cumple: cada parche es "state:T001,T002"
// (estado completo tras el turno); un parche vacío no cambia nada; BROKEN rompe la suite; SCOPE viola el alcance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEpisode, summarizeOracle, armPacket, planEpisodes, episodeEvaluator, episodeWorkspaces, measureOracle, failAll } from '../runner/episode/run.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const policy = JSON.parse(readFileSync(join(repoRoot, 'config/policy.json'), 'utf8'));
const TURNS = ['T001', 'T002', 'T003'];
const data = {
  familyId: 'S900', familyDir: 'families-real/S900-x', policy, prompt: 'prompt',
  manifest: { id: 'S900', package_path: 'app', focus: 'app/src/a.tsx', runner: 'vitest', package_manager: 'npm', hidden_tests_dir: 'src/evoguard', known_failures: [], turns: TURNS.map(id => ({ id })) },
  turns: TURNS.map(id => ({ id, request: `turns/${id}.md`, requestText: `Petición ${id}`, hidden_tests: `oracle/${id}.test.tsx`, hiddenTestsText: `test ${id}` }))
};
const base = { image_id: 'sha256:' + 'a'.repeat(64), v0_repo_commit: 'b'.repeat(40) };

const stateOf = patches => {
  const last = [...patches].reverse().find(p => p);
  return last ? last.replace(/^state:/, '').split(',').filter(Boolean) : [];
};

// script[t] = { outcome: 'ACCEPTED' | 'REASSIGN' | 'INFRA_ERROR', reason, patch (string o null) }
function harness(script) {
  const calls = { workspaces: [], oracle: [], adapters: 0 };
  const deps = {
    createRealEvaluator: () => ({ async check() { return { status: 'NOT_APPLICABLE' }; } }),
    dockerHealthy: () => true,
    realWorkspaces: ({ steps }) => { calls.workspaces.push(steps); return { async open() { throw new Error('no se abre en el doble'); } }; },
    scopeCheck: patch => (patch.includes('SCOPE') ? [{ rule: 'alcance', detail: 'x' }] : []),
    async runRealOracle({ steps, patch, version }) {
      calls.oracle.push({ version, patch, steps: steps.length });
      const state = stateOf([...steps.map(s => s.patch), patch]);
      const n = Number(version.slice(1));
      const hidden = Object.fromEntries(TURNS.slice(0, n).map(id => [id, { tests: 2, failing: state.includes(id) ? [] : ['falla'], compile_error: false }]));
      const broken = state.includes('BROKEN');
      return { status: 'FAIL', runs: [{ seconds: 1, hidden, suite_failing: broken ? ['x'] : [], suite_broken: [] }] };
    },
    async runTask(options) {
      const step = script[options.packet.version];
      options.emit({ type: 'assignment', provider: options.initialProvider });
      if (step.outcome === 'INFRA_ERROR') return { status: 'INFRA_ERROR', attempts: [{ outcome: 'INFRA_ERROR', reason: 'INFRA_ERROR', cycles: 1 }] };
      const row = { outcome: step.outcome, reason: step.reason ?? null, snapshot: step.patch, base_commit: `base-${options.packet.version}`, candidate_commit: step.outcome === 'ACCEPTED' ? `cand-${options.packet.version}` : null, cycles: 4, duration_ms: 2000 };
      if (step.outcome === 'ACCEPTED') {
        const workspace = { snapshot: async () => step.patch, existingTests: new Set() };
        for (const stage of ['typecheck', 'build', 'development_tests', 'independent_oracle', 'architecture']) {
          const r = await options.evaluator.check(stage, workspace, {});
          assert.ok(['PASS', 'NOT_APPLICABLE'].includes(r.status), `el motor nunca ve un fallo (${stage}: ${r.status})`);
        }
      }
      return { status: step.outcome === 'ACCEPTED' ? 'ACCEPTED' : 'BLOCKED', attempts: [row] };
    }
  };
  return { deps, calls };
}

const run = async (script, extra = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'episodio-'));
  const h = harness(script);
  const result = await runEpisode({ root, data, base, provider: 'openai', experiment: 'prueba', phase: 'pilot', repetition: 1, adapterFor: () => { h.calls.adapters++; return { next() {} }; }, deps: h.deps, say: () => {}, ...extra });
  return { root, result, ...h };
};

test('episodio ideal: tres turnos aprobados, encadenados sobre la salida propia y registros completos', async () => {
  const { root, result, calls } = await run({ V1: { outcome: 'ACCEPTED', patch: 'state:T001' }, V2: { outcome: 'ACCEPTED', patch: 'state:T001,T002' }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } });
  assert.equal(result.status, 'COMPLETE');
  assert.deepEqual(result.summary.passes, [true, true, true]);
  assert.equal(result.summary.success, true);
  assert.equal(calls.adapters, 3);
  // Cada turno parte de los parches anteriores del propio agente, con el commit del motor verificado por hash.
  assert.deepEqual(calls.workspaces.map(s => s.length), [0, 1, 2]);
  assert.deepEqual(calls.workspaces[2].map(s => [s.version, s.message, s.base, s.expect]), [['V1', 'reference: V1', 'base-V1', 'cand-V1'], ['V2', 'reference: V2', 'base-V2', 'cand-V2']]);
  const dir = join(root, 'runs/episodes/prueba/B/openai/S900/e1-r1');
  assert.deepEqual(readdirSync(dir).sort(), ['T001', 'T002', 'T003', 'episode.json']);
  for (const t of TURNS) assert.deepEqual(readdirSync(join(dir, t)).sort(), ['events.jsonl', 'patch.diff', 'turn.json']);
  const episode = JSON.parse(readFileSync(join(dir, 'episode.json'), 'utf8'));
  assert.equal(episode.success, true); assert.equal(episode.cpt, 3);
  const t2 = JSON.parse(readFileSync(join(dir, 'T002/turn.json'), 'utf8'));
  assert.deepEqual(t2.oracle.requirements, { T001: true, T002: true });
  assert.equal(t2.passed, true); assert.equal(t2.scope_ok, true);
  assert.ok(existsSync(join(root, 'evaluator/episodes/prueba/B/openai/S900/e1-r1/T002.jsonl')), 'informe privado del oráculo');
  rmSync(root, { recursive: true, force: true });
});

test('sin entrega: el turno falla, se mide el código que hereda el siguiente y el episodio continúa', async () => {
  const { result, calls } = await run({ V1: { outcome: 'ACCEPTED', patch: 'state:T001' }, V2: { outcome: 'REASSIGN', reason: 'CYCLE_LIMIT', patch: '' }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } });
  assert.deepEqual(result.summary.passes, [true, false, true]);
  assert.equal(result.summary.turns[1].failure, 'not_delivered');
  assert.equal(result.summary.regression, false);
  assert.equal(result.records[1].delivered, false);
  assert.ok(calls.oracle.some(o => o.version === 'V2' && o.patch === ''), 'oráculo fuera del motor para el turno sin entrega');
  assert.equal(calls.workspaces[2][1].expect, undefined, 'sin commit del motor que verificar');
});

test('límite de tiempo sin snapshot: el siguiente turno parte del estado anterior', async () => {
  const { result, calls } = await run({ V1: { outcome: 'ACCEPTED', patch: 'state:T001' }, V2: { outcome: 'REASSIGN', reason: 'TIMEOUT', patch: null }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } });
  assert.equal(result.records[1].failure_reason, 'TIMEOUT');
  assert.equal(calls.workspaces[2][1].patch, '');
  assert.deepEqual(result.records[1].oracle.requirements, { T001: true, T002: false });
});

test('regresión: el turno 2 rompe T001 y el episodio la registra', async () => {
  const { result } = await run({ V1: { outcome: 'ACCEPTED', patch: 'state:T001' }, V2: { outcome: 'ACCEPTED', patch: 'state:T002' }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } });
  assert.deepEqual(result.summary.passes, [true, false, true]);
  assert.equal(result.summary.turns[1].failure, 'regression');
  assert.deepEqual(result.summary.turns[1].broken, ['T001']);
  assert.equal(result.summary.regression, true);
});

test('suite rota y alcance violado no aprueban el turno', async () => {
  const { result } = await run({ V1: { outcome: 'ACCEPTED', patch: 'state:T001,BROKEN' }, V2: { outcome: 'ACCEPTED', patch: 'state:T001,T002,SCOPE' }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } });
  assert.deepEqual(result.summary.passes, [false, false, true]);
  assert.equal(result.records[0].oracle.suite_ok, false);
  assert.equal(result.records[1].scope_ok, false);
});

test('error de infraestructura: el episodio se interrumpe sin episode.json y al repetirse se conserva lo anterior aparte', async () => {
  const script = { V1: { outcome: 'ACCEPTED', patch: 'state:T001' }, V2: { outcome: 'INFRA_ERROR' }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } };
  const { root, result } = await run(script);
  assert.equal(result.status, 'INFRA_ERROR');
  assert.equal(result.records.length, 2);
  const dir = join(root, 'runs/episodes/prueba/B/openai/S900/e1-r1');
  assert.ok(!existsSync(join(dir, 'episode.json')));
  const h = harness({ ...script, V2: { outcome: 'ACCEPTED', patch: 'state:T001,T002' } });
  const again = await runEpisode({ root, data, base, provider: 'openai', experiment: 'prueba', phase: 'pilot', repetition: 1, adapterFor: () => ({ next() {} }), deps: h.deps, say: () => {} });
  assert.equal(again.status, 'COMPLETE');
  assert.ok(readdirSync(join(root, 'runs/episodes/prueba/B/openai/S900')).some(name => /^e1-r1\.incompleto-\d+$/.test(name)));
  rmSync(root, { recursive: true, force: true });
});

test('informe del oráculo: sin informe es fallo de todo; un TIMEOUT es infraestructura', () => {
  assert.deepEqual(summarizeOracle({ status: 'INFRA_ERROR', runs: [{ error: 'SIN_INFORME', seconds: 3 }] }, 2).requirements, { T001: false, T002: false });
  assert.equal(summarizeOracle({ status: 'INFRA_ERROR', runs: [{ error: 'SIN_INFORME' }] }, 2).suite_ok, false);
  assert.equal(summarizeOracle({ status: 'INFRA_ERROR', runs: [{ error: 'TIMEOUT' }] }, 2).status, 'INFRA_ERROR');
  const ok = summarizeOracle({ status: 'FAIL', runs: [{ hidden: { T001: { tests: 1, failing: [], compile_error: false }, T002: { tests: 0, failing: [], compile_error: false } }, suite_failing: [], suite_broken: [] }] }, 2);
  assert.deepEqual(ok.requirements, { T001: true, T002: false }, 'sin tests ejecutados no cuenta como cumplido');
});

test('el evaluador del episodio nunca devuelve FAIL al motor', async () => {
  const captured = {};
  const h = harness({});
  const evaluator = episodeEvaluator({ image: base.image_id, manifest: data.manifest, steps: [], v0Commit: base.v0_repo_commit, version: 'V2', hiddenTests: [], captured, privateSink: () => {}, deps: h.deps });
  const ws = { snapshot: async () => 'state:SCOPE', existingTests: new Set() };
  assert.equal((await evaluator.check('independent_oracle', ws)).status, 'PASS');
  assert.equal((await evaluator.check('architecture', ws)).status, 'PASS');
  assert.deepEqual(captured.oracle.requirements, { T001: false, T002: false });
  assert.equal(captured.scope.length, 1);
});

test('solo el brazo B está disponible hasta tener EvoGuard UI', () => {
  assert.deepEqual(armPacket('B', { a: 1 }), { a: 1 });
  assert.throws(() => armPacket('E', {}), /pendiente/);
});

test('plan del piloto: 300 turnos = 100 episodios (1 repetición), en orden repetición → proveedor → familia', () => {
  const plan = planEpisodes(repoRoot, { phase: 'pilot' });
  assert.equal(plan.length, 100);
  assert.deepEqual(plan.slice(0, 2).map(e => `${e.repetition}:${e.provider}:${e.familyId}`), ['1:openai:S001', '1:openai:S002']);
  assert.deepEqual(plan[20], { ...plan[20], repetition: 1, provider: 'anthropic', familyId: 'S001' });
  assert.equal(plan.at(-1).repetition, 1);
  assert.equal(plan.at(-1).provider, 'local_b');
  assert.throws(() => planEpisodes(repoRoot, { phase: 'pilot', arm: 'E' }), /no forma parte/);
});

test('workspace del episodio: parche respecto de la base aunque el agente mueva HEAD, y commit sobre la base', async () => {
  const baseline = 'a'.repeat(40);
  const calls = [];
  let head = 'f'.repeat(40);
  const exec = (_session, argv) => {
    calls.push(argv.slice(0, 3).join(' '));
    if (argv[0] === 'node') return JSON.stringify({ head, bytes: 9, oversize: false }) + '\ndiff --git x';
    if (argv[1] === 'rev-parse') return head + '\n';
    if (argv[1] === 'reset') { head = baseline; return ''; }
    throw new Error('inesperado');
  };
  const inner = { async open() { return { session: {}, initialization: { baseline_commit: baseline }, existingTests: new Set(['t']), async commit() { assert.equal(head, baseline, 'commit tras volver a la base'); return 'c'.repeat(40); } }; } };
  const workspaces = episodeWorkspaces(inner, { exec });
  const ws = await workspaces.open();
  assert.equal(await ws.snapshot(), 'diff --git x');
  assert.ok(ws.existingTests.has('t'), 'conserva el resto de la interfaz');
  assert.equal(workspaces.last().head_moved, true);
  assert.equal(await ws.commit('reference: V1'), 'c'.repeat(40));
  assert.ok(calls.includes('git reset -q'), 'reset --soft a la base');
});

test('workspace del episodio: un parche enorme se marca y no se devuelve', async () => {
  const baseline = 'a'.repeat(40);
  const exec = () => JSON.stringify({ head: baseline, bytes: 99e6, oversize: true }) + '\n';
  const workspaces = episodeWorkspaces({ async open() { return { session: {}, initialization: { baseline_commit: baseline } }; } }, { exec });
  const ws = await workspaces.open();
  assert.equal(await ws.snapshot(), '');
  assert.deepEqual(workspaces.last(), { head_moved: false, oversize: true, bytes: 99e6 });
});

test('oráculo que agota el tiempo: se repite; con Docker sano cuenta como fallo del código, si no, infraestructura', async () => {
  const timeout = { status: 'INFRA_ERROR', runs: [{ error: 'TIMEOUT' }] };
  const ok = { status: 'PASS', runs: [{ hidden: { T001: { tests: 1, failing: [], compile_error: false } }, suite_failing: [], suite_broken: [] }] };
  const seq = list => { let i = 0; return async () => list[i++]; };
  let r = await measureOracle({ runRealOracle: seq([timeout, timeout]), dockerHealthy: () => true }, {}, 1);
  assert.deepEqual(r.summary, failAll(1, 'oracle_timeout'));
  r = await measureOracle({ runRealOracle: seq([timeout]), dockerHealthy: () => false }, {}, 1);
  assert.equal(r.summary.status, 'INFRA_ERROR');
  r = await measureOracle({ runRealOracle: seq([timeout, ok]), dockerHealthy: () => true }, {}, 1);
  assert.deepEqual(r.summary.requirements, { T001: true });
});

test('excepción del evaluador: infraestructura explícita, nunca un TIMEOUT del modelo', async () => {
  const captured = {};
  const h = harness({});
  const evaluator = episodeEvaluator({ image: base.image_id, manifest: data.manifest, steps: [], v0Commit: base.v0_repo_commit, version: 'V1', hiddenTests: [], captured, privateSink: () => {}, deps: h.deps });
  const r = await evaluator.check('independent_oracle', { snapshot: async () => { throw new Error('ENOBUFS'); } });
  assert.equal(r.status, 'INFRA_ERROR');
  assert.match(captured.evaluator_error, /independent_oracle: ENOBUFS/);
});

test('evaluador: parche enorme cuenta como fallo de todo sin llamar al oráculo', async () => {
  const captured = {};
  const h = harness({});
  const evaluator = episodeEvaluator({ image: base.image_id, manifest: data.manifest, steps: [], v0Commit: base.v0_repo_commit, version: 'V2', hiddenTests: [], captured, privateSink: () => {}, deps: h.deps });
  const r = await evaluator.check('independent_oracle', { snapshot: async () => '', episodeState: { oversize: true, bytes: 1 } });
  assert.equal(r.status, 'PASS');
  assert.equal(captured.oracle.cause, 'patch_oversize');
  assert.equal(h.calls.oracle.length, 0);
});

test('registro del turno: tokens aunque haya llamadas fallidas, reintentos de transporte y procedencia del código', async () => {
  const { result } = await run({ V1: { outcome: 'ACCEPTED', patch: 'state:T001' }, V2: { outcome: 'ACCEPTED', patch: 'state:T001,T002' }, V3: { outcome: 'ACCEPTED', patch: 'state:T001,T002,T003' } }, {
    adapterFor: ({ turn }) => { turn.call({ tokens: { input: 10, output: 5, reasoning: null } }); turn.call({ tokens: { input: null, output: null } }); turn.retry({ code: 'HTTP_429', wait: 15000 }); return { next() {} }; }
  });
  const t1 = result.records[0];
  assert.equal(t1.tokens.input, 10); assert.equal(t1.calls_without_tokens, 1);
  assert.equal(t1.transport_retries, 1); assert.equal(t1.transport_retry_wait_seconds, 15);
  assert.match(t1.code_sha256, /^[a-f0-9]{64}$/); assert.match(t1.models_sha256, /^[a-f0-9]{64}$/);
});

test('suite inestable: si solo falla la suite, el oráculo se repite y cuenta el segundo resultado', async () => {
  const run = (suite) => ({ status: 'FAIL', runs: [{ hidden: { T001: { tests: 1, failing: [], compile_error: false } }, suite_failing: suite ? [] : ['x › inestable'], suite_broken: [] }] });
  const seq = list => { let i = 0; return async () => list[i++]; };
  let r = await measureOracle({ runRealOracle: seq([run(false), run(true)]), dockerHealthy: () => true }, {}, 1);
  assert.equal(r.summary.suite_ok, true); assert.equal(r.summary.suite_retry.confirmed, false);
  r = await measureOracle({ runRealOracle: seq([run(false), run(false)]), dockerHealthy: () => true }, {}, 1);
  assert.equal(r.summary.suite_ok, false); assert.equal(r.summary.suite_retry.confirmed, true);
  // Si además falla un requisito, no se repite: el turno ya no aprueba.
  const hiddenFail = { status: 'FAIL', runs: [{ hidden: { T001: { tests: 1, failing: ['y'], compile_error: false } }, suite_failing: ['x'], suite_broken: [] }] };
  let calls = 0;
  r = await measureOracle({ runRealOracle: async () => { calls++; return hiddenFail; }, dockerHealthy: () => true }, {}, 1);
  assert.equal(calls, 1);
});
