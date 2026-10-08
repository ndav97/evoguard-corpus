// Métricas de episodio (runner/episode/metrics.mjs): definiciones alineadas con EvoGenUI-Bench y con el plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEpisode, turnPassed, aggregate, compareArms, analyzeEpisodes, bootstrapMean, groupEpisodes, TURN_ID } from '../runner/episode/metrics.mjs';

// Registro de turno mínimo. reqs: requisitos T1..Tt que pasan (por posición); suite: la suite del repositorio.
const turn = (position, { reqs, suite = true, delivered = true, scope_ok = true, typecheck = 'NOT_APPLICABLE', family = 'S001', provider = 'openai', arm = 'B', repetition = 1, total = 3, infra = false } = {}) => ({
  experiment: 'piloto', phase: 'pilot', arm, provider, family_id: family, episode: 1, repetition, turns_total: total,
  turn: TURN_ID(position), position, delivered, scope_ok, typecheck, infra_error: infra || undefined,
  oracle: infra ? null : { status: 'FAIL', requirements: Object.fromEntries(Array.from({ length: position }, (_, i) => [TURN_ID(i + 1), (reqs ?? Array(position).fill(true))[i]])), suite_ok: suite }
});
const episode = (specs, common = {}) => specs.map((spec, i) => turn(i + 1, { total: specs.length, ...common, ...spec }));

test('P_t exige entrega, alcance, tipos, todos los requisitos activos y la suite', () => {
  assert.equal(turnPassed(turn(2, { reqs: [true, true] })), true);
  assert.equal(turnPassed(turn(2, { reqs: [false, true] })), false, 'requisito anterior roto');
  assert.equal(turnPassed(turn(2, { reqs: [true, true], suite: false })), false, 'suite rota');
  assert.equal(turnPassed(turn(2, { reqs: [true, true], delivered: false })), false, 'sin entrega');
  assert.equal(turnPassed(turn(2, { reqs: [true, true], scope_ok: false })), false, 'fuera de alcance');
  assert.equal(turnPassed(turn(2, { reqs: [true, true], typecheck: 'FAIL' })), false, 'tipos');
});

test('episodio exitoso: Z = 1, CPT = n, sin regresión y transiciones retenidas', () => {
  const s = summarizeEpisode(episode([{}, {}, {}]));
  assert.equal(s.valid, true);
  assert.deepEqual(s.passes, [true, true, true]);
  assert.equal(s.success, true); assert.equal(s.cpt, 3); assert.equal(s.regression, false);
  assert.deepEqual(s.transitions.map(t => t.retained), [true, true]);
});

test('regresión frente a requisito nuevo no cumplido frente a defecto persistente', () => {
  // T1 ok; T2 rompe T1 (regresión) y cumple T2; T3: T1 sigue roto (defecto persistente), T3 no se cumple.
  const s = summarizeEpisode(episode([{ reqs: [true] }, { reqs: [false, true] }, { reqs: [false, true, false] }]));
  assert.deepEqual(s.passes, [true, false, false]);
  assert.equal(s.cpt, 1); assert.equal(s.success, false); assert.equal(s.regression, true);
  assert.deepEqual(s.turns.map(t => t.failure), [null, 'regression', 'new_requirement']);
  assert.deepEqual(s.turns[1].broken, ['T001']);
  assert.deepEqual(s.turns[2].broken, [], 'T001 ya fallaba: no es regresión');
  assert.deepEqual(s.transitions, [{ position: 2, retained: false, failure: 'regression' }]);
});

test('la suite del repositorio cuenta como requisito vigente desde V0', () => {
  const s = summarizeEpisode(episode([{ reqs: [true], suite: false }, {}, {}]));
  assert.equal(s.turns[0].regression, true);
  assert.deepEqual(s.turns[0].broken, ['suite']);
  assert.equal(s.turns[1].regression, false, 'la suite vuelve a pasar: no es regresión');
});

test('turno sin entrega: la causa es «sin entrega» aunque tampoco cumpla lo nuevo; la regresión tiene prioridad', () => {
  const s = summarizeEpisode(episode([{}, { reqs: [true, true], delivered: false }, {}]));
  assert.equal(s.turns[1].failure, 'not_delivered');
  assert.deepEqual(s.passes, [true, false, true]);
  assert.equal(summarizeEpisode(episode([{}, { reqs: [true, false], delivered: false }, {}])).turns[1].failure, 'not_delivered');
  assert.equal(summarizeEpisode(episode([{}, { reqs: [false, false], delivered: false }, {}])).turns[1].failure, 'regression');
});

test('episodios incompletos o con error de infraestructura no son válidos', () => {
  assert.equal(summarizeEpisode(episode([{}, {}, {}]).slice(0, 2)).valid, false);
  const s = summarizeEpisode(episode([{}, { infra: true }, {}]));
  assert.equal(s.valid, false); assert.match(s.problems.join(), /infraestructura/);
});

test('agregado tipo tabla 2 del paper: TP, TP@n, CPT, APR, TER, posición e independencia', () => {
  const records = [
    ...episode([{}, {}, {}], { family: 'S001' }),                                                   // éxito
    ...episode([{}, { reqs: [false, true] }, { reqs: [true, true, true] }], { family: 'S002' }),    // regresión en T2
    ...episode([{ reqs: [false] }, { reqs: [false, false] }, { reqs: [false, false, false] }], { family: 'S003' }) // nada
  ];
  const a = aggregate(groupEpisodes(records), { resamples: 200 });
  assert.equal(a.episodes, 3); assert.equal(a.families, 3); assert.equal(a.turns, 9);
  assert.equal(a.tp.k, 5); assert.equal(a.tp.n, 9);
  assert.equal(a.tp_at_n.k, 1); assert.equal(a.tp_at_n.n, 3);
  assert.equal(a.cpt, +((3 + 1 + 0) / 3).toFixed(2));
  // Transiciones elegibles: S001 (2, ambas retenidas) y S002 (1, perdida por regresión).
  assert.equal(a.apr.k, 2); assert.equal(a.apr.n, 3);
  assert.deepEqual(a.failed_transitions, { n: 1, regression: 1, new_requirement: 0, not_delivered: 0, other: 0 });
  assert.equal(a.ter.k, 1);
  assert.deepEqual(a.by_position.map(p => p.rate), [0.6667, 0.3333, 0.6667]);
  assert.equal(a.independence_estimate, +(0.6667 * 0.3333 * 0.6667).toFixed(4));
  assert.equal(a.tee_by_family.mean, +(1 / 3).toFixed(4));
});

test('comparación emparejada por familia: Δ TEE y Δ TER con bootstrap reproducible', () => {
  const baseline = groupEpisodes([
    ...episode([{}, { reqs: [false, true] }, {}], { family: 'S001' }),
    ...episode([{}, {}, {}], { family: 'S002' })
  ]);
  const treatment = groupEpisodes([
    ...episode([{}, {}, {}], { family: 'S001', arm: 'E' }),
    ...episode([{}, {}, {}], { family: 'S002', arm: 'E' })
  ]);
  const c = compareArms(baseline, treatment, { resamples: 500 });
  assert.equal(c.families, 2);
  assert.equal(c.delta_tee.mean, 0.5);
  assert.equal(c.delta_ter.mean, 0.5);
  assert.deepEqual(compareArms(baseline, treatment, { resamples: 500 }), c, 'misma semilla, mismo resultado');
});

test('bootstrap: intervalo que contiene la media y degenerado con valores constantes', () => {
  const b = bootstrapMean([0, 1, 0, 1, 1, 0, 1, 1], { resamples: 2000 });
  assert.ok(b.low <= b.mean && b.mean <= b.high);
  assert.deepEqual(bootstrapMean([1, 1, 1], { resamples: 100 }), { mean: 1, low: 1, high: 1 });
});

test('analyzeEpisodes agrupa por brazo y modelo y compara cada brazo con B', () => {
  const records = [
    ...episode([{}, {}, {}], { family: 'S001' }),
    ...episode([{}, {}, {}], { family: 'S001', arm: 'E' }),
    ...episode([{}, {}, {}], { family: 'S001', provider: 'google' })
  ];
  const { rows, comparisons } = analyzeEpisodes(records, { resamples: 100 });
  assert.deepEqual(rows.map(r => `${r.arm}:${r.provider}`), ['B:google', 'B:openai', 'E:openai']);
  assert.deepEqual(comparisons.map(c => `${c.arm}:${c.provider}`), ['E:openai']);
});
