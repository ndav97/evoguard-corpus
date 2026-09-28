// Oráculo de F005 (notas locales). Planes vinculados por hash a oracle/F005/*.cases.yaml (spec-lock.json).
// Las expectativas se transcriben del texto del caso; los rangos de IDs se generan con range().
export const FAMILY_ID = 'F005';
export const ID_PREFIX = 'N';
export const FIXTURE = 'fixtures/notes.json';
export const FIXTURE_SCHEMA = {
  type: 'array', minItems: 12, maxItems: 12,
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', pattern: '^N0(0[1-9]|1[0-2])$' },
      title: { type: 'string', minLength: 1 },
      body: { type: 'string', minLength: 1 },
      tags: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', pattern: '^[a-z]+$' } }
    },
    required: ['id', 'title', 'body', 'tags'],
    additionalProperties: false
  }
};

export function checkFixture(notes, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  demand(JSON.stringify(notes.map(n => n.id)) === JSON.stringify(range(1, 12)), 'IDs de notas deben ser N001–N012 ordenados');
  demand(new Set(notes.map(n => n.title.toLowerCase())).size === notes.length, 'Títulos de notas repetidos');
  demand(notes.every(n => n.title === n.title.trim() && n.body === n.body.trim()), 'Título o cuerpo con espacios sobrantes');
  demand(notes.every(n => !`${n.title}${n.body}`.includes('#')), 'El carácter # está reservado a las etiquetas');
  const counts = {};
  for (const tag of notes.flatMap(n => n.tags).sort()) counts[tag] = (counts[tag] ?? 0) + 1;
  demand(JSON.stringify(counts) === JSON.stringify(family.fixture.summary?.tag_counts), 'Conteo por etiqueta distinto del declarado');
  demand(notes.at(-1)?.id === family.fixture.summary?.max_id, 'max_id distinto del declarado');
  demand(notes.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  search: { role: 'searchbox', name: 'Buscar notas' },
  title: { role: 'textbox', name: 'Título' },
  body: { role: 'textbox', name: 'Contenido' },
  save: { role: 'button', name: 'Guardar nota' },
  tags: { role: 'textbox', name: 'Etiquetas' },
  tagFilter: { role: 'combobox', name: 'Filtrar etiqueta' },
  pin: { role: 'button', name: 'Fijar' },
  remove: { role: 'button', name: 'Eliminar' },
  undo: { role: 'button', name: 'Deshacer eliminación' }
};
export const LISTS = { notes: { name: 'Notas', id: 'N\\d{3}' } };

export const context = notes => ({ notes });

// ---------- utilidades ----------
function range(from, to) { return Array.from({ length: to - from + 1 }, (_, i) => `N${String(from + i).padStart(3, '0')}`); }
const ALL = range(1, 12);
const without = (list, ...ids) => list.filter(id => !ids.includes(id));
const view = ui => ui.ids('notes');
const search = (ui, text) => ui.fill('search', text);
async function create(ui, title, body, tags) {
  await ui.fill('title', title);
  if (body !== undefined) await ui.fill('body', body);
  if (tags !== undefined) await ui.fill('tags', tags);
  await ui.click('save');
}
const startsWith = async (ui, id, text) => (await ui.rowText('notes', id)).startsWith(text);
const tagsOf = text => [...text.matchAll(/#([^\s#]*)/g)].map(m => m[1]);
const rowTags = async (ui, id) => tagsOf(await ui.rowText('notes', id));
const optionValues = async ui => (await ui.options('tagFilter')).map(o => o.value);
const pin = (ui, id) => ui.rowClick('notes', id, CONTROL.pin);
const pressed = (ui, id) => ui.rowAttribute('notes', id, CONTROL.pin, 'aria-pressed');
const remove = (ui, id) => ui.rowClick('notes', id, CONTROL.remove);
const alertMatches = async (ui, text) => (await ui.alerts()).some(a => a.includes(text));

export const PLANS = {
  // ---------- R001 — listar y buscar (V0) ----------
  'R001-A01': async (ui, c) => {
    c.eq('notas al cargar', await view(ui), ALL);
  },
  'R001-A02': async (ui, c) => {
    await search(ui, 'RECETA');
    c.eq('RECETA', await view(ui), ['N002', 'N004', 'N009']);
  },
  'R001-A03': async (ui, c) => {
    await search(ui, '  huerta  ');
    c.eq('«  huerta  »', await view(ui), ['N002', 'N008']);
  },
  'R001-A04': async (ui, c) => {
    await search(ui, 'trabajo');
    c.eq('trabajo', await view(ui), []);
    await search(ui, '');
    c.eq('búsqueda vacía', await view(ui), ALL);
  },
  'R001-A05': async (ui, c) => {
    await search(ui, 'presupuesto');
    c.eq('presupuesto', await view(ui), ['N003', 'N007', 'N012']);
    await search(ui, 'equipo');
    c.eq('equipo', await view(ui), ['N003', 'N012']);
  },

  // ---------- R002 — crear y persistir (V0) ----------
  'R002-A01': async (ui, c) => {
    await create(ui, 'Plan de viaje', 'Comprar billetes de tren');
    c.eq('IDs', await view(ui), [...ALL, 'N013']);
    c.eq('texto de N013', await startsWith(ui, 'N013', 'N013 Plan de viaje'), true);
  },
  'R002-A02': async (ui, c) => {
    await create(ui, '   ', 'Texto suelto');
    c.eq('sin nota tras espacios', await view(ui), ALL);
    c.eq('aviso tras espacios', await alertMatches(ui, 'El título es obligatorio'), true);
    await ui.fill('title', '');
    await ui.click('save');
    c.eq('sin nota tras vacío', await view(ui), ALL);
    c.eq('aviso tras vacío', await alertMatches(ui, 'El título es obligatorio'), true);
  },
  'R002-A03': async (ui, c) => {
    await create(ui, 'Llamar al fontanero');
    await create(ui, 'Pagar el gas');
    c.eq('IDs', await view(ui), [...ALL, 'N013', 'N014']);
    c.eq('N013', await startsWith(ui, 'N013', 'N013 Llamar al fontanero'), true);
    c.eq('N014', await startsWith(ui, 'N014', 'N014 Pagar el gas'), true);
  },
  'R002-A04': async (ui, c) => {
    await create(ui, 'Ordenar el trastero', 'Cajas y estanterías');
    c.eq('título', await ui.value('title'), '');
    c.eq('contenido', await ui.value('body'), '');
  },
  'R002-A05': async (ui, c) => {
    await create(ui, 'Regar las plantas');
    await ui.reload();
    c.eq('IDs tras la primera recarga', await view(ui), [...ALL, 'N013']);
    c.eq('N013', await startsWith(ui, 'N013', 'N013 Regar las plantas'), true);
    await create(ui, 'Sacar la basura');
    await ui.reload();
    c.eq('IDs tras la segunda recarga', await view(ui), [...ALL, 'N013', 'N014']);
    c.eq('N014', await startsWith(ui, 'N014', 'N014 Sacar la basura'), true);
  },
  'R002-A06': async (ui, c) => {
    await create(ui, 'Tarea del jardín', 'Podar el limonero');
    await search(ui, 'LIMONERO');
    c.eq('LIMONERO', await view(ui), ['N013']);
  },

  // ---------- R003 — etiquetas (V1) ----------
  'R003-A01': async (ui, c) => {
    const n001 = await rowTags(ui, 'N001');
    const n004 = await rowTags(ui, 'N004');
    c.eq('N001 contiene #casa', n001.includes('casa'), true);
    c.eq('N001 contiene #compras', n001.includes('compras'), true);
    c.eq('N004 contiene #casa', n004.includes('casa'), true);
    c.eq('N004 no contiene #compras', n004.includes('compras'), false);
  },
  'R003-A02': async (ui, c) => {
    c.eq('opciones', await optionValues(ui), ['todas', 'casa', 'compras', 'finanzas', 'ideas', 'lectura', 'salud', 'trabajo', 'viaje']);
  },
  'R003-A03': async (ui, c) => {
    await ui.select('tagFilter', 'trabajo');
    c.eq('trabajo', await view(ui), ['N002', 'N003', 'N012']);
    await ui.select('tagFilter', 'casa');
    c.eq('casa', await view(ui), ['N001', 'N004', 'N007', 'N009']);
  },
  'R003-A04': async (ui, c) => {
    await ui.select('tagFilter', 'trabajo');
    await search(ui, 'presupuesto');
    c.eq('trabajo y presupuesto', await view(ui), ['N003', 'N012']);
  },
  'R003-A05': async (ui, c) => {
    await create(ui, 'Vacaciones', undefined, ' Viaje, playa ,,viaje, ');
    c.eq('etiquetas de N013', await rowTags(ui, 'N013'), ['viaje', 'playa']);
    c.eq('campo Etiquetas', await ui.value('tags'), '');
    c.eq('opciones', await optionValues(ui), ['todas', 'casa', 'compras', 'finanzas', 'ideas', 'lectura', 'playa', 'salud', 'trabajo', 'viaje']);
  },
  'R003-A06': async (ui, c) => {
    await create(ui, 'Revisar caldera', undefined, 'Casa, urgente');
    await ui.reload();
    await ui.select('tagFilter', 'urgente');
    c.eq('urgente', await view(ui), ['N013']);
    c.eq('etiquetas de N013', await rowTags(ui, 'N013'), ['casa', 'urgente']);
  },

  // ---------- R004 — fijar (V2) ----------
  'R004-A01': async (ui, c) => {
    c.eq('N001 al cargar', await pressed(ui, 'N001'), 'false');
    c.eq('N005 al cargar', await pressed(ui, 'N005'), 'false');
    await pin(ui, 'N005');
    c.eq('N005 tras fijar', await pressed(ui, 'N005'), 'true');
    await pin(ui, 'N005');
    c.eq('N005 tras pulsar otra vez', await pressed(ui, 'N005'), 'false');
  },
  'R004-A02': async (ui, c) => {
    await pin(ui, 'N005');
    c.eq('orden', await view(ui), ['N005', 'N001', 'N002', 'N003', 'N004', ...range(6, 12)]);
  },
  'R004-A03': async (ui, c) => {
    await pin(ui, 'N009'); await pin(ui, 'N003');
    c.eq('orden', await view(ui), ['N003', 'N009', 'N001', 'N002', ...range(4, 8), ...range(10, 12)]);
  },
  'R004-A04': async (ui, c) => {
    await pin(ui, 'N009'); await pin(ui, 'N003'); await pin(ui, 'N003');
    c.eq('orden', await view(ui), ['N009', ...range(1, 8), ...range(10, 12)]);
  },
  'R004-A05': async (ui, c) => {
    await pin(ui, 'N012');
    await search(ui, 'presupuesto');
    c.eq('búsqueda', await view(ui), ['N012', 'N003', 'N007']);
    await search(ui, '');
    await ui.select('tagFilter', 'trabajo');
    c.eq('filtro trabajo', await view(ui), ['N012', 'N002', 'N003']);
  },
  'R004-A06': async (ui, c) => {
    await pin(ui, 'N007'); await pin(ui, 'N011');
    await ui.reload();
    c.eq('orden tras recargar', await view(ui), ['N007', 'N011', ...range(1, 6), ...range(8, 10), 'N012']);
    c.eq('N007', await pressed(ui, 'N007'), 'true');
    c.eq('N011', await pressed(ui, 'N011'), 'true');
    c.eq('N001', await pressed(ui, 'N001'), 'false');
  },

  // ---------- R005 — eliminar y deshacer (V3) ----------
  'R005-A01': async (ui, c) => {
    await remove(ui, 'N004');
    c.eq('tras eliminar', await view(ui), without(ALL, 'N004'));
    await ui.reload();
    c.eq('tras recargar', await view(ui), without(ALL, 'N004'));
  },
  'R005-A02': async (ui, c) => {
    await remove(ui, 'N004');
    await ui.click('undo');
    c.eq('tras deshacer', await view(ui), ALL);
  },
  'R005-A03': async (ui, c) => {
    await remove(ui, 'N002'); await remove(ui, 'N006');
    await ui.click('undo');
    c.eq('tras deshacer', await view(ui), without(ALL, 'N002'));
    c.eq('Deshacer eliminación', await ui.enabled('undo'), false);
  },
  'R005-A04': async (ui, c) => {
    c.eq('al cargar', await ui.enabled('undo'), false);
    await remove(ui, 'N010');
    c.eq('tras eliminar N010', await ui.enabled('undo'), true);
    await create(ui, 'Nota nueva');
    c.eq('tras crear', await ui.enabled('undo'), false);
    await remove(ui, 'N011');
    c.eq('tras eliminar N011', await ui.enabled('undo'), true);
    await ui.reload();
    c.eq('tras recargar', await ui.enabled('undo'), false);
    c.eq('N011 sigue eliminada', (await view(ui)).includes('N011'), false);
  },
  'R005-A05': async (ui, c) => {
    await pin(ui, 'N008'); await remove(ui, 'N008');
    await ui.click('undo');
    c.eq('orden', await view(ui), ['N008', ...range(1, 7), ...range(9, 12)]);
    c.eq('N008 fijada', await pressed(ui, 'N008'), 'true');
  },
  'R005-A06': async (ui, c) => {
    await remove(ui, 'N005');
    await create(ui, 'Nota posterior');
    c.eq('IDs', await view(ui), [...without(ALL, 'N005'), 'N013']);
    c.eq('N013', await startsWith(ui, 'N013', 'N013 Nota posterior'), true);
  },
  'R005-A07': async (ui, c) => {
    await remove(ui, 'N006');
    c.eq('opciones sin N006', await optionValues(ui), ['todas', 'casa', 'compras', 'finanzas', 'ideas', 'lectura', 'trabajo', 'viaje']);
    await ui.click('undo');
    c.eq('opciones tras deshacer', await optionValues(ui), ['todas', 'casa', 'compras', 'finanzas', 'ideas', 'lectura', 'salud', 'trabajo', 'viaje']);
  }
};
