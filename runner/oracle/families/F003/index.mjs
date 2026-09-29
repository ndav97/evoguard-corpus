// Oráculo de F003 (carrito de la compra). Planes vinculados por hash a oracle/F003/*.cases.yaml (spec-lock.json).
// Las listas esperadas del catálogo y las regiones se derivan del fixture; los importes se transcriben del texto del caso.
import { amount } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F003';
export const ID_PREFIX = 'A';
export const FIXTURE = 'fixtures/catalog.json';
const MONEY = { type: 'number', minimum: 0 };
export const FIXTURE_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array', minItems: 16, maxItems: 16,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^A0[0-1][0-9]$' },
          name: { type: 'string', minLength: 1 },
          category: { enum: ['Papelería', 'Libros', 'Hogar', 'Electrónica'] },
          price: { type: 'number', exclusiveMinimum: 0 }
        },
        required: ['id', 'name', 'category', 'price'],
        additionalProperties: false
      }
    },
    coupons: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', pattern: '^[A-Z0-9]+$' },
          kind: { enum: ['percent', 'fixed'] },
          value: { type: 'number', exclusiveMinimum: 0 },
          min_subtotal: MONEY,
          category: { enum: ['todas', 'Papelería', 'Libros', 'Hogar', 'Electrónica'] }
        },
        required: ['code', 'kind', 'value', 'min_subtotal', 'category'],
        additionalProperties: false
      }
    },
    regions: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', pattern: '^[a-z]+$' },
          name: { type: 'string', minLength: 1 },
          tax_rate: { type: 'number', minimum: 0, maximum: 1 },
          shipping: MONEY
        },
        required: ['code', 'name', 'tax_rate', 'shipping'],
        additionalProperties: false
      }
    },
    free_shipping_threshold: MONEY
  },
  required: ['products', 'coupons', 'regions', 'free_shipping_threshold'],
  additionalProperties: false
};

const cents = value => Math.round(value * 100);
const twoDecimals = value => Math.abs(value * 100 - cents(value)) < 1e-6;

export function checkFixture(catalog, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const { products, coupons, regions, free_shipping_threshold: threshold } = catalog;
  const summary = family.fixture.summary ?? {};
  demand(JSON.stringify(products.map(p => p.id)) === JSON.stringify(Array.from({ length: 16 }, (_, i) => `A${String(i + 1).padStart(3, '0')}`)), 'IDs de productos deben ser A001–A016 ordenados');
  demand(new Set(products.map(p => p.name.toLowerCase())).size === products.length, 'Nombres de productos repetidos');
  demand(products.every(p => twoDecimals(p.price)), 'Precios con más de dos decimales');
  const categories = {};
  for (const p of products) categories[p.category] = (categories[p.category] ?? 0) + 1;
  demand(JSON.stringify(categories) === JSON.stringify(summary.category_counts), 'Conteo por categoría distinto del declarado');
  demand(products.reduce((n, p) => n + cents(p.price), 0) === cents(summary.catalog_total ?? -1), 'Suma del catálogo distinta de la declarada');
  demand(JSON.stringify(coupons.map(c => c.code)) === JSON.stringify(summary.coupon_codes), 'Códigos de cupón distintos de los declarados');
  demand(new Set(coupons.map(c => c.code)).size === coupons.length, 'Códigos de cupón repetidos');
  demand(coupons.every(c => c.category === 'todas' || products.some(p => p.category === c.category)), 'Cupón con categoría sin productos');
  demand(coupons.every(c => twoDecimals(c.value) && twoDecimals(c.min_subtotal) && (c.kind !== 'percent' || (Number.isInteger(c.value) && c.value < 100))), 'Cupón con valor inválido');
  demand(JSON.stringify(regions.map(r => r.code)) === JSON.stringify(summary.region_codes), 'Regiones distintas de las declaradas');
  demand(regions.every(r => twoDecimals(r.shipping) && Math.abs(r.tax_rate * 10000 - Math.round(r.tax_rate * 10000)) < 1e-6), 'Región con tasa o envío inválidos');
  demand(twoDecimals(threshold) && threshold > 0, 'Umbral de envío inválido');
  demand(products.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  add: { role: 'button', name: 'Añadir' },
  quantity: { role: 'spinbutton', name: 'Cantidad' },
  subtotal: { role: 'status', name: 'Subtotal' },
  remove: { role: 'button', name: 'Quitar' },
  coupon: { role: 'textbox', name: 'Cupón' },
  apply: { role: 'button', name: 'Aplicar' },
  discount: { role: 'status', name: 'Descuento' },
  region: { role: 'combobox', name: 'Región' },
  tax: { role: 'status', name: 'Impuesto' },
  shipping: { role: 'status', name: 'Envío' },
  total: { role: 'status', name: 'Total a pagar' }
};
export const LISTS = {
  catalog: { name: 'Catálogo', id: 'A\\d{3}' },
  cart: { name: 'Carrito', id: 'A\\d{3}' }
};

export const context = catalog => ({ catalog, productIds: catalog.products.map(p => p.id), regionCodes: catalog.regions.map(r => r.code) });

// ---------- utilidades ----------
const add = (ui, id) => ui.rowClick('catalog', id, CONTROL.add);
const setQuantity = (ui, id, n) => ui.rowFill('cart', id, CONTROL.quantity, String(n));
const quantity = (ui, id) => ui.rowValue('cart', id, CONTROL.quantity);
const remove = (ui, id) => ui.rowClick('cart', id, CONTROL.remove);
const cart = ui => ui.ids('cart');
// Importe tras la etiqueta del contrato («Subtotal: N», «Envío: N»…). Si la etiqueta no aparece se exige un único
// importe en el texto, como antes (revisión de equidad 2026-09-29: el contrato dice «incluye», no «solo»).
const money = async (ui, key) => {
  const text = await ui.text(key);
  const label = CONTROL[key].name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${label}:\\s*(-?\\d+\\.\\d{2})(?!\\d)`));
  return match ? Number(match[1]) : amount(text);
};
async function applyCoupon(ui, code) {
  await ui.fill('coupon', code);
  await ui.click('apply');
}
const alertMatches = async (ui, text) => (await ui.alerts()).some(a => a.includes(text));

export const PLANS = {
  // ---------- R001 — añadir al carrito (V0) ----------
  'R001-A01': async (ui, c, { productIds }) => {
    c.eq('catálogo', await ui.ids('catalog'), productIds);
    c.eq('carrito', await cart(ui), []);
    c.eq('subtotal', await money(ui, 'subtotal'), 0);
  },
  'R001-A02': async (ui, c) => {
    await add(ui, 'A003');
    const rows = await ui.rows('cart');
    c.eq('líneas', rows.map(r => r.id), ['A003']);
    c.eq('texto de la línea', rows[0]?.text.startsWith('A003 Taza de cerámica'), true);
    c.eq('cantidad', await quantity(ui, 'A003'), '1');
    c.eq('subtotal', await money(ui, 'subtotal'), 7.25);
  },
  'R001-A03': async (ui, c) => {
    await add(ui, 'A005'); await add(ui, 'A002'); await add(ui, 'A005');
    c.eq('líneas', await cart(ui), ['A005', 'A002']);
    c.eq('cantidad A005', await quantity(ui, 'A005'), '2');
    c.eq('cantidad A002', await quantity(ui, 'A002'), '1');
    c.eq('subtotal', await money(ui, 'subtotal'), 61.9);
  },
  'R001-A04': async (ui, c) => {
    await add(ui, 'A016'); await add(ui, 'A001'); await add(ui, 'A009');
    c.eq('líneas', await cart(ui), ['A016', 'A001', 'A009']);
    c.eq('subtotal', await money(ui, 'subtotal'), 48.7);
  },
  'R001-A05': async (ui, c) => {
    await add(ui, 'A010');
    c.eq('subtotal tras A010', await money(ui, 'subtotal'), 2.8);
    await add(ui, 'A008');
    c.eq('subtotal tras A008', await money(ui, 'subtotal'), 9.2);
  },

  // ---------- R002 — editar cantidades (V0) ----------
  'R002-A01': async (ui, c) => {
    await add(ui, 'A002'); await setQuantity(ui, 'A002', 3);
    c.eq('cantidad A002', await quantity(ui, 'A002'), '3');
    c.eq('subtotal', await money(ui, 'subtotal'), 38.7);
  },
  'R002-A02': async (ui, c) => {
    await add(ui, 'A003'); await add(ui, 'A007'); await setQuantity(ui, 'A003', 0);
    c.eq('líneas', await cart(ui), ['A007']);
    c.eq('subtotal', await money(ui, 'subtotal'), 18.75);
  },
  'R002-A03': async (ui, c) => {
    await add(ui, 'A004'); await add(ui, 'A011'); await remove(ui, 'A004');
    c.eq('líneas', await cart(ui), ['A011']);
    c.eq('cantidad A011', await quantity(ui, 'A011'), '1');
    c.eq('subtotal', await money(ui, 'subtotal'), 9.95);
  },
  'R002-A04': async (ui, c) => {
    await add(ui, 'A001'); await add(ui, 'A002'); await remove(ui, 'A001'); await add(ui, 'A001');
    c.eq('líneas', await cart(ui), ['A002', 'A001']);
    c.eq('cantidad A001', await quantity(ui, 'A001'), '1');
    c.eq('subtotal', await money(ui, 'subtotal'), 16.35);
  },
  'R002-A05': async (ui, c) => {
    await add(ui, 'A006'); await setQuantity(ui, 'A006', 4); await add(ui, 'A006');
    c.eq('cantidad A006', await quantity(ui, 'A006'), '5');
    c.eq('subtotal', await money(ui, 'subtotal'), 20.75);
  },
  'R002-A06': async (ui, c) => {
    await add(ui, 'A012'); await setQuantity(ui, 'A012', 2); await remove(ui, 'A012');
    c.eq('líneas', await cart(ui), []);
    c.eq('subtotal', await money(ui, 'subtotal'), 0);
  },

  // ---------- R003 — cupones (V1) ----------
  'R003-A01': async (ui, c) => {
    await add(ui, 'A004'); await add(ui, 'A013'); await applyCoupon(ui, 'AHORRO10');
    c.eq('descuento', await money(ui, 'discount'), 2.87);
    c.eq('subtotal', await money(ui, 'subtotal'), 28.69);
  },
  'R003-A02': async (ui, c) => {
    await add(ui, 'A016'); await applyCoupon(ui, '  ahorro10  ');
    c.eq('descuento', await money(ui, 'discount'), 2.99);
  },
  'R003-A03': async (ui, c) => {
    await add(ui, 'A016'); await applyCoupon(ui, 'AHORRO10');
    c.eq('descuento con AHORRO10', await money(ui, 'discount'), 2.99);
    await applyCoupon(ui, 'AHORRO15');
    c.eq('aviso', await alertMatches(ui, 'Cupón no válido'), true);
    c.eq('descuento con AHORRO15', await money(ui, 'discount'), 0);
  },
  'R003-A04': async (ui, c) => {
    await add(ui, 'A009'); await add(ui, 'A012'); await add(ui, 'A001');
    await applyCoupon(ui, 'AHORRO10');
    c.eq('descuento AHORRO10', await money(ui, 'discount'), 3.34);
    c.eq('subtotal', await money(ui, 'subtotal'), 33.4);
    await applyCoupon(ui, 'MENOS5');
    c.eq('descuento MENOS5', await money(ui, 'discount'), 5);
    c.eq('subtotal', await money(ui, 'subtotal'), 33.4);
    await applyCoupon(ui, 'LIBROS20');
    c.eq('descuento LIBROS20', await money(ui, 'discount'), 3.07);
    c.eq('subtotal', await money(ui, 'subtotal'), 33.4);
  },
  'R003-A05': async (ui, c) => {
    await add(ui, 'A008'); await applyCoupon(ui, 'LIBROS20');
    c.eq('descuento solo con A008', await money(ui, 'discount'), 0);
    await add(ui, 'A013'); await setQuantity(ui, 'A013', 3);
    c.eq('subtotal', await money(ui, 'subtotal'), 32.5);
    c.eq('descuento con A013 × 3', await money(ui, 'discount'), 5.22);
  },
  'R003-A06': async (ui, c) => {
    await add(ui, 'A003'); await add(ui, 'A011'); await add(ui, 'A015');
    await setQuantity(ui, 'A003', 2); await applyCoupon(ui, 'MENOS5');
    c.eq('subtotal 30.00', await money(ui, 'subtotal'), 30);
    c.eq('descuento con 30.00', await money(ui, 'discount'), 5);
    await setQuantity(ui, 'A003', 1);
    c.eq('subtotal 22.75', await money(ui, 'subtotal'), 22.75);
    c.eq('descuento con 22.75', await money(ui, 'discount'), 0);
    await setQuantity(ui, 'A003', 2);
    c.eq('subtotal de nuevo 30.00', await money(ui, 'subtotal'), 30);
    c.eq('descuento de nuevo', await money(ui, 'discount'), 5);
  },

  // ---------- R004 — región e impuesto (V2) ----------
  'R004-A01': async (ui, c, { regionCodes }) => {
    c.eq('región', await ui.value('region'), regionCodes[0]);
    c.eq('opciones', (await ui.options('region')).map(o => o.value), regionCodes);
    c.eq('impuesto', await money(ui, 'tax'), 0);
  },
  'R004-A02': async (ui, c) => {
    await add(ui, 'A002');
    c.eq('impuesto', await money(ui, 'tax'), 2.71);
  },
  'R004-A03': async (ui, c) => {
    await add(ui, 'A016'); await applyCoupon(ui, 'AHORRO10');
    c.eq('descuento', await money(ui, 'discount'), 2.99);
    c.eq('impuesto', await money(ui, 'tax'), 5.65);
  },
  'R004-A04': async (ui, c) => {
    await add(ui, 'A002'); await ui.select('region', 'canarias');
    c.eq('impuesto canarias', await money(ui, 'tax'), 0.9);
    await ui.select('region', 'baleares');
    c.eq('impuesto baleares', await money(ui, 'tax'), 2.71);
  },
  'R004-A05': async (ui, c) => {
    await add(ui, 'A002'); await setQuantity(ui, 'A002', 2);
    c.eq('impuesto', await money(ui, 'tax'), 5.42);
    await ui.select('region', 'canarias');
    c.eq('impuesto canarias', await money(ui, 'tax'), 1.81);
  },
  'R004-A06': async (ui, c) => {
    await add(ui, 'A009'); await add(ui, 'A001'); await applyCoupon(ui, 'AHORRO10'); await ui.select('region', 'canarias');
    c.eq('subtotal', await money(ui, 'subtotal'), 18.8);
    c.eq('descuento', await money(ui, 'discount'), 1.88);
    c.eq('impuesto', await money(ui, 'tax'), 1.18);
  },

  // ---------- R005 — envío y total (V3) ----------
  'R005-A01': async (ui, c) => {
    c.eq('envío', await money(ui, 'shipping'), 0);
    c.eq('total a pagar', await money(ui, 'total'), 0);
  },
  'R005-A02': async (ui, c) => {
    await add(ui, 'A002');
    c.eq('envío', await money(ui, 'shipping'), 4.95);
    c.eq('total a pagar', await money(ui, 'total'), 20.56);
  },
  'R005-A03': async (ui, c) => {
    await add(ui, 'A002'); await add(ui, 'A008'); await add(ui, 'A009'); await setQuantity(ui, 'A009', 2);
    c.eq('subtotal 50.00', await money(ui, 'subtotal'), 50);
    c.eq('envío con 50.00', await money(ui, 'shipping'), 0);
    c.eq('total con 50.00', await money(ui, 'total'), 60.5);
    await setQuantity(ui, 'A009', 1);
    c.eq('subtotal 34.65', await money(ui, 'subtotal'), 34.65);
    c.eq('envío con 34.65', await money(ui, 'shipping'), 4.95);
    c.eq('total con 34.65', await money(ui, 'total'), 46.88);
  },
  'R005-A04': async (ui, c) => {
    await add(ui, 'A002'); await add(ui, 'A008'); await add(ui, 'A009'); await setQuantity(ui, 'A009', 2);
    await applyCoupon(ui, 'AHORRO10');
    c.eq('descuento', await money(ui, 'discount'), 5);
    c.eq('envío', await money(ui, 'shipping'), 4.95);
    c.eq('total a pagar', await money(ui, 'total'), 59.4);
  },
  'R005-A05': async (ui, c) => {
    await add(ui, 'A002'); await ui.select('region', 'baleares');
    c.eq('envío baleares', await money(ui, 'shipping'), 7.5);
    c.eq('total baleares', await money(ui, 'total'), 23.11);
    await ui.select('region', 'canarias');
    c.eq('envío canarias', await money(ui, 'shipping'), 9.9);
    c.eq('total canarias', await money(ui, 'total'), 23.7);
  },
  'R005-A06': async (ui, c) => {
    await add(ui, 'A005'); await add(ui, 'A013'); await add(ui, 'A004');
    await applyCoupon(ui, 'LIBROS20'); await ui.select('region', 'canarias');
    c.eq('subtotal', await money(ui, 'subtotal'), 53.19);
    c.eq('descuento', await money(ui, 'discount'), 6.64);
    c.eq('impuesto', await money(ui, 'tax'), 3.26);
    c.eq('envío', await money(ui, 'shipping'), 9.9);
    c.eq('total a pagar', await money(ui, 'total'), 59.71);
  },
  'R005-A07': async (ui, c) => {
    await add(ui, 'A002'); await remove(ui, 'A002');
    c.eq('envío', await money(ui, 'shipping'), 0);
    c.eq('total a pagar', await money(ui, 'total'), 0);
  }
};
