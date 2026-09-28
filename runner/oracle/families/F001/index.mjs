// Módulo de oráculo de F001 (catálogo de productos). Conserva el adaptador específico y los planes originales
// (runner/oracle/ui-adapter.mjs, plans.mjs, reference.mjs); este archivo solo los registra con la interfaz común.
import { PLANS } from '../../plans.mjs';
import { CONTROL, connectCatalog } from '../../ui-adapter.mjs';

export const FAMILY_ID = 'F001';
export const FIXTURE = 'fixtures/products.json';
// El fixture de F001 se valida con schema/products.schema.json (esquema histórico) además de estas invariantes.
export const FIXTURE_SCHEMA = 'products';
export { PLANS, CONTROL };
export const connect = page => connectCatalog(page);
export const context = fixture => ({ products: fixture });

export function checkFixture(products, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const ids = products.map(p => p.id);
  demand(JSON.stringify(ids) === JSON.stringify(Array.from({ length: 30 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`)), 'IDs de productos deben ser P001–P030 únicos y ordenados');
  demand(new Set(products.map(p => p.name.toLowerCase())).size === 30, 'Nombres de productos no únicos');
  for (const [category, count] of Object.entries(family.fixture.category_counts ?? {})) demand(products.filter(p => p.category === category).length === count, `Conteo incorrecto de ${category}`);
  demand(products.some((p, i) => i > 0 && products[i - 1].price > p.price), 'Fixture debe tener precios fuera de orden');
  demand(new Set(products.map(p => p.price)).size < products.length, 'Fixture debe incluir empates');
  return errors;
}
