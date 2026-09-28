// Oráculo de F010 (préstamos de biblioteca). Planes vinculados por hash a oracle/F010/*.cases.yaml (spec-lock.json).
// Las expectativas se derivan del fixture (ejemplares, loan_days, renew_days, start_day) o se transcriben del caso.
import { labeled } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F010';
export const ID_PREFIX = 'L';
export const FIXTURE = 'fixtures/library.json';
export const FIXTURE_SCHEMA = {
  type: 'object',
  properties: {
    loan_days: { const: 14 },
    renew_days: { const: 7 },
    start_day: { const: 1 },
    books: {
      type: 'array', minItems: 15, maxItems: 15,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^L0[01][0-9]$' },
          title: { type: 'string', minLength: 1 },
          author: { type: 'string', minLength: 1 },
          copies: { enum: [1, 2] }
        },
        required: ['id', 'title', 'author', 'copies'],
        additionalProperties: false
      }
    }
  },
  required: ['loan_days', 'renew_days', 'start_day', 'books'],
  additionalProperties: false
};

export function checkFixture(library, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const books = library.books ?? [];
  const summary = family.fixture.summary ?? {};
  demand(JSON.stringify(books.map(b => b.id)) === JSON.stringify(Array.from({ length: 15 }, (_, i) => `L${String(i + 1).padStart(3, '0')}`)), 'IDs de libros deben ser L001–L015 ordenados');
  demand(new Set(books.map(b => b.title.toLowerCase())).size === books.length, 'Títulos repetidos');
  demand(books.reduce((n, b) => n + b.copies, 0) === summary.total_copies, 'Total de ejemplares distinto del declarado');
  demand(JSON.stringify({ 1: books.filter(b => b.copies === 1).length, 2: books.filter(b => b.copies === 2).length }) === JSON.stringify(summary.books_by_copies), 'Reparto de ejemplares distinto del declarado');
  demand(library.loan_days === summary.loan_days && library.renew_days === summary.renew_days && library.start_day === summary.start_day, 'Parámetros de préstamo distintos de los declarados');
  demand(books.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  lend: { role: 'button', name: 'Prestar' },
  giveBack: { role: 'button', name: 'Devolver' },
  day: { role: 'status', name: 'Día' },
  advance: { role: 'button', name: 'Avanzar día' },
  overdue: { role: 'status', name: 'Vencidos' },
  renew: { role: 'button', name: 'Renovar' },
  restriction: { role: 'status', name: 'Restricción' }
};
export const LISTS = {
  catalog: { name: 'Catálogo', id: 'L\\d{3}' },
  loans: { name: 'Préstamos', id: 'L\\d{3}' },
  history: { name: 'Historial', id: 'L\\d{3}' }
};

export const context = library => ({ library, books: library.books, copies: Object.fromEntries(library.books.map(b => [b.id, b.copies])) });

// ---------- utilidades ----------
const LIMIT = 'Límite de 3 préstamos alcanzado';
const OVERDUE = 'Hay préstamos vencidos';
const lend = (ui, id) => ui.rowClick('catalog', id, CONTROL.lend);
const giveBack = (ui, id) => ui.rowClick('loans', id, CONTROL.giveBack);
const renew = (ui, id) => ui.rowClick('loans', id, CONTROL.renew);
const canLend = (ui, id) => ui.rowEnabled('catalog', id, CONTROL.lend);
const canRenew = (ui, id) => ui.rowEnabled('loans', id, CONTROL.renew);
async function advance(ui, times = 1) { for (let i = 0; i < times; i++) await ui.click('advance'); }
async function available(ui) {
  return Object.fromEntries((await ui.rows('catalog')).map(r => [r.id, labeled(r.text, 'Disponibles')]));
}
const availableOf = async (ui, id) => (await available(ui))[id] ?? null;
const due = text => Number(text.match(/vence día\s*(\d+)(?!\d)/)?.[1] ?? NaN);
// Préstamos visibles: [{ id, due }] (+ overdue / renewals si se piden).
async function loans(ui, { overdue = false, renewals = false } = {}) {
  return (await ui.rows('loans')).map(r => ({
    id: r.id, due: due(r.text),
    ...(overdue ? { overdue: /(?<![A-Za-zÁÉÍÓÚáéíóúñ])Vencido(?![A-Za-záéíóúñ])/.test(r.text) } : {}),
    ...(renewals ? { renewals: labeled(r.text, 'Renovaciones') } : {})
  }));
}
const day = async ui => labeled(await ui.textOrNull('day'), 'Día');
const overdueCount = async ui => labeled(await ui.textOrNull('overdue'), 'Vencidos');
const restriction = async ui => (await ui.textOrNull('restriction')) ?? '';
const history = async ui => (await ui.rows('history')).map(r => ({ id: r.id, text: r.text.match(/prestado día\s*\d+,\s*devuelto día\s*\d+/)?.[0] ?? r.text }));

export const PLANS = {
  // ---------- R001 — prestar (V0) ----------
  'R001-A01': async (ui, c, { books, copies }) => {
    c.eq('catálogo', await ui.ids('catalog'), books.map(b => b.id));
    c.eq('disponibles', await available(ui), copies);
    c.eq('préstamos', await ui.ids('loans'), []);
  },
  'R001-A02': async (ui, c) => {
    await lend(ui, 'L003');
    c.eq('L003 disponibles', await availableOf(ui, 'L003'), 0);
    c.eq('L003 Prestar', await canLend(ui, 'L003'), false);
    const rows = await ui.rows('loans');
    c.eq('préstamos', rows.map(r => r.id), ['L003']);
    c.eq('texto', [rows[0]?.text.startsWith('L003 La isla de los relojes') ?? false, due(rows[0]?.text ?? '')], [true, 15]);
  },
  'R001-A03': async (ui, c) => {
    await lend(ui, 'L001');
    c.eq('tras el primero', [await availableOf(ui, 'L001'), await canLend(ui, 'L001')], [1, true]);
    await lend(ui, 'L001');
    c.eq('tras el segundo', [await availableOf(ui, 'L001'), await canLend(ui, 'L001')], [0, false]);
    c.eq('préstamos', await ui.ids('loans'), ['L001', 'L001']);
  },
  'R001-A04': async (ui, c, { copies }) => {
    await lend(ui, 'L005'); await lend(ui, 'L002'); await lend(ui, 'L009');
    c.eq('préstamos', await ui.ids('loans'), ['L005', 'L002', 'L009']);
    c.eq('disponibles', await available(ui), { ...copies, L002: 0, L005: 0, L009: 1 });
  },
  'R001-A05': async (ui, c) => {
    await lend(ui, 'L012'); await lend(ui, 'L004'); await lend(ui, 'L012');
    const rows = await ui.rows('loans');
    c.eq('préstamos', await loans(ui), [{ id: 'L012', due: 15 }, { id: 'L004', due: 15 }, { id: 'L012', due: 15 }]);
    c.eq('título', rows[0]?.text.startsWith('L012 El vuelo de la garza') ?? false, true);
  },

  // ---------- R002 — devolver y persistir (V0) ----------
  'R002-A01': async (ui, c) => {
    await lend(ui, 'L003'); await giveBack(ui, 'L003');
    c.eq('préstamos', await ui.ids('loans'), []);
    c.eq('L003', [await availableOf(ui, 'L003'), await canLend(ui, 'L003')], [1, true]);
  },
  'R002-A02': async (ui, c) => {
    await lend(ui, 'L001'); await lend(ui, 'L001'); await giveBack(ui, 'L001');
    c.eq('préstamos', await ui.ids('loans'), ['L001']);
    c.eq('L001 disponibles', await availableOf(ui, 'L001'), 1);
  },
  'R002-A03': async (ui, c) => {
    await lend(ui, 'L002'); await lend(ui, 'L006'); await lend(ui, 'L011'); await giveBack(ui, 'L006');
    c.eq('préstamos', await ui.ids('loans'), ['L002', 'L011']);
    c.eq('L006 disponibles', await availableOf(ui, 'L006'), 2);
  },
  'R002-A04': async (ui, c) => {
    await lend(ui, 'L003'); await lend(ui, 'L009');
    await ui.reload();
    c.eq('préstamos', await loans(ui), [{ id: 'L003', due: 15 }, { id: 'L009', due: 15 }]);
    c.eq('disponibles', [await availableOf(ui, 'L003'), await availableOf(ui, 'L009')], [0, 1]);
  },
  'R002-A05': async (ui, c) => {
    await lend(ui, 'L003'); await lend(ui, 'L004'); await giveBack(ui, 'L003');
    await ui.reload();
    c.eq('préstamos', await ui.ids('loans'), ['L004']);
    c.eq('disponibles', [await availableOf(ui, 'L003'), await availableOf(ui, 'L004')], [1, 1]);
  },
  'R002-A06': async (ui, c) => {
    await lend(ui, 'L007');
    await ui.reload();
    await giveBack(ui, 'L007');
    await ui.reload();
    c.eq('préstamos', await ui.ids('loans'), []);
    c.eq('L007 disponibles', await availableOf(ui, 'L007'), 1);
  },

  // ---------- R003 — días y vencidos (V1) ----------
  'R003-A01': async (ui, c) => {
    c.eq('al cargar', [await day(ui), await overdueCount(ui)], [1, 0]);
    await advance(ui, 3);
    c.eq('tras 3', await day(ui), 4);
  },
  'R003-A02': async (ui, c) => {
    await lend(ui, 'L003');
    await advance(ui, 14);
    c.eq('día 15', [await day(ui), await loans(ui, { overdue: true }), await overdueCount(ui)], [15, [{ id: 'L003', due: 15, overdue: false }], 0]);
    await advance(ui);
    c.eq('día 16', [await day(ui), await loans(ui, { overdue: true }), await overdueCount(ui)], [16, [{ id: 'L003', due: 15, overdue: true }], 1]);
  },
  'R003-A03': async (ui, c) => {
    await lend(ui, 'L003');
    await advance(ui, 5);
    await lend(ui, 'L005');
    c.eq('día', await day(ui), 6);
    c.eq('préstamos', await loans(ui), [{ id: 'L003', due: 15 }, { id: 'L005', due: 20 }]);
  },
  'R003-A04': async (ui, c) => {
    await lend(ui, 'L003'); await advance(ui, 5); await lend(ui, 'L005');
    await advance(ui, 10);
    c.eq('día 16', [await day(ui), (await loans(ui, { overdue: true })).map(l => l.overdue), await overdueCount(ui)], [16, [true, false], 1]);
    await advance(ui, 5);
    c.eq('día 21', [await day(ui), (await loans(ui, { overdue: true })).map(l => l.overdue), await overdueCount(ui)], [21, [true, true], 2]);
  },
  'R003-A05': async (ui, c) => {
    await advance(ui, 3); await lend(ui, 'L003');
    await ui.reload();
    c.eq('primera recarga', [await day(ui), await loans(ui)], [4, [{ id: 'L003', due: 18 }]]);
    await advance(ui, 15);
    await ui.reload();
    c.eq('segunda recarga', [await day(ui), await loans(ui, { overdue: true }), await overdueCount(ui)], [19, [{ id: 'L003', due: 18, overdue: true }], 1]);
  },
  'R003-A06': async (ui, c) => {
    await lend(ui, 'L003'); await lend(ui, 'L004'); await advance(ui, 15);
    c.eq('día 16', [await day(ui), await overdueCount(ui)], [16, 2]);
    await giveBack(ui, 'L003');
    c.eq('tras devolver', [await overdueCount(ui), await ui.ids('loans'), await availableOf(ui, 'L003')], [1, ['L004'], 1]);
  },

  // ---------- R004 — renovaciones (V2) ----------
  'R004-A01': async (ui, c) => {
    await lend(ui, 'L003');
    c.eq('antes', await loans(ui, { renewals: true }), [{ id: 'L003', due: 15, renewals: 0 }]);
    await renew(ui, 'L003');
    c.eq('después', await loans(ui, { renewals: true }), [{ id: 'L003', due: 22, renewals: 1 }]);
  },
  'R004-A02': async (ui, c) => {
    await lend(ui, 'L003'); await renew(ui, 'L003'); await renew(ui, 'L003');
    c.eq('tras dos', [await loans(ui, { renewals: true }), await canRenew(ui, 'L003')], [[{ id: 'L003', due: 29, renewals: 2 }], false]);
    await ui.rowTryClick('loans', 'L003', CONTROL.renew);
    c.eq('tras intentar', (await loans(ui)).map(l => l.due), [29]);
  },
  'R004-A03': async (ui, c) => {
    await lend(ui, 'L003'); await advance(ui, 15);
    c.eq('vencido', [(await loans(ui, { overdue: true }))[0]?.overdue ?? null, await canRenew(ui, 'L003')], [true, false]);
    await ui.rowTryClick('loans', 'L003', CONTROL.renew);
    c.eq('sin cambios', await loans(ui, { renewals: true }), [{ id: 'L003', due: 15, renewals: 0 }]);
  },
  'R004-A04': async (ui, c) => {
    await lend(ui, 'L003'); await advance(ui, 14);
    c.eq('día 15', [await day(ui), await canRenew(ui, 'L003')], [15, true]);
    await renew(ui, 'L003'); await advance(ui);
    c.eq('día 16', [await day(ui), await loans(ui, { overdue: true }), await overdueCount(ui)], [16, [{ id: 'L003', due: 22, overdue: false }], 0]);
  },
  'R004-A05': async (ui, c) => {
    await lend(ui, 'L003'); await advance(ui, 10); await renew(ui, 'L003');
    await ui.reload();
    c.eq('primera recarga', await loans(ui, { renewals: true }), [{ id: 'L003', due: 22, renewals: 1 }]);
    await renew(ui, 'L003');
    await ui.reload();
    c.eq('segunda recarga', [await loans(ui, { renewals: true }), await canRenew(ui, 'L003')], [[{ id: 'L003', due: 29, renewals: 2 }], false]);
  },
  'R004-A06': async (ui, c) => {
    await lend(ui, 'L001'); await lend(ui, 'L001'); await renew(ui, 'L001');
    c.eq('préstamos', await loans(ui, { renewals: true }), [{ id: 'L001', due: 22, renewals: 1 }, { id: 'L001', due: 15, renewals: 0 }]);
  },

  // ---------- R005 — límites e historial (V3) ----------
  'R005-A01': async (ui, c) => {
    await lend(ui, 'L001'); await lend(ui, 'L002'); await lend(ui, 'L003');
    await ui.rowTryClick('catalog', 'L004', CONTROL.lend);
    c.eq('Prestar L001 y L004', [await canLend(ui, 'L001'), await canLend(ui, 'L004')], [false, false]);
    c.eq('aviso', (await restriction(ui)).includes(LIMIT), true);
    c.eq('préstamos', await ui.ids('loans'), ['L001', 'L002', 'L003']);
  },
  'R005-A02': async (ui, c) => {
    await lend(ui, 'L001'); await lend(ui, 'L002'); await lend(ui, 'L003');
    c.eq('con 3 préstamos', [await canLend(ui, 'L004'), (await restriction(ui)).includes(LIMIT)], [false, true]);
    await giveBack(ui, 'L002');
    c.eq('tras devolver', [await canLend(ui, 'L004'), (await restriction(ui)).includes(LIMIT)], [true, false]);
    await lend(ui, 'L004');
    c.eq('préstamos', await ui.ids('loans'), ['L001', 'L003', 'L004']);
  },
  'R005-A03': async (ui, c) => {
    await lend(ui, 'L003'); await advance(ui, 15);
    await ui.rowTryClick('catalog', 'L001', CONTROL.lend);
    c.eq('día 16', [await day(ui), await canLend(ui, 'L001'), (await restriction(ui)).includes(OVERDUE), await ui.ids('loans')], [16, false, true, ['L003']]);
    await giveBack(ui, 'L003');
    c.eq('tras devolver', [await canLend(ui, 'L001'), (await restriction(ui)).includes(OVERDUE)], [true, false]);
  },
  'R005-A04': async (ui, c) => {
    await lend(ui, 'L003'); await advance(ui, 14);
    c.eq('día 15', [await day(ui), await canLend(ui, 'L005')], [15, true]);
    await lend(ui, 'L005');
    c.eq('préstamos', await loans(ui), [{ id: 'L003', due: 15 }, { id: 'L005', due: 29 }]);
    await advance(ui);
    c.eq('día 16', [await day(ui), await canLend(ui, 'L001'), (await restriction(ui)).includes(OVERDUE)], [16, false, true]);
  },
  'R005-A05': async (ui, c) => {
    c.eq('al cargar', await history(ui), []);
    await lend(ui, 'L003'); await advance(ui, 4); await giveBack(ui, 'L003');
    c.eq('historial', await history(ui), [{ id: 'L003', text: 'prestado día 1, devuelto día 5' }]);
  },
  'R005-A06': async (ui, c) => {
    await lend(ui, 'L003'); await lend(ui, 'L006'); await advance(ui, 2); await giveBack(ui, 'L006');
    await advance(ui, 3); await giveBack(ui, 'L003');
    const expected = [{ id: 'L003', text: 'prestado día 1, devuelto día 6' }, { id: 'L006', text: 'prestado día 1, devuelto día 3' }];
    c.eq('historial', await history(ui), expected);
    await ui.reload();
    c.eq('historial tras recargar', await history(ui), expected);
  },
  'R005-A07': async (ui, c) => {
    await lend(ui, 'L001'); await lend(ui, 'L002'); await lend(ui, 'L003'); await advance(ui, 15);
    const text = await restriction(ui);
    c.eq('aviso', [text.includes(OVERDUE), text.includes(LIMIT)], [true, false]);
    c.eq('Prestar L004', await canLend(ui, 'L004'), false);
  }
};
