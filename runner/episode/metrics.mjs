// Métricas de episodio, alineadas con EvoGenUI-Bench (Peng et al., 2026) y con el plan de tesis (TEE, TER).
// Funciones puras sobre los registros de turno (turn.json) que escribe runner/episode/run.mjs.
//
// Un episodio es una familia recorrida por un único modelo, turno a turno, sobre su propia salida.
// Definiciones (docs/diseno-linea-base-episodios.md):
//   requisito k del turno t: pasan los tests ocultos de Tk (con tests > 0 y sin error de compilación)
//   suite: los tests existentes del repositorio siguen pasando (fallos conocidos de V0 excluidos)
//   P_t (turno aprobado; TP del paper): entregó, respetó el alcance, la comprobación de tipos (si existe) no falló,
//       pasan los requisitos T1..Tt y pasa la suite
//   Z (episodio exitoso; TP@n del paper = TEE del plan): producto de los P_t
//   CPT: racha inicial de turnos aprobados (0..n)
//   APR: P(P_t = 1 | P_{t−1} = 1), agregado sobre todas las transiciones elegibles (no promediado por tarea)
//   regresión en t: un requisito anterior (Tk, k < t) o la suite pasaba en t−1 (en V0 para la suite si t = 1) y
//       falla en t. Un requisito que ya fallaba es un defecto persistente, no una regresión
//   R (TER del plan): el episodio tuvo al menos una regresión
//   satisfacción nueva en t: pasa el requisito Tt
//   retención Ret(t) = |C_t que sigue pasando| / |C_t|, C_t = requisitos anteriores y suite que pasaban en t−1
import { wilson } from '../analysis/analyze.mjs';

export const TURN_ID = position => `T${String(position).padStart(3, '0')}`;
export const episodeKey = r => [r.experiment, r.phase, r.arm, r.provider, r.family_id, r.episode, r.repetition].join('|');

// Estado de los requisitos tras un turno: { T001: true, …, suite: true }.
export function requirementState(record) {
  const oracle = record.oracle;
  if (!oracle || oracle.status === 'INFRA_ERROR') return null;
  const state = {};
  for (let k = 1; k <= record.position; k++) state[TURN_ID(k)] = oracle.requirements?.[TURN_ID(k)] === true;
  state.suite = oracle.suite_ok === true;
  return state;
}

export function turnPassed(record) {
  const state = requirementState(record);
  return Boolean(state && record.delivered === true && record.scope_ok !== false && !['FAIL', 'TIMEOUT'].includes(record.typecheck)
    && Object.values(state).every(Boolean));
}

// Un episodio es válido si tiene todos sus turnos, en orden, sin errores de infraestructura.
export function validateEpisode(turns) {
  const problems = [];
  if (!turns.length) return ['sin turnos'];
  const total = turns[0].turns_total;
  if (!Number.isInteger(total) || total < 1) problems.push('turns_total inválido');
  const positions = turns.map(t => t.position);
  if (JSON.stringify(positions) !== JSON.stringify(Array.from({ length: total }, (_, i) => i + 1))) problems.push(`turnos incompletos (${positions.join(',')} de ${total})`);
  for (const t of turns) {
    if (t.infra_error) problems.push(`${t.turn}: error de infraestructura`);
    else if (!requirementState(t)) problems.push(`${t.turn}: sin evaluación del oráculo`);
  }
  return problems;
}

// Resumen de un episodio (turnos ordenados por posición).
export function summarizeEpisode(turns) {
  const sorted = [...turns].sort((a, b) => a.position - b.position);
  const problems = validateEpisode(sorted);
  const head = sorted[0] ?? {};
  const base = { key: episodeKey(head), experiment: head.experiment, phase: head.phase, arm: head.arm, provider: head.provider, family_id: head.family_id, episode: head.episode, repetition: head.repetition, turns_total: head.turns_total };
  if (problems.length) return { ...base, valid: false, problems };
  const states = sorted.map(requirementState);
  const pass = sorted.map(turnPassed);
  let cpt = 0;
  while (cpt < pass.length && pass[cpt]) cpt++;
  const turnsOut = sorted.map((record, i) => {
    const state = states[i];
    const previous = i === 0 ? { suite: true } : states[i - 1];
    const carried = Object.keys(previous).filter(key => previous[key] === true);
    const broken = carried.filter(key => state[key] === false);
    const newOk = state[TURN_ID(record.position)] === true;
    const regression = broken.length > 0;
    // Causa de un turno no aprobado, por prioridad: regresión > sin entrega > requisito nuevo > otra (alcance, tipos).
    const failure = pass[i] ? null : regression ? 'regression' : record.delivered !== true ? 'not_delivered' : !newOk ? 'new_requirement' : 'other';
    return {
      turn: record.turn, position: record.position, passed: pass[i], delivered: record.delivered === true, new_requirement: newOk,
      regression, broken, carried: carried.length, retained: carried.length - broken.length, failure
    };
  });
  const transitions = [];
  for (let i = 1; i < pass.length; i++) if (pass[i - 1]) transitions.push({ position: i + 1, retained: pass[i], failure: turnsOut[i].failure });
  return {
    ...base, valid: true, problems: [],
    passes: pass, success: pass.every(Boolean), cpt, regression: turnsOut.some(t => t.regression),
    transitions, turns: turnsOut
  };
}

export function groupEpisodes(records) {
  const groups = new Map();
  for (const record of records) {
    const key = episodeKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].map(summarizeEpisode);
}

const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round = (x, d = 4) => (x === null || x === undefined || Number.isNaN(x) ? null : +x.toFixed(d));

// Generador pseudoaleatorio con semilla (mulberry32): bootstrap reproducible.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Bootstrap percentil del promedio de valores por familia (remuestreo de familias completas).
export function bootstrapMean(values, { resamples = 10000, seed = 20261008 } = {}) {
  if (!values.length) return { mean: null, low: null, high: null };
  const random = rng(seed);
  const means = new Float64Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(random() * values.length)];
    means[r] = sum / values.length;
  }
  means.sort();
  return { mean: round(mean(values)), low: round(means[Math.floor(0.025 * (resamples - 1))]), high: round(means[Math.ceil(0.975 * (resamples - 1))]) };
}

// Promedio por familia (sobre sus episodios y repeticiones) de una magnitud del episodio.
export function perFamily(episodes, value) {
  const byFamily = new Map();
  for (const e of episodes) {
    if (!byFamily.has(e.family_id)) byFamily.set(e.family_id, []);
    byFamily.get(e.family_id).push(value(e));
  }
  return new Map([...byFamily].map(([family, values]) => [family, mean(values)]));
}

// Métricas de un grupo de episodios válidos (un brazo y un modelo), como la tabla 2 del paper.
export function aggregate(episodes, { resamples = 10000, seed = 20261008 } = {}) {
  const valid = episodes.filter(e => e.valid);
  const turns = valid.flatMap(e => e.turns);
  const transitions = valid.flatMap(e => e.transitions);
  const failedTransitions = transitions.filter(t => !t.retained);
  const failedTurns = turns.filter(t => !t.passed);
  const n = valid.length ? Math.max(...valid.map(e => e.turns_total)) : 0;
  const byPosition = Array.from({ length: n }, (_, i) => {
    const at = turns.filter(t => t.position === i + 1);
    return { position: i + 1, ...wilson(at.filter(t => t.passed).length, at.length), n: at.length };
  });
  const independence = byPosition.length && byPosition.every(p => p.rate !== null) ? round(byPosition.reduce((product, p) => product * p.rate, 1)) : null;
  const carried = turns.reduce((sum, t) => sum + t.carried, 0);
  return {
    episodes: valid.length, invalid_episodes: episodes.length - valid.length, families: new Set(valid.map(e => e.family_id)).size, turns: turns.length,
    tp: { ...wilson(turns.filter(t => t.passed).length, turns.length), k: turns.filter(t => t.passed).length, n: turns.length },
    tp_at_n: { ...wilson(valid.filter(e => e.success).length, valid.length), k: valid.filter(e => e.success).length, n: valid.length },
    tee_by_family: bootstrapMean([...perFamily(valid, e => (e.success ? 1 : 0)).values()], { resamples, seed }),
    cpt: round(mean(valid.map(e => e.cpt)), 2),
    apr: { ...wilson(transitions.filter(t => t.retained).length, transitions.length), k: transitions.filter(t => t.retained).length, n: transitions.length },
    ter: { ...wilson(valid.filter(e => e.regression).length, valid.length), k: valid.filter(e => e.regression).length, n: valid.length },
    ter_by_family: bootstrapMean([...perFamily(valid, e => (e.regression ? 1 : 0)).values()], { resamples, seed }),
    new_requirement: { ...wilson(turns.filter(t => t.new_requirement).length, turns.length), k: turns.filter(t => t.new_requirement).length, n: turns.length },
    retention: carried ? round(turns.reduce((sum, t) => sum + t.retained, 0) / carried) : null,
    failed_transitions: { n: failedTransitions.length, regression: failedTransitions.filter(t => t.failure === 'regression').length, new_requirement: failedTransitions.filter(t => t.failure === 'new_requirement').length, not_delivered: failedTransitions.filter(t => t.failure === 'not_delivered').length, other: failedTransitions.filter(t => t.failure === 'other').length },
    failed_turns: { n: failedTurns.length, regression: failedTurns.filter(t => t.failure === 'regression').length, new_requirement: failedTurns.filter(t => t.failure === 'new_requirement').length, not_delivered: failedTurns.filter(t => t.failure === 'not_delivered').length, other: failedTurns.filter(t => t.failure === 'other').length },
    by_position: byPosition,
    independence_estimate: independence
  };
}

// Comparación emparejada por familia de un brazo frente al de referencia (B), para un mismo modelo:
// Δ = TEE(brazo) − TEE(B) y ΔR = TER(B) − TER(brazo), con bootstrap de familias completas.
export function compareArms(baseline, treatment, { resamples = 10000, seed = 20261008 } = {}) {
  const ok = list => list.filter(e => e.valid);
  const teeB = perFamily(ok(baseline), e => (e.success ? 1 : 0)), teeX = perFamily(ok(treatment), e => (e.success ? 1 : 0));
  const terB = perFamily(ok(baseline), e => (e.regression ? 1 : 0)), terX = perFamily(ok(treatment), e => (e.regression ? 1 : 0));
  const families = [...teeB.keys()].filter(f => teeX.has(f)).sort();
  return {
    families: families.length,
    missing: [...new Set([...teeB.keys(), ...teeX.keys()])].filter(f => !families.includes(f)).sort(),
    delta_tee: bootstrapMean(families.map(f => teeX.get(f) - teeB.get(f)), { resamples, seed }),
    delta_ter: bootstrapMean(families.map(f => terB.get(f) - terX.get(f)), { resamples, seed })
  };
}

// Tabla completa: un bloque por (fase, brazo, modelo) y comparaciones de cada brazo frente a B por modelo.
export function analyzeEpisodes(records, { baselineArm = 'B', resamples = 10000, seed = 20261008 } = {}) {
  const episodes = groupEpisodes(records);
  const groups = new Map();
  for (const e of episodes) {
    const key = [e.experiment, e.phase, e.arm, e.provider].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const rows = [...groups].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, list]) => {
    const [experiment, phase, arm, provider] = key.split('|');
    return { experiment, phase, arm, provider, ...aggregate(list, { resamples, seed }) };
  });
  const comparisons = [];
  for (const [key, list] of groups) {
    const [experiment, phase, arm, provider] = key.split('|');
    if (arm === baselineArm) continue;
    const baseline = groups.get([experiment, phase, baselineArm, provider].join('|'));
    if (baseline) comparisons.push({ experiment, phase, arm, provider, baseline: baselineArm, ...compareArms(baseline, list, { resamples, seed }) });
  }
  return { episodes, rows, comparisons };
}
