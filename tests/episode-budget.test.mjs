// Presupuesto del experimento (runner/episode/budget.mjs): costo por llamada, gasto acumulado y tope.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callCost, turnCost, spending, perTurn, budgetBlocker, limits } from '../runner/episode/budget.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const budget = JSON.parse(readFileSync(join(repoRoot, 'config/experiment.json'), 'utf8')).budget;
const P = budget.prices_usd_per_million;

test('límite: S/ 5 000 al cambio configurado, con reserva', () => {
  const l = limits(budget);
  assert.equal(l.limit_usd, +(5000 / budget.usd_to_pen).toFixed(2));
  assert.equal(l.cap_usd, +(l.limit_usd * (1 - budget.reserve_fraction)).toFixed(2));
});

test('costo por llamada: entrada cacheada más barata, escritura de caché y razonamiento de Gemini aparte', () => {
  // 1 M de entrada (400 k cacheados) y 10 k de salida en OpenAI: 0,6 × 4 + 0,4 × 0,4 + 0,01 × 20.
  assert.equal(+callCost({ tokens: { input: 1e6, cached: 4e5, output: 1e4, reasoning: 5e3 } }, P.openai).toFixed(4), +(2.4 + 0.16 + 0.2).toFixed(4));
  // Anthropic: 100 k de entrada total con 60 k leídos y 20 k escritos en caché.
  assert.equal(+callCost({ tokens: { input: 1e5, cached: 6e4, cache_write: 2e4, output: 1e3 } }, P.anthropic).toFixed(4), +((2e4 * 2 + 6e4 * 0.2 + 2e4 * 2.5 + 1e3 * 10) / 1e6).toFixed(4));
  // Gemini factura el razonamiento como salida y no viene incluido en output.
  assert.equal(+callCost({ tokens: { input: 1e5, output: 1e3, reasoning: 4e3 } }, P.google).toFixed(4), +((1e5 * 2 + 5e3 * 12) / 1e6).toFixed(4));
  assert.equal(callCost({ tokens: { input: null, output: null } }, P.openai), null);
});

test('costo del turno: suma llamadas, cuenta las que no informaron tokens y los locales no cuestan por token', () => {
  const calls = [{ status: 'PASS', tokens: { input: 1e5, output: 1e3, cached: 5e4 } }, { status: 'PASS', tokens: { input: null, output: null } }, { status: 'ERROR', tokens: { input: null, output: null } }];
  const t = turnCost(calls, 'openai', budget);
  assert.equal(t.unknown_calls, 1, 'el error de transporte sin tokens no se cobra; la respuesta sin tokens sí se estima');
  assert.equal(t.cached_tokens, 5e4);
  assert.deepEqual(turnCost(calls, 'local_a', budget), { usd: 0, unknown_calls: 0, cached_tokens: null });
});

test('gasto acumulado: incluye episodios interrumpidos, horas de GPU de los locales y llamadas sin tokens; tope', () => {
  const root = mkdtempSync(join(tmpdir(), 'presupuesto-'));
  mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'config/experiment.json'), JSON.stringify({ budget: { ...budget, extra_spent_usd: [{ concept: 'diagnóstico', usd: 3 }] } }));
  const put = (rel, value) => { mkdirSync(join(root, 'runs/episodes', rel), { recursive: true }); writeFileSync(join(root, 'runs/episodes', rel, 'turn.json'), JSON.stringify(value)); };
  const t = (h = 0) => ({ started_at: '2026-10-08T10:00:00Z', finished_at: new Date(Date.parse('2026-10-08T10:00:00Z') + h * 3600000).toISOString() });
  put('x/B/openai/S001/e1-r1/T001', { provider: 'openai', cost_usd: 1.5, cost_unknown_calls: 0, ...t() });
  put('x/B/openai/S001/e1-r1.incompleto-1/T001', { provider: 'openai', cost_usd: 1, cost_unknown_calls: 2, ...t() });
  put('x/B/local_a/S001/e1-r1/T001', { provider: 'local_a', cost_usd: 0, ...t(0.5) });
  const s = spending(root);
  assert.equal(s.turns, 3);
  assert.equal(s.commercial_usd, +(1.5 + 1 + 2 * budget.unknown_call_usd).toFixed(2));
  assert.equal(s.gpu_usd, +(0.5 * budget.gpu_usd_per_hour).toFixed(2));
  assert.equal(s.total_usd, +(s.commercial_usd + s.gpu_usd + 3).toFixed(2));
  assert.equal(perTurn(root, 'openai', budget), budget.per_turn_ceiling_usd.openai, 'pocos datos: techo pesimista');
  assert.equal(budgetBlocker(root, 'openai', 3), null);
  writeFileSync(join(root, 'config/experiment.json'), JSON.stringify({ budget: { ...budget, extra_spent_usd: [{ concept: 'otro', usd: limits(budget).cap_usd - 5 }] } }));
  assert.match(budgetBlocker(root, 'openai', 3) ?? '', /superaría el tope/);
  rmSync(root, { recursive: true, force: true });
});
