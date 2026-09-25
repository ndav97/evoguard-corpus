import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runCase } from '../runner/oracle/evaluate.mjs';

const r001 = JSON.parse(readFileSync(new URL('../oracle/F001/R001.cases.yaml', import.meta.url)));
// Página mínima de calibración R001 (tests/fixtures/catalog-page.html) y una página incorrecta.
const correct = new URL('./fixtures/catalog-page.html', import.meta.url);
const wrong = new URL('./fixtures/catalog-wrong.html', import.meta.url);
const home = Array.from({ length: 8 }, (_, index) => `P${String(index + 10).padStart(3, '0')}`);

const expected = {
  'R001-A01': [['P001']],
  'R001-A02': [['P001'], ['P001']],
  'R001-A03': [['P001']],
  'R001-A04': [home],
  'R001-A05': [['P022'], ['P013']]
};

for (const [id, observed] of Object.entries(expected)) {
  test(`${id} pasa por lo que muestra la UI y falla si no cumple`, async () => {
    const spec = r001.cases.find(item => item.id === id);
    const passed = await runCase(spec, correct);
    const failed = await runCase(spec, wrong);
    assert.equal(passed.status, 'PASS');
    assert.deepEqual(passed.checks.map(check => check.observed), observed);
    assert.equal(failed.status, 'FAIL');
  });
}
