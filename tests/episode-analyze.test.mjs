// Análisis de episodios (runner/episode/analyze.mjs): tabla por modelo, CSV y lectura de registros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { report, loadTurnRecords } from '../runner/episode/analyze.mjs';
import { TURN_ID } from '../runner/episode/metrics.mjs';

const turn = (position, reqs, { provider = 'openai', family = 'S001', arm = 'B' } = {}) => ({
  experiment: 'x', phase: 'pilot', arm, provider, family_id: family, episode: 1, repetition: 1, turns_total: 3,
  turn: TURN_ID(position), position, delivered: true, scope_ok: true, typecheck: 'NOT_APPLICABLE',
  oracle: { status: 'FAIL', requirements: Object.fromEntries(reqs.map((ok, i) => [TURN_ID(i + 1), ok])), suite_ok: true }
});
const ok3 = opts => [turn(1, [true], opts), turn(2, [true, true], opts), turn(3, [true, true, true], opts)];
const reg3 = opts => [turn(1, [true], opts), turn(2, [false, true], opts), turn(3, [true, true, true], opts)];

test('tabla tipo paper por modelo, con nombres de modelo y CSV', () => {
  const records = [...ok3({ family: 'S001' }), ...reg3({ family: 'S002' }), ...ok3({ family: 'S001', provider: 'google' }), ...ok3({ family: 'S002', provider: 'google' })];
  const { markdown, files } = report(records, { names: { openai: 'GPT-5.6 Sol', google: 'Gemini 3.1 Pro' }, resamples: 200, experiment: 'x' });
  assert.match(markdown, /\| Modelo \| Episodios \(familias\) \| TP \| \*\*TP@3 \(episodios exitosos\)\*\*/);
  assert.match(markdown, /\| Gemini 3\.1 Pro \| 2 \(2\) \|/);
  assert.match(markdown, /\| GPT-5\.6 Sol \| 2 \(2\) \| 83\.3 %/);
  assert.match(markdown, /1\/1 \(100\.0 %\)/, 'la transición fallida de openai es por regresión');
  assert.equal(files['modelos.csv'].split('\n')[0].split(',')[0], 'experiment');
  assert.equal(files['episodios.csv'].trim().split('\n').length, 1 + 4);
  assert.equal(files['comparaciones.csv'], '');
});

test('comparación frente a B cuando hay otro brazo', () => {
  const records = [...reg3({ family: 'S001' }), ...ok3({ family: 'S001', arm: 'E' })];
  const { markdown, files } = report(records, { resamples: 200 });
  assert.match(markdown, /\| E \| openai \| 1 \| \+100\.0 pp/);
  assert.equal(files['comparaciones.csv'].trim().split('\n').length, 2);
});

test('lectura de registros: ignora episodios interrumpidos y la carpeta de análisis', () => {
  const dir = mkdtempSync(join(tmpdir(), 'episodios-'));
  const put = (rel, value) => { mkdirSync(join(dir, rel), { recursive: true }); writeFileSync(join(dir, rel, 'turn.json'), JSON.stringify(value)); };
  put('B/openai/S001/e1-r1/T001', turn(1, [true]));
  put('B/openai/S001/e1-r1.incompleto-123/T001', turn(1, [false]));
  put('analisis/T001', turn(1, [false]));
  assert.equal(loadTurnRecords(dir).length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('avisa si los registros mezclan versiones del código y desglosa los turnos sin entrega', () => {
  const records = [...ok3({ family: 'S001' }), ...reg3({ family: 'S002' })].map((r, i) => ({ ...r, code_sha256: i < 3 ? 'a' : 'b' }));
  records[4] = { ...records[4], delivered: false, failure_reason: 'CYCLE_LIMIT' };
  const { markdown } = report(records, { resamples: 100 });
  assert.match(markdown, /mezclan 2 versiones del código/);
  assert.match(markdown, /\| Modelo \| CYCLE_LIMIT \| Con reintentos de transporte \| Con HEAD movido \|/);
  assert.match(markdown, /\| openai \| 1 \| 0 \| 0 \|/);
});
