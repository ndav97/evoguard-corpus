// Modelo de referencia del oráculo: deriva expectativas desde el fixture del corpus.
// Solo lo usa el evaluador. No se comparte con páginas de calibración ni con candidatos.
import { readFileSync } from 'node:fs';

export const PAGE_SIZE = 10;
export const CATEGORIES = ['Electronics', 'Home', 'Sports', 'Books'];
export const SORTS = ['name-asc', 'name-desc', 'price-asc', 'price-desc'];

export function loadProducts(root = new URL('../../', import.meta.url)) {
  const products = JSON.parse(readFileSync(new URL('archive/sintetico/families/F001-product-catalog/fixtures/products.json', root), 'utf8'));
  if (!Array.isArray(products) || products.length !== 30) throw new Error('Fixture F001 inválido');
  return products;
}

export function filterProducts(products, { query = '', category = 'All' } = {}) {
  const needle = query.trim().toLowerCase();
  return products.filter(product => (needle === '' || product.name.toLowerCase().includes(needle)) && (category === 'All' || product.category === category));
}

// Comparación ASCII por code unit sobre name.toLowerCase(); empates conservan la posición del fixture.
function compare(mode) {
  const ascii = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  switch (mode) {
    case 'name-asc': return (a, b) => ascii(a.name.toLowerCase(), b.name.toLowerCase());
    case 'name-desc': return (a, b) => ascii(b.name.toLowerCase(), a.name.toLowerCase());
    case 'price-asc': return (a, b) => a.price - b.price;
    case 'price-desc': return (a, b) => b.price - a.price;
    default: throw new Error(`Orden desconocido: ${mode}`);
  }
}

export function sortProducts(products, mode) {
  if (mode === null || mode === undefined) return [...products];
  const index = new Map(products.map((product, position) => [product.id, position]));
  const order = compare(mode);
  return [...products].sort((a, b) => order(a, b) || index.get(a.id) - index.get(b.id));
}

export function pages(list, size = PAGE_SIZE) {
  const result = [];
  for (let start = 0; start < list.length; start += size) result.push(list.slice(start, start + size));
  return result;
}

export const ids = list => list.map(product => product.id);

export function range(first, last) {
  const [start, end] = [first, last].map(id => Number(id.slice(1)));
  return Array.from({ length: end - start + 1 }, (_, offset) => `P${String(start + offset).padStart(3, '0')}`);
}
