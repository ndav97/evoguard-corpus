// Oráculo de F008 (gastos con Context API). Planes vinculados por hash a oracle/F008/*.cases.yaml (spec-lock.json).
// Las expectativas numéricas se transcriben del texto del caso; los textos de gastos del fixture se derivan de ctx.
import { amount, amounts } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F008';
export const ID_PREFIX = 'G';
export const FIXTURE = 'fixtures/expenses.json';

const CATEGORY_IDS = ['comida', 'transporte', 'ocio', 'hogar', 'salud'];
export const FIXTURE_SCHEMA = {
  type: 'object',
  properties: {
    currencies: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: { code: { enum: ['EUR', 'USD', 'GBP'] }, rate: { type: 'number', exclusiveMinimum: 0 } },
        required: ['code', 'rate'],
        additionalProperties: false
      }
    },
    categories: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        properties: { id: { enum: CATEGORY_IDS }, name: { type: 'string', pattern: '^[A-Z][a-z]+$' } },
        required: ['id', 'name'],
        additionalProperties: false
      }
    },
    budgets: {
      type: 'object',
      properties: Object.fromEntries(CATEGORY_IDS.map(id => [id, { type: 'number', exclusiveMinimum: 0 }])),
      required: CATEGORY_IDS,
      additionalProperties: false
    },
    expenses: {
      type: 'array', minItems: 30, maxItems: 30,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^G0[0-9]{2}$' },
          date: { type: 'string', pattern: '^2026-0[1-3]-(0[1-9]|[12][0-9]|3[01])$' },
          description: { type: 'string', minLength: 1 },
          category: { enum: CATEGORY_IDS },
          amount: { type: 'number', exclusiveMinimum: 0 },
          currency: { enum: ['EUR', 'USD', 'GBP'] }
        },
        required: ['id', 'date', 'description', 'category', 'amount', 'currency'],
        additionalProperties: false
      }
    }
  },
  required: ['currencies', 'categories', 'budgets', 'expenses'],
  additionalProperties: false
};

// Aritmética exacta en enteros: céntimos × tasa en diezmilésimas.
const cents = value => Math.round(value * 100);
const rate4 = value => Math.round(value * 10000);
const eurCents = (expense, rates) => {
  const micro = cents(expense.amount) * rates[expense.currency];
  return Math.floor((micro + 5000) / 10000);
};

export function checkFixture(fixture, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const { currencies, categories, budgets, expenses } = fixture;
  demand(JSON.stringify(currencies.map(c => c.code)) === JSON.stringify(['EUR', 'USD', 'GBP']) && currencies[0].rate === 1, 'Monedas deben ser EUR (tasa 1), USD y GBP');
  demand(currencies.every(c => Math.abs(c.rate * 10000 - rate4(c.rate)) < 1e-6), 'Tasas con más de cuatro decimales');
  demand(JSON.stringify(categories.map(c => c.id)) === JSON.stringify(CATEGORY_IDS), 'Categorías deben ser comida, transporte, ocio, hogar, salud');
  demand(Object.values(budgets).every(b => Math.abs(b * 100 - cents(b)) < 1e-6), 'Presupuestos con más de dos decimales');
  const ids = expenses.map(e => e.id);
  demand(JSON.stringify([...ids].sort()) === JSON.stringify(Array.from({ length: 30 }, (_, i) => `G${String(i + 1).padStart(3, '0')}`)), 'IDs de gastos deben ser G001–G030 sin repetir');
  demand(JSON.stringify(ids) !== JSON.stringify([...ids].sort()), 'El orden del fixture debe diferir del orden por ID');
  demand(expenses.every(e => Math.abs(e.amount * 100 - cents(e.amount)) < 1e-6), 'Importes con más de dos decimales');
  const rates = Object.fromEntries(currencies.map(c => [c.code, rate4(c.rate)]));
  demand(expenses.every(e => (cents(e.amount) * rates[e.currency]) % 10000 !== 5000), 'Una conversión a EUR cae en medio céntimo (empate de redondeo)');
  const dates = expenses.map(e => e.date);
  demand(new Set(dates).size < dates.length, 'Se esperan gastos con la misma fecha');
  const summary = family.fixture.summary ?? {};
  for (const month of ['2026-01', '2026-02', '2026-03']) {
    const list = expenses.filter(e => e.date.startsWith(month));
    const total = list.reduce((n, e) => n + eurCents(e, rates), 0);
    demand(summary.months?.[month]?.count === list.length, `summary: número de gastos de ${month} distinto`);
    demand(cents(summary.months?.[month]?.total_eur ?? -1) === total, `summary: total de ${month} distinto (${total / 100})`);
    const exceeded = CATEGORY_IDS.filter(c => list.filter(e => e.category === c).reduce((n, e) => n + eurCents(e, rates), 0) > cents(budgets[c]));
    demand(JSON.stringify(exceeded) === JSON.stringify(summary.exceeded?.[month]), `summary: categorías excedidas de ${month} distintas`);
  }
  demand(expenses.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  month: { role: 'combobox', name: 'Mes' },
  total: { role: 'status', name: 'Total del mes' },
  description: { role: 'textbox', name: 'Descripción' },
  category: { role: 'combobox', name: 'Categoría' },
  amount: { role: 'textbox', name: 'Importe' },
  currency: { role: 'combobox', name: 'Divisa' },
  date: { role: 'field', name: 'Fecha' },
  add: { role: 'button', name: 'Añadir gasto' },
  display: { role: 'combobox', name: 'Moneda de visualización' }
};
export const LISTS = {
  expenses: { name: 'Gastos', id: 'G\\d{3}' },
  budgets: { name: 'Presupuestos', id: 'Comida|Transporte|Ocio|Hogar|Salud' }
};

export const context = fixture => ({ fixture, byId: Object.fromEntries(fixture.expenses.map(e => [e.id, e])) });

// ---------- utilidades ----------
const view = ui => ui.ids('expenses');
const line = e => `${e.id} ${e.date} ${e.description} ${e.amount.toFixed(2)} ${e.currency}`;
async function startsWith(ui, c, id, expected) {
  const text = await ui.rowText('expenses', id);
  c.eq(`${id} comienza con «${expected}»`, text.startsWith(expected) ? expected : text, expected);
}
// Total: importe único con dos decimales y código de moneda.
async function total(ui) {
  const text = await ui.text('total');
  const code = text.match(/\b(EUR|USD|GBP)\b/g);
  return `${amount(text).toFixed(2)} ${code?.length === 1 ? code[0] : '?'}`;
}
// Presupuestos: [categoría, «gastado / presupuesto MONEDA», excedido].
async function budgets(ui) {
  return (await ui.rows('budgets')).map(({ id, text }) => {
    const values = amounts(text);
    const code = text.match(/\b(EUR|USD|GBP)\b/g);
    const shown = values.length === 2 ? `${values[0].toFixed(2)} / ${values[1].toFixed(2)} ${code && new Set(code).size === 1 ? code[0] : '?'}` : text;
    return [id, shown, text.includes('Excedido')];
  });
}
const budget = (name, spent, limit, code = 'EUR', exceeded = false) => [name, `${spent} / ${limit} ${code}`, exceeded];
async function add(ui, { description, category, amount: value, currency, date } = {}) {
  if (description !== undefined) await ui.fill('description', description);
  if (category !== undefined) await ui.select('category', category);
  if (value !== undefined) await ui.fill('amount', value);
  if (currency !== undefined) await ui.select('currency', currency);
  if (date !== undefined) await ui.fill('date', date);
  await ui.click('add');
}
const alertWith = async (ui, text) => (await ui.alerts()).some(a => a.includes(text));
const JAN = ['G003', 'G001', 'G006', 'G010', 'G002', 'G004', 'G008', 'G005', 'G009', 'G007'];
const FEB = ['G011', 'G016', 'G013', 'G018', 'G012', 'G014', 'G019', 'G015', 'G017', 'G020'];
const MAR = ['G025', 'G021', 'G026', 'G023', 'G022', 'G024', 'G028', 'G027', 'G029', 'G030'];
const AMOUNT_ALERT = 'El importe debe ser mayor que 0 con como máximo dos decimales';
const DATE_ALERT = 'La fecha debe pertenecer a uno de los meses disponibles';

export const PLANS = {
  // ---------- R001 — listado mensual (V0) ----------
  'R001-A01': async (ui, c, { byId }) => {
    c.eq('Mes', await ui.value('month'), '2026-01');
    c.eq('Gastos', await view(ui), JAN);
    await startsWith(ui, c, 'G001', line(byId.G001));
    await startsWith(ui, c, 'G004', line(byId.G004));
  },
  'R001-A02': async (ui, c) => {
    await ui.select('month', '2026-02');
    c.eq('Gastos', await view(ui), FEB);
  },
  'R001-A03': async (ui, c) => {
    await ui.select('month', '2026-03');
    c.eq('Gastos', await view(ui), MAR);
  },
  'R001-A04': async (ui, c) => {
    c.eq('opciones de Mes', (await ui.options('month')).map(o => o.value), ['2026-01', '2026-02', '2026-03']);
    await ui.select('month', '2026-03'); await ui.select('month', '2026-01');
    c.eq('Gastos', await view(ui), JAN);
  },
  'R001-A05': async (ui, c) => {
    await ui.select('month', '2026-02');
    await startsWith(ui, c, 'G012', 'G012 2026-02-14 Cine 24.00 EUR');
    await startsWith(ui, c, 'G014', 'G014 2026-02-14 Regalo 70.00 GBP');
    await ui.select('month', '2026-03');
    await startsWith(ui, c, 'G028', 'G028 2026-03-18 Autobús 1.50 EUR');
    await startsWith(ui, c, 'G030', 'G030 2026-03-30 Mercado 58.20 USD');
  },

  // ---------- R002 — total del mes (V0) ----------
  'R002-A01': async (ui, c) => {
    c.eq('Total del mes', await total(ui), '433.84 EUR');
  },
  'R002-A02': async (ui, c) => {
    await ui.select('month', '2026-02');
    c.eq('Total del mes', await total(ui), '499.81 EUR');
  },
  'R002-A03': async (ui, c) => {
    await ui.select('month', '2026-03');
    c.eq('Total del mes', await total(ui), '481.48 EUR');
  },
  'R002-A04': async (ui, c) => {
    await ui.select('month', '2026-03');
    c.eq('marzo', await total(ui), '481.48 EUR');
    await ui.select('month', '2026-01');
    c.eq('enero', await total(ui), '433.84 EUR');
    await ui.select('month', '2026-02');
    c.eq('febrero', await total(ui), '499.81 EUR');
  },

  // ---------- R003 — añadir gasto (V1) ----------
  'R003-A01': async (ui, c) => {
    await add(ui, { description: 'Peluquería', category: 'salud', amount: '20', currency: 'EUR', date: '2026-01-12' });
    c.eq('Gastos', await view(ui), ['G003', 'G001', 'G006', 'G010', 'G002', 'G004', 'G031', 'G008', 'G005', 'G009', 'G007']);
    await startsWith(ui, c, 'G031', 'G031 2026-01-12 Peluquería 20.00 EUR');
    c.eq('Total del mes', await total(ui), '453.84 EUR');
  },
  'R003-A02': async (ui, c) => {
    await add(ui, { description: '   ', amount: '10', date: '2026-01-10' });
    c.eq('aviso con espacios', await alertWith(ui, 'La descripción es obligatoria'), true);
    c.eq('Gastos con espacios', await view(ui), JAN);
    await add(ui, { description: '' });
    c.eq('aviso vacía', await alertWith(ui, 'La descripción es obligatoria'), true);
    c.eq('Gastos vacía', await view(ui), JAN);
  },
  'R003-A03': async (ui, c) => {
    await ui.fill('description', 'Hotel');
    await ui.fill('date', '2026-01-10');
    for (const value of ['0', '-5', '12.345', 'abc']) {
      await add(ui, { amount: value });
      c.eq(`aviso con ${value}`, await alertWith(ui, AMOUNT_ALERT), true);
      c.eq(`Gastos con ${value}`, await view(ui), JAN);
    }
  },
  'R003-A04': async (ui, c) => {
    await add(ui, { description: 'Hotel', amount: '80', date: '' });
    c.eq('aviso con fecha vacía', await alertWith(ui, DATE_ALERT), true);
    c.eq('Gastos con fecha vacía', await view(ui), JAN);
    for (const date of ['2026-04-01', '2025-12-31']) {
      await add(ui, { date });
      c.eq(`aviso con ${date}`, await alertWith(ui, DATE_ALERT), true);
      c.eq(`Gastos con ${date}`, await view(ui), JAN);
    }
    await ui.select('month', '2026-03');
    c.eq('marzo', await view(ui), MAR);
  },
  'R003-A05': async (ui, c) => {
    await add(ui, { description: 'Ferretería', category: 'hogar', amount: '15.5', currency: 'GBP', date: '2026-03-31' });
    c.eq('enero', await view(ui), JAN);
    c.eq('total de enero', await total(ui), '433.84 EUR');
    await ui.select('month', '2026-03');
    c.eq('marzo', await view(ui), [...MAR, 'G031']);
    await startsWith(ui, c, 'G031', 'G031 2026-03-31 Ferretería 15.50 GBP');
    c.eq('total de marzo', await total(ui), '499.60 EUR');
  },
  'R003-A06': async (ui, c) => {
    await add(ui, { description: 'Café', amount: '3.20', date: '2026-01-05' });
    c.eq('Descripción tras la primera', await ui.value('description'), '');
    c.eq('Importe tras la primera', await ui.value('amount'), '');
    await add(ui, { description: 'Té', amount: '2.80' });
    c.eq('Gastos', await view(ui), ['G003', 'G001', 'G006', 'G031', 'G032', 'G010', 'G002', 'G004', 'G008', 'G005', 'G009', 'G007']);
    c.eq('Descripción tras la segunda', await ui.value('description'), '');
    c.eq('Importe tras la segunda', await ui.value('amount'), '');
    c.eq('Fecha', await ui.value('date'), '2026-01-05');
  },

  // ---------- R004 — presupuestos (V2) ----------
  'R004-A01': async (ui, c) => {
    c.eq('Presupuestos', await budgets(ui), [
      budget('Comida', '145.90', '250.00'), budget('Transporte', '99.60', '120.00'), budget('Ocio', '83.39', '100.00'),
      budget('Hogar', '86.20', '400.00'), budget('Salud', '18.75', '60.00')
    ]);
  },
  'R004-A02': async (ui, c) => {
    await ui.select('month', '2026-02');
    c.eq('Presupuestos', await budgets(ui), [
      budget('Comida', '157.44', '250.00'), budget('Transporte', '104.10', '120.00'), budget('Ocio', '105.82', '100.00', 'EUR', true),
      budget('Hogar', '72.45', '400.00'), budget('Salud', '60.00', '60.00')
    ]);
  },
  'R004-A03': async (ui, c) => {
    await ui.select('month', '2026-03');
    c.eq('Presupuestos', await budgets(ui), [
      budget('Comida', '183.64', '250.00'), budget('Transporte', '23.90', '120.00'), budget('Ocio', '82.78', '100.00'),
      budget('Hogar', '178.36', '400.00'), budget('Salud', '12.80', '60.00')
    ]);
  },
  'R004-A04': async (ui, c) => {
    await add(ui, { description: 'Peaje', category: 'transporte', amount: '20.40', date: '2026-01-30' });
    c.eq('tras el primero', (await budgets(ui))[1], budget('Transporte', '120.00', '120.00'));
    await add(ui, { description: 'Peaje extra', amount: '0.01' });
    c.eq('tras el segundo', (await budgets(ui))[1], budget('Transporte', '120.01', '120.00', 'EUR', true));
  },
  'R004-A05': async (ui, c) => {
    await add(ui, { description: 'Entradas', category: 'ocio', amount: '18', currency: 'USD', date: '2026-01-15' });
    c.eq('Ocio', (await budgets(ui))[2], budget('Ocio', '99.90', '100.00'));
  },
  'R004-A06': async (ui, c) => {
    await add(ui, { description: 'Fisioterapia', category: 'salud', amount: '50', date: '2026-02-10' });
    c.eq('Salud en enero', (await budgets(ui))[4], budget('Salud', '18.75', '60.00'));
    await ui.select('month', '2026-02');
    c.eq('Salud en febrero', (await budgets(ui))[4], budget('Salud', '110.00', '60.00', 'EUR', true));
  },

  // ---------- R005 — moneda de visualización (V3) ----------
  'R005-A01': async (ui, c) => {
    c.eq('Moneda de visualización', await ui.value('display'), 'EUR');
    c.eq('Total del mes', await total(ui), '433.84 EUR');
  },
  'R005-A02': async (ui, c) => {
    await ui.select('display', 'USD');
    c.eq('USD', await total(ui), '472.95 USD');
    await ui.select('display', 'GBP');
    c.eq('GBP', await total(ui), '371.15 GBP');
  },
  'R005-A03': async (ui, c) => {
    await ui.select('display', 'USD');
    c.eq('Presupuestos', await budgets(ui), [
      budget('Comida', '159.05', '272.54', 'USD'), budget('Transporte', '108.58', '130.82', 'USD'), budget('Ocio', '90.91', '109.02', 'USD'),
      budget('Hogar', '93.97', '436.06', 'USD'), budget('Salud', '20.44', '65.41', 'USD')
    ]);
  },
  'R005-A04': async (ui, c) => {
    await ui.select('month', '2026-02'); await ui.select('display', 'GBP');
    c.eq('Total del mes', await total(ui), '427.59 GBP');
    const rows = await budgets(ui);
    c.eq('Ocio', rows[2], budget('Ocio', '90.53', '85.55', 'GBP', true));
    c.eq('Salud', rows[4], budget('Salud', '51.33', '51.33', 'GBP', false));
  },
  'R005-A05': async (ui, c, { byId }) => {
    await ui.select('display', 'USD');
    await startsWith(ui, c, 'G004', line(byId.G004));
    await startsWith(ui, c, 'G001', line(byId.G001));
  },
  'R005-A06': async (ui, c) => {
    await ui.select('display', 'USD'); await ui.select('month', '2026-03');
    c.eq('marzo en USD', await total(ui), '524.89 USD');
    await ui.select('display', 'EUR');
    c.eq('marzo en EUR', await total(ui), '481.48 EUR');
    c.eq('Comida', (await budgets(ui))[0], budget('Comida', '183.64', '250.00'));
  }
};
