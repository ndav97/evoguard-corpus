// Presupuesto del experimento (límite del tesista: S/ 5 000; config/experiment.json → budget).
// - Costo real por llamada a partir de los tokens informados (entrada total, cacheada, escritura de caché, salida y,
//   en Gemini, razonamiento facturado aparte) y de la tabla de precios.
// - Gasto acumulado: todos los turn.json de runs/episodes (también los episodios interrumpidos: ese dinero se gastó),
//   horas de GPU de los turnos locales y gastos externos anotados a mano (diagnósticos, banco, GPU sin uso).
// - Tope: el ejecutor no inicia un episodio si el gasto más la proyección pesimista del episodio supera el límite
//   menos la reserva.
// Uso: npm run episode:budget   (informe de gasto, saldo y proyección de los planes pendientes)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const loadBudget = root => JSON.parse(readFileSync(join(root, 'config/experiment.json'), 'utf8')).budget;
// Local = servido por Ollama en la GPU (sin costo por token): las ranuras local_* y cualquier otra cuya configuración
// use el transporte ollama (la ranura google con Gemma desde el 2026-10-11).
const OLLAMA_SLOTS = (() => { try { const m = JSON.parse(readFileSync(fileURLToPath(new URL('../../config/models.json', import.meta.url)), 'utf8')).models; return new Set(Object.keys(m).filter(p => m[p].transport === 'ollama')); } catch { return new Set(); } })();
export const isLocal = provider => provider.startsWith('local_') || OLLAMA_SLOTS.has(provider);
const round = (x, d = 2) => (x === null || x === undefined ? null : +x.toFixed(d));

export function limits(budget) {
  const limitUsd = budget.limit_pen / budget.usd_to_pen;
  return { limit_usd: round(limitUsd), reserve_usd: round(limitUsd * budget.reserve_fraction), cap_usd: round(limitUsd * (1 - budget.reserve_fraction)) };
}

// Costo en USD de una llamada comercial, o null si no informó tokens.
export function callCost(call, price) {
  const t = call.tokens;
  if (!price || !t || !Number.isFinite(t.input) || !Number.isFinite(t.output)) return null;
  const cached = Number.isFinite(t.cached) ? t.cached : 0;
  const write = Number.isFinite(t.cache_write) ? t.cache_write : 0;
  const plain = Math.max(0, t.input - cached - write);
  const output = t.output + (price.reasoning_separate && Number.isFinite(t.reasoning) ? t.reasoning : 0);
  return (plain * price.input + cached * price.cached_input + write * price.cache_write + output * price.output) / 1e6;
}

// Costo de un turno a partir de sus llamadas. Los modelos locales no tienen costo por token (cuenta la GPU).
export function turnCost(calls, provider, budget) {
  if (isLocal(provider)) return { usd: 0, unknown_calls: 0, cached_tokens: null };
  const price = budget.prices_usd_per_million[provider];
  let usd = 0, unknown = 0, cached = 0;
  for (const call of calls) {
    const cost = callCost(call, price);
    if (cost === null) { if (call.status !== 'ERROR' || call.tokens?.input !== null) unknown++; continue; }
    usd += cost;
    cached += Number.isFinite(call.tokens?.cached) ? call.tokens.cached : 0;
  }
  return { usd: round(usd, 4), unknown_calls: unknown, cached_tokens: cached };
}

function* turnFiles(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'analisis') continue;
    if (statSync(full).isDirectory()) yield* turnFiles(full);
    else if (name === 'turn.json') yield full;
  }
}

// Gasto acumulado (USD). Incluye episodios interrumpidos (*.incompleto-*) porque sus llamadas se pagaron.
export function spending(root, budget = loadBudget(root)) {
  const byProvider = {};
  let commercial = 0, gpuHours = 0, turns = 0;
  for (const file of turnFiles(join(root, 'runs/episodes'))) {
    const r = JSON.parse(readFileSync(file, 'utf8'));
    turns++;
    const entry = byProvider[r.provider] ??= { turns: 0, usd: 0, unknown_calls: 0 };
    entry.turns++;
    if (isLocal(r.provider)) {
      const hours = (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 3600000;
      if (Number.isFinite(hours) && hours > 0) gpuHours += hours;
      continue;
    }
    const usd = (Number.isFinite(r.cost_usd) ? r.cost_usd : 0) + (r.cost_unknown_calls ?? 0) * budget.unknown_call_usd;
    entry.usd += usd; entry.unknown_calls += r.cost_unknown_calls ?? 0;
    commercial += usd;
  }
  const gpu = gpuHours * budget.gpu_usd_per_hour;
  const extra = (budget.extra_spent_usd ?? []).reduce((t, e) => t + e.usd, 0);
  for (const e of Object.values(byProvider)) e.usd = round(e.usd);
  return { turns, by_provider: byProvider, commercial_usd: round(commercial), gpu_hours: round(gpuHours, 1), gpu_usd: round(gpu), extra_usd: round(extra), total_usd: round(commercial + gpu + extra) };
}

// Costo por turno previsto para un proveedor: con 10 o más turnos observados, el percentil 90 observado; si no,
// el techo pesimista de la configuración (proyección del tope) o la estimación típica (proyección del plan).
export function perTurn(root, provider, budget, { pessimistic = true } = {}) {
  const key = isLocal(provider) ? 'local' : provider;
  const observed = [];
  for (const file of turnFiles(join(root, 'runs/episodes'))) {
    const r = JSON.parse(readFileSync(file, 'utf8'));
    if (r.provider !== provider) continue;
    if (isLocal(provider)) { const h = (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 3600000; if (h > 0) observed.push(h * budget.gpu_usd_per_hour); }
    else if (Number.isFinite(r.cost_usd)) observed.push(r.cost_usd + (r.cost_unknown_calls ?? 0) * budget.unknown_call_usd);
  }
  if (observed.length >= 10) {
    observed.sort((a, b) => a - b);
    return pessimistic ? observed[Math.ceil(0.9 * observed.length) - 1] : observed.reduce((a, b) => a + b, 0) / observed.length;
  }
  return (pessimistic ? budget.per_turn_ceiling_usd : budget.per_turn_estimate_usd)[key];
}

// Bloqueo del tope: null si el episodio cabe; si no, el motivo.
export function budgetBlocker(root, provider, turns, budget = loadBudget(root)) {
  const { cap_usd, limit_usd } = limits(budget);
  const spent = spending(root, budget).total_usd;
  const projected = turns * perTurn(root, provider, budget);
  if (spent + projected > cap_usd) return `presupuesto: gastado ${spent.toFixed(2)} USD + episodio previsto ${projected.toFixed(2)} USD superaría el tope de ${cap_usd.toFixed(2)} USD (límite ${limit_usd.toFixed(2)} USD = S/ ${budget.limit_pen}, menos la reserva del ${Math.round(budget.reserve_fraction * 100)} %)`;
  return null;
}

// Sin await en el nivel superior: run.mjs importa este módulo, y un await aquí bloquearía la importación circular.
async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const budget = loadBudget(root);
  const { planEpisodes, loadExperiment } = await import('./run.mjs');
  const l = limits(budget), s = spending(root, budget);
  const pen = usd => `S/ ${(usd * budget.usd_to_pen).toFixed(0)}`;
  console.log(`Límite: S/ ${budget.limit_pen} = ${l.limit_usd} USD (1 USD = ${budget.usd_to_pen} PEN, ${budget.rate_date}); reserva ${l.reserve_usd} USD; tope operativo ${l.cap_usd} USD`);
  console.log(`Gastado: ${s.total_usd} USD (${pen(s.total_usd)}) = comerciales ${s.commercial_usd} + GPU ${s.gpu_usd} (${s.gpu_hours} h) + externos ${s.extra_usd}; ${s.turns} turnos`);
  for (const [p, e] of Object.entries(s.by_provider)) console.log(`  ${p}: ${e.turns} turnos, ${e.usd} USD${e.unknown_calls ? ` (${e.unknown_calls} llamadas sin tokens, estimadas)` : ''}`);
  const phases = loadExperiment(root).phases;
  let pending = 0;
  for (const [phase, config] of Object.entries(phases)) {
    if (!Array.isArray(config.families)) { console.log(`Fase ${phase}: familias aún sin asignar (${config.turns_planned ?? '?'} turnos previstos)`); continue; }
    for (const arm of config.arms) {
      if (arm !== 'B') continue;
      const plan = planEpisodes(root, { phase, arm }).filter(e => !e.done);
      const cost = plan.reduce((t, e) => t + config.turns * perTurn(root, e.provider, budget, { pessimistic: false }), 0);
      pending += cost;
      console.log(`Fase ${phase}, brazo ${arm}: ${plan.length} episodios pendientes ≈ ${round(cost)} USD (${pen(cost)})`);
    }
  }
  console.log(`Saldo tras lo pendiente (estimación típica): ${round(l.cap_usd - s.total_usd - pending)} USD (${pen(l.cap_usd - s.total_usd - pending)}) sobre el tope operativo`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(error => { console.error(error.message); process.exitCode = 1; });
