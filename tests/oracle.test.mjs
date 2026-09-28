// Pruebas unitarias del oráculo, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runCase, loadCases, casesFor, specHash } from '../runner/oracle/evaluate.mjs';
import { PLANS } from '../runner/oracle/plans.mjs';
import { loadProducts, sortProducts, filterProducts, ids } from '../runner/oracle/reference.mjs';

const products = JSON.parse(readFileSync(new URL('../families/F001-product-catalog/fixtures/products.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../runner/oracle/families/F001/spec-lock.json', import.meta.url)));
const cases = loadCases();
const r001 = cases.filter(spec => spec.requirement === 'R001');

// Catálogo en memoria para V0 (búsqueda + categoría, sin paginación): solo para probar el evaluador.
function catalog({ idsFor } = {}) {
  const state = { query: '', category: 'All' };
  const fallback = () => products.filter(product => {
    const query = state.query.trim().toLowerCase();
    return (query === '' || product.name.toLowerCase().includes(query)) && (state.category === 'All' || product.category === state.category);
  }).map(product => product.id);
  return {
    async reset() { state.query = ''; state.category = 'All'; },
    async search(query) { state.query = query; },
    async category(value) { state.category = value; },
    async visibleIds() { return (idsFor ?? fallback)(state); },
    async visibleText() { return ''; },
    async canNext() { return false; },
    async canPrevious() { return false; },
    async next() {},
    async previous() {}
  };
}

test('hay un plan ejecutable y un hash vinculado por cada uno de los 33 casos canónicos', () => {
  assert.equal(cases.length, 33);
  assert.deepEqual(Object.keys(PLANS).sort(), cases.map(spec => spec.id).sort());
  assert.deepEqual(Object.keys(lock.cases).sort(), cases.map(spec => spec.id).sort());
  for (const spec of cases) assert.equal(lock.cases[spec.id], specHash(spec), spec.id);
});

test('la evaluación por versión incluye solo requisitos ya introducidos', () => {
  assert.deepEqual(['V0', 'V1', 'V2', 'V3'].map(version => casesFor(version).length), [10, 17, 25, 33]);
  assert.ok(casesFor('V0').every(spec => ['R001', 'R002'].includes(spec.requirement)));
  assert.throws(() => casesFor('V4'), /Versión desconocida/);
});

test('un caso modificado o desconocido no es ejecutable', async () => {
  const changed = { ...r001[0], expected: 'Resultados P002.' };
  await assert.rejects(() => runCase(changed, catalog()), /difiere de la especificación/);
  await assert.rejects(() => runCase({ id: 'R999-A01', steps: [], expected: '' }, catalog()), /sin plan ejecutable/);
});

test('el oráculo sin adapter no puede devolver PASS', async () => {
  await assert.rejects(() => runCase(r001[0], null), /adapter/);
});

test('R001-A01 pasa solo si la UI observable devuelve la coincidencia del fixture', async () => {
  const spec = r001.find(item => item.id === 'R001-A01');
  const passed = await runCase(spec, catalog());
  const failed = await runCase(spec, catalog({ idsFor: () => ['P999'] }));
  assert.equal(passed.status, 'PASS');
  assert.equal(failed.status, 'FAIL');
  assert.deepEqual(passed.checks.map(check => check.observed), [['P001']]);
});

test('R001-A02 exige la misma observación para mouse y MOUSE', async () => {
  const spec = r001.find(item => item.id === 'R001-A02');
  const queries = [];
  const passed = await runCase(spec, catalog({ idsFor: state => { queries.push(state.query); return ['P001']; } }));
  assert.equal(passed.status, 'PASS');
  assert.deepEqual(queries, ['mouse', 'MOUSE']);
});

test('duplicados en la lista observada hacen fallar la comparación como conjunto', async () => {
  const spec = r001.find(item => item.id === 'R001-A01');
  const failed = await runCase(spec, catalog({ idsFor: () => ['P001', 'P001'] }));
  assert.equal(failed.status, 'FAIL');
});

test('un control ausente en la UI es FAIL del candidato, no un error del evaluador', async () => {
  const spec = cases.find(item => item.id === 'R003-A01');
  const result = await runCase(spec, catalog());
  assert.equal(result.status, 'FAIL');
  assert.match(result.error, /sort/);
});

test('el modelo de referencia coincide con los valores literales de los casos', () => {
  const fixture = loadProducts();
  const priceAsc = ids(sortProducts(fixture, 'price-asc'));
  const tie = priceAsc.filter(id => fixture.find(product => product.id === id).price === 24.99);
  assert.deepEqual(tie, ['P001', 'P008', 'P019']);
  const books = sortProducts(fixture.filter(product => product.category === 'Books'), 'name-desc').map(product => product.name);
  assert.deepEqual(books, ['Testing Software', 'Practical TypeScript', 'Modern React', 'Design Patterns', 'Data Structures', 'Clean Code']);
  assert.deepEqual(ids(sortProducts(filterProducts(fixture, { query: 'bottle' }), 'name-desc')), ['P022', 'P013']);
  assert.ok(filterProducts(fixture, { query: 'e' }).length > 20);
  assert.ok(priceAsc.slice(10, 20).includes('P001'));
  assert.ok(ids(sortProducts(fixture, 'name-desc')).slice(0, 10).includes('P001'));
});
