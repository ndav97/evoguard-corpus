import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wilson, analyze } from '../runner/analysis/analyze.mjs';

const V = s => ({ typecheck: s, build: s, development_tests: s, independent_oracle: s, architecture: s });
function task(root, family, version, id, attempts) {
  const dir = join(root, family, version, id);
  mkdirSync(join(dir, 'attempts'), { recursive: true });
  const calls = [], events = [];
  attempts.forEach((a, i) => {
    const started = `2026-10-01T00:0${i}:00.000Z`, finished = `2026-10-01T00:0${i}:59.000Z`;
    mkdirSync(join(dir, 'attempts', a.id), { recursive: true });
    writeFileSync(join(dir, 'attempts', a.id, 'generation.json'), JSON.stringify({ generator: { provider: a.provider, model: `${a.provider}-model` }, attempt: a.attempt, repair_count: a.attempt - 1, cycles: a.calls.length, duration_seconds: 59, tokens: { input: null, output: null }, started_at: started, finished_at: finished }));
    a.calls.forEach((c, k) => calls.push({ provider: a.provider, attempt: a.attempt, cycle: k + 1, started_at: `2026-10-01T00:0${i}:${String(10 + k).padStart(2, '0')}.000Z`, status: c.status ?? 'PASS', error_code: c.code ?? null, normalization: c.norm ?? 'none', tokens: { input: 100, output: 10, reasoning: null }, duration_ms: 1000 }));
    events.push({ type: 'attempt_finished', provider: a.provider, attempt: a.attempt, assignment: i + 1, started_at: started });
  });
  writeFileSync(join(dir, 'calls.jsonl'), calls.map(c => JSON.stringify(c)).join('\n') + '\n');
  writeFileSync(join(dir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n');
  const accepted = attempts.find(a => a.outcome === 'ACCEPTED');
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ family_id: family, version, task_id: id, mode: 'experimental', status: accepted ? 'ACCEPTED' : 'BLOCKED', accepted: accepted?.id ?? null,
    attempts: attempts.map(a => ({ id: a.id, provider: a.provider, attempt: a.attempt, outcome: a.outcome, failure_reason: a.reason ?? null, validation: a.validation })) }));
}

test('intervalo de Wilson', () => {
  assert.deepEqual(wilson(0, 0), { rate: null, low: null, high: null });
  const w = wilson(8, 10);
  assert.equal(w.rate, 0.8);
  assert.ok(Math.abs(w.low - 0.4902) < 0.001 && Math.abs(w.high - 0.9433) < 0.001);
});

test('tareas, intentos, llamadas y métricas por modelo y estrato', () => {
  const runs = mkdtempSync(join(tmpdir(), 'analysis-'));
  task(runs, 'F002', 'V0', 't1', [
    { id: '01-openai-a1', provider: 'openai', attempt: 1, outcome: 'REPAIR', validation: { ...V('PASS'), typecheck: 'FAIL', build: 'NOT_RUN', development_tests: 'NOT_RUN', independent_oracle: 'NOT_RUN', architecture: 'NOT_RUN' }, calls: [{}, {}] },
    { id: '02-openai-a2', provider: 'openai', attempt: 2, outcome: 'ACCEPTED', validation: V('PASS'), calls: [{ norm: 'markdown_fence' }] }
  ]);
  task(runs, 'S001', 'V1', 't2', [
    { id: '01-anthropic-a1', provider: 'anthropic', attempt: 1, outcome: 'REASSIGN', reason: 'CYCLE_LIMIT', validation: V('NOT_RUN'), calls: [{ status: 'ERROR', code: 'INVALID_ACTION_JSON' }, { norm: 'prose_prefix' }] },
    { id: '02-google-a1', provider: 'google', attempt: 1, outcome: 'ACCEPTED', validation: V('PASS'), calls: [{}] }
  ]);
  const out = mkdtempSync(join(tmpdir(), 'analysis-out-'));
  const { meta, result } = analyze({ runsDir: runs, outDir: out, now: 'T' });
  assert.deepEqual([meta.tasks, meta.attempts, meta.calls], [2, 4, 6]);
  assert.deepEqual(result.strata, { 'sintético': { tasks: 1, accepted: 1, first_try: 0, attempts: 2 }, 'semi-real': { tasks: 1, accepted: 1, first_try: 0, attempts: 2 } });
  const get = (provider, stratum) => result.providers.find(p => p.provider === provider && p.stratum === stratum);
  const openai = get('openai', 'todos');
  assert.equal(openai.assignments, 1);
  assert.equal(openai.assignment_success.rate, 1);
  assert.equal(openai.accepted_without_repair, 0);
  assert.equal(openai.failure_by_stage.typecheck, 1);
  assert.equal(openai.normalized.markdown_fence, 1);
  assert.equal(openai.tokens.input, 300);
  const anthropic = get('anthropic', 'semi-real');
  assert.equal(anthropic.invalid_output_rate.rate, 0.5);
  assert.deepEqual(anthropic.failure_by_stage, { CYCLE_LIMIT: 1 });
  assert.equal(anthropic.normalized.prose_prefix, 1);
  assert.equal(get('google', 'semi-real').references_generated, 1);
  assert.equal(get('anthropic', 'semi-real').initial_accepted_first_try.rate, 0);
  const attempts = readFileSync(join(out, 'attempts.csv'), 'utf8').trim().split('\n');
  assert.equal(attempts.length, 5);
  assert.match(readFileSync(join(out, 'summary.md'), 'utf8'), /## Por modelo — semi-real/);
});
