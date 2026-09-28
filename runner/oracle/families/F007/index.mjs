// Oráculo de F007 (reserva de salas). Planes vinculados por hash a oracle/F007/*.cases.yaml (spec-lock.json).
// Las expectativas se transcriben del texto del caso; los textos de los elementos del fixture se derivan de ctx.
import { labeled } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F007';
export const ID_PREFIX = 'B';
export const FIXTURE = 'fixtures/bookings.json';

const TIME = '^([01][0-9]|2[0-3]):[0-5][0-9]$';
const DATE = '^2026-[0-9]{2}-[0-9]{2}$';
export const FIXTURE_SCHEMA = {
  type: 'object',
  properties: {
    rooms: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          id: { enum: ['norte', 'sur', 'auditorio'] },
          name: { type: 'string', minLength: 1 },
          capacity: { type: 'integer', minimum: 1 }
        },
        required: ['id', 'name', 'capacity'],
        additionalProperties: false
      }
    },
    days: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string', pattern: DATE } },
    opening: { type: 'string', pattern: TIME },
    closing: { type: 'string', pattern: TIME },
    bookings: {
      type: 'array', minItems: 14, maxItems: 14,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^B0[0-9]{2}$' },
          room: { enum: ['norte', 'sur', 'auditorio'] },
          date: { type: 'string', pattern: DATE },
          start: { type: 'string', pattern: TIME },
          end: { type: 'string', pattern: TIME },
          title: { type: 'string', minLength: 1 },
          attendees: { type: 'integer', minimum: 1 }
        },
        required: ['id', 'room', 'date', 'start', 'end', 'title', 'attendees'],
        additionalProperties: false
      }
    }
  },
  required: ['rooms', 'days', 'opening', 'closing', 'bookings'],
  additionalProperties: false
};

const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function checkFixture(fixture, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const { rooms, days, bookings } = fixture;
  demand(JSON.stringify(rooms.map(r => r.id)) === JSON.stringify(['norte', 'sur', 'auditorio']), 'Salas deben ser norte, sur, auditorio en ese orden');
  demand(JSON.stringify(days) === JSON.stringify(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']), 'Días deben ser 2026-03-02…2026-03-06 (lunes a viernes)');
  demand(fixture.opening === '08:00' && fixture.closing === '19:00', 'Horario debe ser 08:00–19:00');
  demand(JSON.stringify(bookings.map(b => b.id)) === JSON.stringify(Array.from({ length: 14 }, (_, i) => `B${String(i + 1).padStart(3, '0')}`)), 'IDs de reservas deben ser B001–B014 ordenados');
  const capacity = Object.fromEntries(rooms.map(r => [r.id, r.capacity]));
  let contiguous = 0;
  for (const b of bookings) {
    const [s, e] = [minutes(b.start), minutes(b.end)];
    demand(days.includes(b.date), `${b.id}: fecha fuera de la semana`);
    demand(s % 30 === 0 && e % 30 === 0 && s < e && e - s <= 120, `${b.id}: intervalo fuera de la rejilla de 30 minutos o de duración inválida`);
    demand(s >= minutes(fixture.opening) && e <= minutes(fixture.closing), `${b.id}: fuera del horario`);
    demand(b.attendees <= capacity[b.room], `${b.id}: asistentes por encima de la capacidad`);
    for (const o of bookings) {
      if (o === b || o.room !== b.room || o.date !== b.date) continue;
      demand(!(s < minutes(o.end) && minutes(o.start) < e), `${b.id} se solapa con ${o.id}`);
      if (b.end === o.start) contiguous++;
    }
  }
  demand(contiguous >= 2, 'Se esperan al menos dos pares de reservas contiguas');
  demand(bookings.some(b => b.end === fixture.closing), 'Se espera una reserva que termine a la hora de cierre');
  const summary = family.fixture.summary ?? {};
  demand(summary.rooms === rooms.length && summary.days === days.length, 'summary: salas/días distintos del fixture');
  const perRoom = Object.fromEntries(rooms.map(r => [r.id, bookings.filter(b => b.room === r.id).length]));
  demand(JSON.stringify(perRoom) === JSON.stringify(summary.bookings_per_room), 'summary.bookings_per_room distinto del fixture');
  const hours = Object.fromEntries(rooms.map(r => [r.id, bookings.filter(b => b.room === r.id).reduce((n, b) => n + minutes(b.end) - minutes(b.start), 0) / 60]));
  demand(JSON.stringify(hours) === JSON.stringify(summary.week_hours), 'summary.week_hours distinto del fixture');
  demand(bookings.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  room: { role: 'combobox', name: 'Sala' },
  day: { role: 'combobox', name: 'Día' },
  title: { role: 'textbox', name: 'Título' },
  start: { role: 'combobox', name: 'Inicio' },
  duration: { role: 'combobox', name: 'Duración' },
  book: { role: 'button', name: 'Reservar' },
  cancel: { role: 'button', name: 'Cancelar' },
  view: { role: 'combobox', name: 'Vista' },
  hours: { role: 'status', name: 'Horas reservadas' },
  attendees: { role: 'spinbutton', name: 'Asistentes' }
};
export const LISTS = { bookings: { name: 'Reservas', id: 'B\\d{3}' } };

export const context = fixture => ({ fixture, byId: Object.fromEntries(fixture.bookings.map(b => [b.id, b])) });

// ---------- utilidades ----------
const view = ui => ui.ids('bookings');
// Guiones: se admite «-» o «—» en lugar de «–» entre las horas (diferencia tipográfica, no funcional).
const dashes = text => text.replace(/(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})/g, '$1–$2');
const line = (b, withDate = false) => `${b.id} ${withDate ? `${b.date} ` : ''}${b.start}–${b.end} ${b.title}`;
async function startsWith(ui, c, id, expected) {
  const text = dashes(await ui.rowText('bookings', id));
  c.eq(`${id} comienza con «${expected}»`, text.startsWith(expected) ? expected : text, expected);
}
async function attendeesOf(ui, id) {
  const match = (await ui.rowText('bookings', id)).match(/(\d+)\s+personas?\b/);
  return match ? match[0] : null;
}
async function book(ui, { title, start, duration, attendees } = {}) {
  if (title !== undefined) await ui.fill('title', title);
  if (attendees !== undefined) await ui.fill('attendees', String(attendees));
  if (start !== undefined) await ui.select('start', start);
  if (duration !== undefined) await ui.select('duration', String(duration));
  await ui.click('book');
}
const alertWith = async (ui, ...parts) => (await ui.alerts()).some(a => parts.every(p => a.includes(p)));
const hours = async ui => labeled(await ui.text('hours'), 'Horas reservadas');
const cancel = (ui, id) => ui.rowClick('bookings', id, CONTROL.cancel);
const NORTE_0302 = ['B003', 'B006', 'B001', 'B009'];
const NORTE_WEEK = ['B003', 'B006', 'B001', 'B009', 'B004', 'B011', 'B008', 'B013'];
const SLOTS = Array.from({ length: 22 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

export const PLANS = {
  // ---------- R001 — consulta por sala y día (V0) ----------
  'R001-A01': async (ui, c, { byId }) => {
    c.eq('Sala', await ui.value('room'), 'norte');
    c.eq('Día', await ui.value('day'), '2026-03-02');
    c.eq('Reservas', await view(ui), NORTE_0302);
    for (const id of NORTE_0302) await startsWith(ui, c, id, line(byId[id]));
  },
  'R001-A02': async (ui, c) => {
    await ui.select('room', 'sur');
    c.eq('sur 2026-03-02', await view(ui), ['B002', 'B010']);
  },
  'R001-A03': async (ui, c) => {
    await ui.select('day', '2026-03-04');
    c.eq('norte 2026-03-04', await view(ui), ['B011']);
    await ui.select('room', 'auditorio');
    c.eq('auditorio 2026-03-04', await view(ui), ['B005']);
  },
  'R001-A04': async (ui, c) => {
    await ui.select('room', 'auditorio'); await ui.select('day', '2026-03-03');
    c.eq('auditorio 2026-03-03', await view(ui), []);
    await ui.select('room', 'sur'); await ui.select('day', '2026-03-05');
    c.eq('sur 2026-03-05', await view(ui), []);
  },
  'R001-A05': async (ui, c) => {
    c.eq('opciones de Sala', (await ui.options('room')).map(o => o.value), ['norte', 'sur', 'auditorio']);
    c.eq('opciones de Día', (await ui.options('day')).map(o => o.value), ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
  },

  // ---------- R002 — crear con detección de conflictos (V0) ----------
  'R002-A01': async (ui, c) => {
    await book(ui, { title: 'Revisión legal', start: '12:00', duration: 60 });
    c.eq('Reservas', await view(ui), ['B003', 'B006', 'B001', 'B015', 'B009']);
    await startsWith(ui, c, 'B015', 'B015 12:00–13:00 Revisión legal');
    c.eq('Título vacío', await ui.value('title'), '');
  },
  'R002-A02': async (ui, c) => {
    await book(ui, { title: 'Preparación', start: '08:00', duration: 60 });
    c.eq('sin aviso tras la primera', await alertWith(ui, 'La reserva se solapa con'), false);
    await book(ui, { title: 'Seguimiento', start: '13:00', duration: 120 });
    c.eq('sin aviso tras la segunda', await alertWith(ui, 'La reserva se solapa con'), false);
    c.eq('Reservas', await view(ui), ['B015', 'B003', 'B006', 'B001', 'B016', 'B009']);
    await startsWith(ui, c, 'B015', 'B015 08:00–09:00');
    await startsWith(ui, c, 'B016', 'B016 13:00–15:00');
  },
  'R002-A03': async (ui, c) => {
    await book(ui, { title: 'Solape', start: '16:00', duration: 60 });
    c.eq('aviso 16:00', await alertWith(ui, 'La reserva se solapa con', 'B009'), true);
    c.eq('lista tras 16:00', await view(ui), NORTE_0302);
    await book(ui, { start: '14:30', duration: 60 });
    c.eq('aviso 14:30', await alertWith(ui, 'La reserva se solapa con', 'B009'), true);
    c.eq('lista tras 14:30', await view(ui), NORTE_0302);
  },
  'R002-A04': async (ui, c) => {
    await book(ui, { title: 'Bloque largo', start: '08:30', duration: 120 });
    c.eq('aviso', await alertWith(ui, 'La reserva se solapa con', 'B003'), true);
    c.eq('lista', await view(ui), NORTE_0302);
  },
  'R002-A05': async (ui, c) => {
    await ui.select('room', 'auditorio');
    await book(ui, { title: 'Ensayo', start: '09:00', duration: 90 });
    c.eq('auditorio 2026-03-02', await view(ui), ['B015', 'B012']);
    await ui.select('room', 'norte'); await ui.select('day', '2026-03-03');
    await book(ui, { title: 'Ensayo 2', start: '09:00', duration: 90 });
    c.eq('norte 2026-03-03', await view(ui), ['B016', 'B004']);
  },
  'R002-A06': async (ui, c) => {
    c.eq('opciones de Inicio', (await ui.options('start')).map(o => o.value), SLOTS);
    c.eq('opciones de Duración', (await ui.options('duration')).map(o => o.value), ['30', '60', '90', '120']);
    await ui.select('room', 'auditorio'); await ui.select('day', '2026-03-03');
    await book(ui, { title: 'Tarde', start: '18:30', duration: 60 });
    c.eq('aviso de cierre', await alertWith(ui, 'La reserva termina después del cierre'), true);
    c.eq('sin reserva', await view(ui), []);
    await book(ui, { start: '18:00', duration: 60 });
    c.eq('reserva hasta el cierre', await view(ui), ['B015']);
    await startsWith(ui, c, 'B015', 'B015 18:00–19:00 Tarde');
  },
  'R002-A07': async (ui, c) => {
    await book(ui, { title: '   ', start: '12:00' });
    c.eq('aviso con espacios', await alertWith(ui, 'El título es obligatorio'), true);
    c.eq('lista con espacios', await view(ui), NORTE_0302);
    await book(ui, { title: '' });
    c.eq('aviso vacío', await alertWith(ui, 'El título es obligatorio'), true);
    c.eq('lista vacío', await view(ui), NORTE_0302);
  },

  // ---------- R003 — cancelar (V1) ----------
  'R003-A01': async (ui, c) => {
    await cancel(ui, 'B006');
    c.eq('Reservas', await view(ui), ['B003', 'B001', 'B009']);
  },
  'R003-A02': async (ui, c) => {
    await cancel(ui, 'B009');
    c.eq('tras cancelar', await view(ui), ['B003', 'B006', 'B001']);
    await book(ui, { title: 'Nueva entrevista', start: '15:00', duration: 90 });
    c.eq('sin aviso', await alertWith(ui, 'La reserva se solapa con'), false);
    c.eq('tras reservar', await view(ui), ['B003', 'B006', 'B001', 'B015']);
    await startsWith(ui, c, 'B015', 'B015 15:00–16:30');
  },
  'R003-A03': async (ui, c) => {
    await book(ui, { title: 'Temporal', start: '12:00', duration: 60 });
    await cancel(ui, 'B015');
    await book(ui, { title: 'Definitiva', start: '12:00', duration: 60 });
    c.eq('Reservas', await view(ui), ['B003', 'B006', 'B001', 'B016', 'B009']);
    await startsWith(ui, c, 'B016', 'B016 12:00–13:00 Definitiva');
  },
  'R003-A04': async (ui, c) => {
    await cancel(ui, 'B003');
    c.eq('norte 2026-03-02', await view(ui), ['B006', 'B001', 'B009']);
    await ui.select('room', 'sur');
    c.eq('sur', await view(ui), ['B002', 'B010']);
    await ui.select('room', 'norte'); await ui.select('day', '2026-03-03');
    c.eq('norte 2026-03-03', await view(ui), ['B004']);
  },
  'R003-A05': async (ui, c) => {
    await ui.select('room', 'sur'); await ui.select('day', '2026-03-06');
    await cancel(ui, 'B014');
    c.eq('tras cancelar', await view(ui), []);
    await book(ui, { title: 'Visita', start: '09:30', duration: 60 });
    c.eq('sin aviso', await alertWith(ui, 'La reserva se solapa con'), false);
    c.eq('tras reservar', await view(ui), ['B015']);
    await startsWith(ui, c, 'B015', 'B015 09:30–10:30 Visita');
  },

  // ---------- R004 — vista semanal y horas (V2) ----------
  'R004-A01': async (ui, c, { byId }) => {
    await ui.select('view', 'semana');
    c.eq('Reservas', await view(ui), NORTE_WEEK);
    await startsWith(ui, c, 'B003', line(byId.B003, true));
    await startsWith(ui, c, 'B008', line(byId.B008, true));
  },
  'R004-A02': async (ui, c) => {
    c.eq('norte', await hours(ui), 10);
    await ui.select('room', 'sur');
    c.eq('sur', await hours(ui), 5);
    await ui.select('room', 'auditorio');
    c.eq('auditorio', await hours(ui), 4);
  },
  'R004-A03': async (ui, c) => {
    await book(ui, { title: 'Extra', start: '12:00', duration: 90 });
    await ui.select('view', 'semana');
    c.eq('Horas reservadas', await hours(ui), 11.5);
    c.eq('Reservas', await view(ui), ['B003', 'B006', 'B001', 'B015', 'B009', 'B004', 'B011', 'B008', 'B013']);
  },
  'R004-A04': async (ui, c) => {
    await ui.select('view', 'semana');
    await cancel(ui, 'B013');
    c.eq('Reservas', await view(ui), NORTE_WEEK.filter(id => id !== 'B013'));
    c.eq('Horas reservadas', await hours(ui), 8.5);
  },
  'R004-A05': async (ui, c, { byId }) => {
    await ui.select('view', 'semana');
    await ui.select('view', 'dia');
    c.eq('Reservas', await view(ui), NORTE_0302);
    await startsWith(ui, c, 'B003', line(byId.B003));
    c.eq('Horas reservadas', await hours(ui), 10);
  },

  // ---------- R005 — capacidad (V3) ----------
  'R005-A01': async (ui, c) => {
    const expected = { B003: '3 personas', B006: '2 personas', B001: '1 persona', B009: '3 personas' };
    for (const [id, text] of Object.entries(expected)) c.eq(`${id} asistentes`, await attendeesOf(ui, id), text);
    await ui.select('view', 'semana');
    c.eq('B008 asistentes', await attendeesOf(ui, 'B008'), '4 personas');
  },
  'R005-A02': async (ui, c) => {
    await book(ui, { title: 'Comité', attendees: 4, start: '12:00', duration: 60 });
    c.eq('Reservas', await view(ui), ['B003', 'B006', 'B001', 'B015', 'B009']);
    await startsWith(ui, c, 'B015', 'B015 12:00–13:00');
    c.eq('B015 asistentes', await attendeesOf(ui, 'B015'), '4 personas');
  },
  'R005-A03': async (ui, c) => {
    await book(ui, { title: 'Grupo', attendees: 5, start: '12:00', duration: 60 });
    c.eq('aviso en norte', await alertWith(ui, 'Se supera la capacidad de la sala'), true);
    c.eq('norte sin cambios', await view(ui), NORTE_0302);
    await ui.select('room', 'sur');
    await ui.click('book');
    c.eq('sur', await view(ui), ['B002', 'B015', 'B010']);
    await startsWith(ui, c, 'B015', 'B015 12:00–13:00');
    c.eq('B015 asistentes', await attendeesOf(ui, 'B015'), '5 personas');
  },
  'R005-A04': async (ui, c) => {
    await book(ui, { title: 'Prueba', start: '12:00', attendees: 0 });
    c.eq('aviso con 0', await alertWith(ui, 'Los asistentes deben ser un número entero mayor o igual que 1'), true);
    c.eq('lista con 0', await view(ui), NORTE_0302);
    await book(ui, { attendees: '2.5' });
    c.eq('aviso con 2.5', await alertWith(ui, 'Los asistentes deben ser un número entero mayor o igual que 1'), true);
    c.eq('lista con 2.5', await view(ui), NORTE_0302);
  },
  'R005-A05': async (ui, c) => {
    c.eq('Asistentes al cargar', await ui.value('attendees'), '1');
    await book(ui, { title: 'Individual', start: '12:00' });
    c.eq('B015 asistentes', await attendeesOf(ui, 'B015'), '1 persona');
    await book(ui, { title: 'Trío', attendees: 3, start: '13:00' });
    c.eq('B016 asistentes', await attendeesOf(ui, 'B016'), '3 personas');
    c.eq('Asistentes tras crear', await ui.value('attendees'), '1');
  },
  'R005-A06': async (ui, c) => {
    await ui.select('room', 'auditorio'); await ui.select('day', '2026-03-03');
    await book(ui, { title: 'Asamblea', attendees: 21, start: '10:00' });
    c.eq('aviso con 21', await alertWith(ui, 'Se supera la capacidad de la sala'), true);
    c.eq('sin reserva', await view(ui), []);
    await book(ui, { attendees: 20 });
    c.eq('reserva con 20', await view(ui), ['B015']);
    c.eq('B015 asistentes', await attendeesOf(ui, 'B015'), '20 personas');
  }
};
