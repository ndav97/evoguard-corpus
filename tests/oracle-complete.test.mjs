// Calibración E2E del oráculo F001 sobre navegador real con páginas de prueba.
// tests/fixtures/catalog-complete.html es material de calibración (no referencia del corpus):
// ?version=V0..V3 limita funcionalidades y ?mutant=<defecto> introduce un error deliberado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSuiteOnPage, VERSIONS } from '../runner/oracle/evaluate.mjs';
import { stabilityCheck } from '../runner/oracle/bridge.mjs';

const page = (query = '') => {
  const url = new URL('./fixtures/catalog-complete.html', import.meta.url);
  url.search = query;
  return url;
};
const failing = report => report.results.filter(result => result.status !== 'PASS').map(result => result.id);

test('la página de calibración embebe exactamente el fixture del corpus', () => {
  const html = readFileSync(page(), 'utf8');
  const products = JSON.parse(readFileSync(new URL('../families/F001-product-catalog/fixtures/products.json', import.meta.url)));
  const embedded = JSON.parse(html.match(/const PRODUCTS = (\[[\s\S]*?\n\s*\]);/)[1]);
  assert.deepEqual(embedded, products);
});

for (const version of VERSIONS) {
  test(`${version}: la implementación de calibración correcta pasa todos los casos aplicables`, async () => {
    const report = await runSuiteOnPage(version, page(`?version=${version}`));
    assert.equal(report.status, 'PASS', JSON.stringify(report.results.filter(r => r.status !== 'PASS'), null, 1));
    assert.equal(report.total, { V0: 10, V1: 17, V2: 25, V3: 33 }[version]);
  });
}

test('V0 no falla por funcionalidades futuras, pero una V0 no satisface V1', async () => {
  assert.equal((await runSuiteOnPage('V0', page('?version=V0'))).status, 'PASS');
  const v1 = await runSuiteOnPage('V1', page('?version=V0'));
  assert.equal(v1.status, 'FAIL');
  assert.deepEqual(failing(v1), ['R003-A01', 'R003-A02', 'R003-A03', 'R003-A04', 'R003-A05', 'R003-A06', 'R003-A07']);
});

// Controles negativos: cada defecto deliberado debe ser rechazado por los casos que le corresponden.
const MUTANTS = {
  case: ['R001-A02'],
  notrim: ['R001-A03'],
  or: ['R001-A05', 'R002-A04'],
  category: ['R002-A02'],
  leak: ['R002-A05', 'R004-A08'],
  reverse: ['R003-A04'],
  'sort-reset': ['R003-A06'],
  page9: ['R004-A01', 'R004-A02'],
  sortpage: ['R004-A04'],
  'nopagereset-search': ['R004-A05'],
  'nopagereset-category': ['R004-A06'],
  overflow: ['R004-A02', 'R004-A07'],
  nan: ['R004-A08'],
  multi: ['R005-A02'],
  index: ['R005-A04'],
  keep: ['R005-A07', 'R005-A08'],
  restore: ['R005-A07', 'R005-A08']
};

test('cada mutante es rechazado por los casos que le corresponden', async () => {
  for (const [mutant, killers] of Object.entries(MUTANTS)) {
    const report = await runSuiteOnPage('V3', page(`?version=V3&mutant=${mutant}`));
    assert.equal(report.status, 'FAIL', mutant);
    const failed = failing(report);
    for (const id of killers) assert.ok(failed.includes(id), `${mutant} debería fallar ${id}; fallaron ${failed.join(', ')}`);
  }
});

test('estabilidad 5/5 del oráculo en V3 (policy.oracle_stability_runs)', async () => {
  const result = await stabilityCheck('V3', version => runSuiteOnPage(version, page(`?version=${version}`)));
  assert.equal(result.runs, 5);
  assert.equal(result.status, 'STABLE');
});
