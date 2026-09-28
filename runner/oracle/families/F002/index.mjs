// Oráculo de F002 (tablero de tareas). Planes vinculados por hash a oracle/F002/*.cases.yaml (spec-lock.json).
// Las expectativas se derivan del fixture (estado por filtro, resumen) o se transcriben del texto del caso.
import { labeled } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F002';
export const ID_PREFIX = 'K';
export const FIXTURE = 'fixtures/tasks.json';
export const FIXTURE_SCHEMA = {
  type: 'array', minItems: 24, maxItems: 24,
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', pattern: '^K0[0-2][0-9]$' },
      title: { type: 'string', minLength: 1 },
      priority: { enum: ['alta', 'media', 'baja'] },
      status: { enum: ['pendiente', 'en_curso', 'hecha'] },
      estimate: { type: 'integer', minimum: 1, maximum: 8 }
    },
    required: ['id', 'title', 'priority', 'status', 'estimate'],
    additionalProperties: false
  }
};

export function checkFixture(tasks, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  demand(JSON.stringify(tasks.map(t => t.id)) === JSON.stringify(Array.from({ length: 24 }, (_, i) => `K${String(i + 1).padStart(3, '0')}`)), 'IDs de tareas deben ser K001–K024 ordenados');
  demand(new Set(tasks.map(t => t.title.toLowerCase())).size === tasks.length, 'Títulos de tareas repetidos');
  const counts = Object.fromEntries(['pendiente', 'en_curso', 'hecha'].map(s => [s, tasks.filter(t => t.status === s).length]));
  demand(JSON.stringify(counts) === JSON.stringify(family.fixture.summary?.status_counts), 'Conteo por estado distinto del declarado');
  demand(tasks.filter(t => t.status !== 'hecha').reduce((n, t) => n + t.estimate, 0) === family.fixture.summary?.remaining_hours, 'Horas restantes distintas de las declaradas');
  demand(tasks.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  status: { role: 'combobox', name: 'Estado' },
  advance: { role: 'button', name: 'Avanzar' },
  title: { role: 'textbox', name: 'Título' },
  hours: { role: 'spinbutton', name: 'Horas' },
  add: { role: 'button', name: 'Añadir' },
  summary: { role: 'status', name: 'Resumen' },
  undo: { role: 'button', name: 'Deshacer' }
};
export const LISTS = { tasks: { name: 'Tareas', id: 'K\\d{3}' } };

export const context = tasks => ({ tasks });

// ---------- utilidades ----------
const byStatus = (tasks, status) => tasks.filter(t => t.status === status).map(t => t.id);
const all = tasks => tasks.map(t => t.id);
const view = ui => ui.ids('tasks');
const filter = async (ui, value) => ui.select('status', value);
const advance = (ui, id) => ui.rowClick('tasks', id, CONTROL.advance);
async function create(ui, title, hours) {
  await ui.fill('title', title);
  if (hours !== undefined) await ui.fill('hours', String(hours));
  await ui.click('add');
}
async function summary(ui) {
  const text = await ui.text('summary');
  return { pendientes: labeled(text, 'Pendientes'), en_curso: labeled(text, 'En curso'), hechas: labeled(text, 'Hechas'), horas: labeled(text, 'Horas restantes') };
}
const counts = (pendientes, en_curso, hechas, horas) => ({ pendientes, en_curso, hechas, horas });
const alertMatches = async (ui, text) => (await ui.alerts()).some(a => a.includes(text));
const without = (list, id) => list.filter(x => x !== id);
// Inserta un ID en una lista de IDs del fixture respetando el orden del fixture.
const inserted = (list, id) => [...list, id].sort();

export const PLANS = {
  // ---------- R001 — filtro por estado (V0) ----------
  'R001-A01': async (ui, c, { tasks }) => {
    c.eq('tareas al cargar', await view(ui), all(tasks));
  },
  'R001-A02': async (ui, c, { tasks }) => {
    await filter(ui, 'pendiente');
    c.eq('pendiente', await view(ui), byStatus(tasks, 'pendiente'));
  },
  'R001-A03': async (ui, c, { tasks }) => {
    await filter(ui, 'en_curso');
    c.eq('en_curso', await view(ui), byStatus(tasks, 'en_curso'));
  },
  'R001-A04': async (ui, c, { tasks }) => {
    await filter(ui, 'hecha');
    c.eq('hecha', await view(ui), byStatus(tasks, 'hecha'));
  },
  'R001-A05': async (ui, c, { tasks }) => {
    await filter(ui, 'hecha'); await filter(ui, 'todas');
    c.eq('todas tras hecha', await view(ui), all(tasks));
  },

  // ---------- R002 — avanzar estado (V0) ----------
  'R002-A01': async (ui, c, { tasks }) => {
    await advance(ui, 'K001');
    await filter(ui, 'en_curso');
    c.eq('en_curso', await view(ui), inserted(byStatus(tasks, 'en_curso'), 'K001'));
    await filter(ui, 'pendiente');
    c.eq('pendiente', await view(ui), without(byStatus(tasks, 'pendiente'), 'K001'));
  },
  'R002-A02': async (ui, c, { tasks }) => {
    await advance(ui, 'K002');
    await filter(ui, 'hecha');
    c.eq('hecha', await view(ui), inserted(byStatus(tasks, 'hecha'), 'K002'));
    await filter(ui, 'en_curso');
    c.eq('en_curso', await view(ui), without(byStatus(tasks, 'en_curso'), 'K002'));
  },
  'R002-A03': async (ui, c, { tasks }) => {
    c.eq('K003 sin avance habilitado', await ui.rowEnabled('tasks', 'K003', CONTROL.advance), false);
    await ui.rowTryClick('tasks', 'K003', CONTROL.advance);
    await filter(ui, 'hecha');
    c.eq('hecha', await view(ui), byStatus(tasks, 'hecha'));
  },
  'R002-A04': async (ui, c, { tasks }) => {
    await filter(ui, 'pendiente');
    await advance(ui, 'K004');
    const first = without(byStatus(tasks, 'pendiente'), 'K004');
    c.eq('pendiente tras K004', await view(ui), first);
    await advance(ui, 'K008');
    c.eq('pendiente tras K008', await view(ui), without(first, 'K008'));
  },
  'R002-A05': async (ui, c, { tasks }) => {
    await advance(ui, 'K001'); await advance(ui, 'K001');
    await filter(ui, 'pendiente');
    c.eq('pendiente', await view(ui), without(byStatus(tasks, 'pendiente'), 'K001'));
    await filter(ui, 'en_curso');
    c.eq('en_curso', await view(ui), byStatus(tasks, 'en_curso'));
    await filter(ui, 'hecha');
    c.eq('hecha', await view(ui), inserted(byStatus(tasks, 'hecha'), 'K001'));
  },

  // ---------- R003 — crear tarea (V1) ----------
  'R003-A01': async (ui, c, { tasks }) => {
    await create(ui, 'Comprar sobres', 2);
    const rows = await ui.rows('tasks');
    c.eq('IDs', rows.map(r => r.id), [...all(tasks), 'K025']);
    c.eq('texto de la nueva tarea', rows.at(-1)?.text.startsWith('K025 Comprar sobres'), true);
  },
  'R003-A02': async (ui, c, { tasks }) => {
    await create(ui, '   ');
    c.eq('sin tarea tras espacios', await view(ui), all(tasks));
    c.eq('aviso', await alertMatches(ui, 'El título es obligatorio'), true);
    await create(ui, '');
    c.eq('sin tarea tras vacío', await view(ui), all(tasks));
    c.eq('aviso', await alertMatches(ui, 'El título es obligatorio'), true);
  },
  'R003-A03': async (ui, c, { tasks }) => {
    await create(ui, 'Llamar al banco');
    await create(ui, 'Pagar seguro');
    const rows = await ui.rows('tasks');
    c.eq('IDs', rows.map(r => r.id), [...all(tasks), 'K025', 'K026']);
    c.eq('K025', rows.at(-2)?.text.startsWith('K025 Llamar al banco'), true);
    c.eq('K026', rows.at(-1)?.text.startsWith('K026 Pagar seguro'), true);
  },
  'R003-A04': async (ui, c, { tasks }) => {
    await create(ui, 'Revisar caldera');
    await filter(ui, 'pendiente');
    c.eq('pendiente', await view(ui), [...byStatus(tasks, 'pendiente'), 'K025']);
    await advance(ui, 'K025');
    c.eq('pendiente tras avanzar', await view(ui), byStatus(tasks, 'pendiente'));
    await filter(ui, 'en_curso');
    c.eq('en_curso', await view(ui), [...byStatus(tasks, 'en_curso'), 'K025']);
  },
  'R003-A05': async (ui, c) => {
    await create(ui, 'Ordenar archivo', 4);
    c.eq('título', await ui.value('title'), '');
    c.eq('horas', await ui.value('hours'), '1');
  },
  'R003-A06': async (ui, c, { tasks }) => {
    await ui.fill('title', 'Tarea larga');
    for (const hours of ['9', '0', '2.5']) {
      await ui.fill('title', 'Tarea larga');
      await ui.fill('hours', hours);
      await ui.click('add');
      c.eq(`sin tarea con horas ${hours}`, await view(ui), all(tasks));
      c.eq(`aviso con horas ${hours}`, await alertMatches(ui, 'Las horas deben ser un número entero entre 1 y 8'), true);
    }
  },

  // ---------- R004 — resumen (V2) ----------
  'R004-A01': async (ui, c) => {
    c.eq('resumen inicial', await summary(ui), counts(10, 7, 7, 65));
  },
  'R004-A02': async (ui, c) => {
    await advance(ui, 'K001');
    c.eq('tras K001', await summary(ui), counts(9, 8, 7, 65));
    await advance(ui, 'K002');
    c.eq('tras K002', await summary(ui), counts(9, 7, 8, 60));
  },
  'R004-A03': async (ui, c) => {
    await create(ui, 'Revisar alarma', 3);
    c.eq('tras crear', await summary(ui), counts(11, 7, 7, 68));
  },
  'R004-A04': async (ui, c) => {
    await filter(ui, 'hecha');
    c.eq('con hecha', await summary(ui), counts(10, 7, 7, 65));
    await filter(ui, 'pendiente');
    c.eq('con pendiente', await summary(ui), counts(10, 7, 7, 65));
  },
  'R004-A05': async (ui, c) => {
    await create(ui, 'Cambiar cerradura', 4);
    c.eq('tras crear', await summary(ui), counts(11, 7, 7, 69));
    await advance(ui, 'K025'); await advance(ui, 'K025');
    c.eq('tras llevar K025 a hecha', await summary(ui), counts(10, 7, 8, 65));
  },

  // ---------- R005 — deshacer (V3) ----------
  'R005-A01': async (ui, c, { tasks }) => {
    await advance(ui, 'K001'); await ui.click('undo');
    await filter(ui, 'pendiente');
    c.eq('pendiente', await view(ui), byStatus(tasks, 'pendiente'));
    await filter(ui, 'en_curso');
    c.eq('en_curso', await view(ui), byStatus(tasks, 'en_curso'));
  },
  'R005-A02': async (ui, c, { tasks }) => {
    await create(ui, 'Tarea temporal'); await ui.click('undo');
    c.eq('tras deshacer', await view(ui), all(tasks));
    await create(ui, 'Tarea definitiva');
    const rows = await ui.rows('tasks');
    c.eq('IDs', rows.map(r => r.id), [...all(tasks), 'K025']);
    c.eq('texto', rows.at(-1)?.text.startsWith('K025 Tarea definitiva'), true);
  },
  'R005-A03': async (ui, c, { tasks }) => {
    await advance(ui, 'K001'); await advance(ui, 'K001'); await create(ui, 'Nota');
    await ui.click('undo');
    c.eq('tras 1', await view(ui), all(tasks));
    await filter(ui, 'hecha');
    c.eq('K001 sigue hecha', (await view(ui)).includes('K001'), true);
    await filter(ui, 'todas');
    await ui.click('undo');
    await filter(ui, 'en_curso');
    c.eq('tras 2: en_curso', await view(ui), inserted(byStatus(tasks, 'en_curso'), 'K001'));
    await filter(ui, 'todas');
    await ui.click('undo');
    await filter(ui, 'pendiente');
    c.eq('tras 3: pendiente', await view(ui), byStatus(tasks, 'pendiente'));
    await filter(ui, 'todas');
    c.eq('tras 3: todas', await view(ui), all(tasks));
  },
  'R005-A04': async (ui, c) => {
    c.eq('al cargar', await ui.enabled('undo'), false);
    await create(ui, '');
    c.eq('tras creación rechazada', await ui.enabled('undo'), false);
    await advance(ui, 'K004');
    c.eq('tras avanzar', await ui.enabled('undo'), true);
    await ui.click('undo');
    c.eq('tras deshacer', await ui.enabled('undo'), false);
  },
  'R005-A05': async (ui, c) => {
    await advance(ui, 'K002');
    await create(ui, 'Informe extra', 2);
    await ui.click('undo');
    c.eq('tras el primer deshacer', await summary(ui), counts(10, 6, 8, 60));
    await ui.click('undo');
    c.eq('tras el segundo deshacer', await summary(ui), counts(10, 7, 7, 65));
  },
  'R005-A06': async (ui, c, { tasks }) => {
    await filter(ui, 'pendiente');
    await advance(ui, 'K001');
    await filter(ui, 'hecha');
    await ui.click('undo');
    c.eq('filtro conservado', await ui.value('status'), 'hecha');
    c.eq('vista hecha', await view(ui), byStatus(tasks, 'hecha'));
    await filter(ui, 'pendiente');
    c.eq('pendiente con K001', await view(ui), byStatus(tasks, 'pendiente'));
  }
};
