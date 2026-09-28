// Oráculo de F006 (libro de calificaciones). Planes vinculados por hash a oracle/F006/*.cases.yaml (spec-lock.json).
// Las expectativas se transcriben del texto del caso (listas «E001 84.30, …» se copian literalmente y se leen con pairs()).
import { amounts, labeled } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F006';
export const ID_PREFIX = 'E';
export const FIXTURE = 'fixtures/gradebook.json';
const score = { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] };
export const FIXTURE_SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: { id: { enum: ['tareas', 'examenes', 'proyecto'] }, name: { type: 'string', minLength: 1 }, weight: { type: 'integer', minimum: 0, maximum: 100 } },
        required: ['id', 'name', 'weight'], additionalProperties: false
      }
    },
    assignments: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        properties: { id: { type: 'string', pattern: '^A[1-5]$' }, name: { type: 'string', minLength: 1 }, category: { enum: ['tareas', 'examenes', 'proyecto'] }, max: { type: 'integer', minimum: 1 } },
        required: ['id', 'name', 'category', 'max'], additionalProperties: false
      }
    },
    students: {
      type: 'array', minItems: 20, maxItems: 20,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^E0(0[1-9]|1[0-9]|20)$' },
          name: { type: 'string', minLength: 1 },
          scores: { type: 'object', properties: { A1: score, A2: score, A3: score, A4: score, A5: score }, required: ['A1', 'A2', 'A3', 'A4', 'A5'], additionalProperties: false }
        },
        required: ['id', 'name', 'scores'], additionalProperties: false
      }
    }
  },
  required: ['categories', 'assignments', 'students'],
  additionalProperties: false
};

// Nota final exacta en centésimas (entero, medio céntimo hacia arriba) para comprobar el resumen declarado del fixture.
function finalCents(book, student) {
  let num = 0n; let den = 1n;
  for (const category of book.categories) {
    const tasks = book.assignments.filter(a => a.category === category.id);
    const points = tasks.reduce((sum, a) => sum + (student.scores[a.id] ?? 0), 0);
    const max = tasks.reduce((sum, a) => sum + a.max, 0);
    // acumulado += weight * points / max (fracción exacta)
    num = num * BigInt(max) + BigInt(category.weight * points) * den;
    den *= BigInt(max);
  }
  return Number((num * 200n + den) / (2n * den)); // round(100 * num / den), sin empates posibles con denominadores enteros positivos
}
const letterOf = cents => cents >= 9000 ? 'A' : cents >= 8000 ? 'B' : cents >= 7000 ? 'C' : cents >= 6000 ? 'D' : 'F';

export function checkFixture(book, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  const summary = family.fixture.summary ?? {};
  const ids = book.students.map(s => s.id);
  demand(JSON.stringify(ids) === JSON.stringify(Array.from({ length: 20 }, (_, i) => `E${String(i + 1).padStart(3, '0')}`)), 'IDs de estudiantes deben ser E001–E020 ordenados');
  demand(JSON.stringify(book.assignments.map(a => a.id)) === JSON.stringify(['A1', 'A2', 'A3', 'A4', 'A5']), 'Tareas deben ser A1–A5 ordenadas');
  demand(new Set(book.assignments.map(a => a.name.toLowerCase())).size === 5, 'Nombres de tareas repetidos');
  demand(new Set(book.students.map(s => s.name.toLowerCase())).size === 20, 'Nombres de estudiantes repetidos');
  demand(book.students.every(s => !/\d/.test(s.name)), 'Los nombres no pueden contener dígitos');
  const weights = Object.fromEntries(book.categories.map(c => [c.id, c.weight]));
  demand(JSON.stringify(weights) === JSON.stringify(summary.weights), 'Pesos distintos de los declarados');
  demand(book.categories.reduce((sum, c) => sum + c.weight, 0) === 100, 'Los pesos deben sumar 100');
  const maxPoints = Object.fromEntries(book.categories.map(c => [c.id, book.assignments.filter(a => a.category === c.id).reduce((sum, a) => sum + a.max, 0)]));
  demand(JSON.stringify(maxPoints) === JSON.stringify(summary.max_points), 'Puntuaciones máximas por categoría distintas de las declaradas');
  demand(book.students.every(s => book.assignments.every(a => s.scores[a.id] === null || s.scores[a.id] <= a.max)), 'Puntuación mayor que el máximo de la tarea');
  const missing = book.students.flatMap(s => Object.values(s.scores)).filter(v => v === null).length;
  demand(missing === summary.missing_scores, 'Número de tareas no entregadas distinto del declarado');
  const cents = book.students.map(s => finalCents(book, s));
  const letters = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const c of cents) letters[letterOf(c)]++;
  demand(JSON.stringify(letters) === JSON.stringify(summary.letter_counts), 'Distribución de letras distinta de la declarada');
  const risk = book.students.filter((s, i) => cents[i] < 6000 || Object.values(s.scores).includes(null)).length;
  demand(risk === summary.at_risk, 'Estudiantes en riesgo distintos de los declarados');
  demand(book.students.length === family.fixture.count && summary.students === 20 && summary.assignments === book.assignments.length, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  edit: { role: 'button', name: 'Editar' },
  a1: { role: 'spinbutton', name: 'Tarea 1' },
  a2: { role: 'spinbutton', name: 'Tarea 2' },
  a3: { role: 'spinbutton', name: 'Parcial' },
  a4: { role: 'spinbutton', name: 'Examen final' },
  a5: { role: 'spinbutton', name: 'Proyecto final' },
  save: { role: 'button', name: 'Guardar' },
  distribution: { role: 'status', name: 'Distribución' },
  wTasks: { role: 'spinbutton', name: 'Peso de tareas' },
  wExams: { role: 'spinbutton', name: 'Peso de exámenes' },
  wProject: { role: 'spinbutton', name: 'Peso del proyecto' },
  apply: { role: 'button', name: 'Aplicar pesos' },
  riskOnly: { role: 'checkbox', name: 'Solo en riesgo' },
  risk: { role: 'status', name: 'En riesgo' }
};
export const LISTS = { students: { name: 'Estudiantes', id: 'E\\d{3}' } };

export const context = book => ({ book });

// ---------- utilidades ----------
const SCORE_ALERT = 'La puntuación debe ser un número entero entre 0 y el máximo de la tarea';
const WEIGHT_ALERT = 'Los pesos deben ser números enteros entre 0 y 100 que sumen 100';
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `E${String(from + i).padStart(3, '0')}`);
// «E001 84.30, E002 B» → { E001: 84.3, E002: 'B' }
const pairs = text => Object.fromEntries(text.split(', ').map(item => { const [id, value] = item.split(' '); return [id, /^[A-F]$/.test(value) ? value : Number(value)]; }));
const DEFAULT = pairs('E001 84.30, E002 96.70, E003 43.00, E004 66.00, E005 90.00, E006 89.90, E007 80.00, E008 79.90, E009 70.00, E010 60.00, E011 59.90, E012 76.50, E013 66.10, E014 95.90, E015 44.50, E016 57.00, E017 77.20, E018 69.50, E019 68.30, E020 87.80');
const view = ui => ui.ids('students');
const gradeIn = text => amounts(text).at(-1) ?? null;
const letterIn = text => text.match(/Letra:\s*([ABCDF])(?![A-Za-z])/)?.[1] ?? null;
const grade = async (ui, id) => gradeIn(await ui.rowText('students', id));
const letter = async (ui, id) => letterIn(await ui.rowText('students', id));
const grades = async ui => Object.fromEntries((await ui.rows('students')).map(r => [r.id, gradeIn(r.text)]));
const letters = async ui => Object.fromEntries((await ui.rows('students')).map(r => [r.id, letterIn(r.text)]));
async function distribution(ui) {
  const text = await ui.text('distribution');
  return Object.fromEntries(['A', 'B', 'C', 'D', 'F'].map(l => [l, Number(text.match(new RegExp(`(?:^|[^A-Za-z])${l}\\s*:\\s*(\\d+)`))?.[1] ?? NaN)]));
}
const dist = (A, B, C, D, F) => ({ A, B, C, D, F });
const risk = async ui => labeled(await ui.text('risk'), 'En riesgo');
const openEditor = (ui, id) => ui.rowClick('students', id, CONTROL.edit);
async function edit(ui, id, values) {
  await openEditor(ui, id);
  for (const [key, value] of Object.entries(values)) await ui.fill(key, value);
  await ui.click('save');
}
async function applyWeights(ui, tasks, exams, project) {
  await ui.fill('wTasks', tasks); await ui.fill('wExams', exams); await ui.fill('wProject', project);
  await ui.click('apply');
}
const editorValues = async ui => [await ui.value('a1'), await ui.value('a2'), await ui.value('a3'), await ui.value('a4'), await ui.value('a5')];
const alertMatches = async (ui, text) => (await ui.alerts()).some(a => a.includes(text));

export const PLANS = {
  // ---------- R001 — listado con nota final (V0) ----------
  'R001-A01': async (ui, c) => {
    c.eq('estudiantes al cargar', await view(ui), range(1, 20));
  },
  'R001-A02': async (ui, c) => {
    c.eq('E001', await grade(ui, 'E001'), 84.30);
    c.eq('E002', await grade(ui, 'E002'), 96.70);
  },
  'R001-A03': async (ui, c) => {
    c.eq('E004', await grade(ui, 'E004'), 66.00);
  },
  'R001-A04': async (ui, c) => {
    c.eq('E003', await grade(ui, 'E003'), 43.00);
    c.eq('E016', await grade(ui, 'E016'), 57.00);
    c.eq('E018', await grade(ui, 'E018'), 69.50);
  },
  'R001-A05': async (ui, c) => {
    for (const [id, shown] of [['E005', '90.00'], ['E007', '80.00'], ['E009', '70.00'], ['E010', '60.00']]) {
      const text = await ui.rowText('students', id);
      c.eq(`${id} muestra ${shown}`, text.includes(shown) && gradeIn(text) === Number(shown), true);
    }
  },
  'R001-A06': async (ui, c) => {
    c.eq('notas al cargar', await grades(ui), DEFAULT);
  },

  // ---------- R002 — editar puntuaciones (V0) ----------
  'R002-A01': async (ui, c) => {
    await edit(ui, 'E004', { a2: '20' });
    c.eq('E004', await grade(ui, 'E004'), 81.00);
  },
  'R002-A02': async (ui, c) => {
    await openEditor(ui, 'E003');
    c.eq('campos de E003', await editorValues(ui), ['6', '', '20', '30', '15']);
  },
  'R002-A03': async (ui, c) => {
    await edit(ui, 'E001', { a4: '' });
    c.eq('E001', await grade(ui, 'E001'), 59.30);
    await openEditor(ui, 'E001');
    c.eq('Examen final', await ui.value('a4'), '');
  },
  'R002-A04': async (ui, c) => {
    await edit(ui, 'E002', { a2: '0', a1: '11' });
    c.eq('aviso con 11', await alertMatches(ui, SCORE_ALERT), true);
    c.eq('E002 tras 11', await grade(ui, 'E002'), 96.70);
    await ui.fill('a1', '-1'); await ui.click('save');
    c.eq('aviso con -1', await alertMatches(ui, SCORE_ALERT), true);
    c.eq('E002 tras -1', await grade(ui, 'E002'), 96.70);
    await ui.fill('a1', '7.5'); await ui.click('save');
    c.eq('aviso con 7.5', await alertMatches(ui, SCORE_ALERT), true);
    c.eq('E002 tras 7.5', await grade(ui, 'E002'), 96.70);
  },
  'R002-A05': async (ui, c) => {
    await edit(ui, 'E015', { a1: '10', a4: '60', a5: '0' });
    c.eq('sin aviso', await alertMatches(ui, SCORE_ALERT), false);
    c.eq('E015', await grade(ui, 'E015'), 58.00);
  },
  'R002-A06': async (ui, c) => {
    await openEditor(ui, 'E002');
    await ui.fill('a1', '1');
    await openEditor(ui, 'E003');
    c.eq('campos de E003', await editorValues(ui), ['6', '', '20', '30', '15']);
    await ui.click('save');
    c.eq('notas', await grades(ui), DEFAULT);
  },

  // ---------- R003 — letras (V1) ----------
  'R003-A01': async (ui, c) => {
    c.eq('letras', await letters(ui), pairs('E001 B, E002 A, E003 F, E004 D, E005 A, E006 B, E007 B, E008 C, E009 C, E010 D, E011 F, E012 C, E013 D, E014 A, E015 F, E016 F, E017 C, E018 D, E019 D, E020 B'));
  },
  'R003-A02': async (ui, c) => {
    const ids = ['E005', 'E006', 'E007', 'E008', 'E009', 'E010', 'E011'];
    const found = [];
    for (const id of ids) found.push(await letter(ui, id));
    c.eq('letras en los límites', found, ['A', 'B', 'B', 'C', 'C', 'D', 'F']);
  },
  'R003-A03': async (ui, c) => {
    c.eq('Distribución', await distribution(ui), dist(3, 4, 4, 5, 4));
  },
  'R003-A04': async (ui, c) => {
    await edit(ui, 'E006', { a2: '19' });
    c.eq('E006 nota', await grade(ui, 'E006'), 90.90);
    c.eq('E006 letra', await letter(ui, 'E006'), 'A');
    c.eq('Distribución', await distribution(ui), dist(4, 3, 4, 5, 4));
  },
  'R003-A05': async (ui, c) => {
    await edit(ui, 'E010', { a5: '14' });
    c.eq('E010 nota', await grade(ui, 'E010'), 59.20);
    c.eq('E010 letra', await letter(ui, 'E010'), 'F');
    c.eq('Distribución', await distribution(ui), dist(3, 4, 4, 4, 5));
  },

  // ---------- R004 — pesos (V2) ----------
  'R004-A01': async (ui, c) => {
    c.eq('pesos', [await ui.value('wTasks'), await ui.value('wExams'), await ui.value('wProject')], ['30', '50', '20']);
    await ui.fill('wTasks', '40'); await ui.fill('wExams', '40');
    c.eq('E001 sin aplicar', await grade(ui, 'E001'), 84.30);
    c.eq('E005 sin aplicar', await grade(ui, 'E005'), 90.00);
  },
  'R004-A02': async (ui, c) => {
    await applyWeights(ui, '40', '40', '20');
    c.eq('notas con 40/40/20', await grades(ui), pairs('E001 84.13, E002 97.20, E003 40.00, E004 64.00, E005 89.33, E006 90.53, E007 80.00, E008 78.53, E009 69.07, E010 60.00, E011 58.53, E012 80.67, E013 66.80, E014 95.87, E015 44.67, E016 48.80, E017 77.07, E018 70.00, E019 67.33, E020 86.93'));
  },
  'R004-A03': async (ui, c) => {
    for (const weights of [['30', '50', '30'], ['-10', '90', '20'], ['30.5', '49.5', '20']]) {
      await applyWeights(ui, ...weights);
      c.eq(`aviso con ${weights.join('/')}`, await alertMatches(ui, WEIGHT_ALERT), true);
      c.eq(`notas con ${weights.join('/')}`, await grades(ui), DEFAULT);
    }
  },
  'R004-A04': async (ui, c) => {
    await applyWeights(ui, '40', '40', '20');
    const found = [];
    for (const id of ['E006', 'E009', 'E012', 'E018']) found.push(await letter(ui, id));
    c.eq('letras', found, ['A', 'D', 'B', 'C']);
    c.eq('Distribución', await distribution(ui), dist(3, 5, 3, 5, 4));
  },
  'R004-A05': async (ui, c) => {
    await applyWeights(ui, '26', '51', '23');
    c.eq('E008', [await grade(ui, 'E008'), await letter(ui, 'E008')], [80.00, 'B']);
    c.eq('E011', [await grade(ui, 'E011'), await letter(ui, 'E011')], [60.00, 'D']);
    c.eq('E006', [await grade(ui, 'E006'), await letter(ui, 'E006')], [89.80, 'B']);
  },
  'R004-A06': async (ui, c) => {
    await applyWeights(ui, '0', '70', '30');
    c.eq('E018 tras aplicar', await grade(ui, 'E018'), 59.50);
    await edit(ui, 'E018', { a5: '20' });
    c.eq('E018 tras editar', await grade(ui, 'E018'), 83.50);
  },

  // ---------- R005 — riesgo (V3) ----------
  'R005-A01': async (ui, c) => {
    c.eq('En riesgo', await risk(ui), 6);
  },
  'R005-A02': async (ui, c) => {
    await ui.check('riskOnly', true);
    c.eq('marcada', await view(ui), ['E003', 'E011', 'E012', 'E015', 'E016', 'E018']);
    await ui.check('riskOnly', false);
    c.eq('desmarcada', await view(ui), range(1, 20));
  },
  'R005-A03': async (ui, c) => {
    await ui.check('riskOnly', true);
    const shown = await view(ui);
    c.eq('E012 aparece', shown.includes('E012'), true);
    c.eq('E010 no aparece', shown.includes('E010'), false);
  },
  'R005-A04': async (ui, c) => {
    await ui.check('riskOnly', true);
    c.eq('En riesgo', await risk(ui), 6);
    c.eq('Distribución', await distribution(ui), dist(3, 4, 4, 5, 4));
  },
  'R005-A05': async (ui, c) => {
    await ui.check('riskOnly', true);
    await edit(ui, 'E018', { a5: '20' });
    c.eq('lista', await view(ui), ['E003', 'E011', 'E012', 'E015', 'E016']);
    c.eq('En riesgo', await risk(ui), 5);
  },
  'R005-A06': async (ui, c) => {
    await applyWeights(ui, '26', '51', '23');
    await ui.check('riskOnly', true);
    c.eq('En riesgo', await risk(ui), 5);
    c.eq('lista', await view(ui), ['E003', 'E012', 'E015', 'E016', 'E018']);
  }
};
