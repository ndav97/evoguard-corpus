// Oráculo de F009 (cuestionario). Planes vinculados por hash a oracle/F009/*.cases.yaml (spec-lock.json).
// Las expectativas se derivan del fixture (opciones, respuesta correcta, órdenes con semilla) o se transcriben del caso.
// Las opciones son radios cuyo nombre accesible es el texto de la opción (no declarables una a una en CONTROL):
// se localizan con ui.page.getByRole('radio', { name, exact: true }), según el ui_contract de R001.
import { labeled } from '../../generic-adapter.mjs';

export const FAMILY_ID = 'F009';
export const ID_PREFIX = 'Q';
export const FIXTURE = 'fixtures/quiz.json';
export const FIXTURE_SCHEMA = {
  type: 'array', minItems: 12, maxItems: 12,
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', pattern: '^Q0[01][0-9]$' },
      topic: { enum: ['geografía', 'ciencia', 'historia', 'matemáticas'] },
      prompt: { type: 'string', minLength: 1 },
      options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string', minLength: 1 } },
      answer: { type: 'integer', minimum: 0, maximum: 3 }
    },
    required: ['id', 'topic', 'prompt', 'options', 'answer'],
    additionalProperties: false
  }
};

export function checkFixture(questions, family) {
  const errors = [];
  const demand = (ok, message) => { if (!ok) errors.push(message); };
  demand(JSON.stringify(questions.map(q => q.id)) === JSON.stringify(Array.from({ length: 12 }, (_, i) => `Q${String(i + 1).padStart(3, '0')}`)), 'IDs de preguntas deben ser Q001–Q012 ordenados');
  demand(new Set(questions.map(q => q.prompt.toLowerCase())).size === questions.length, 'Enunciados repetidos');
  for (const q of questions) {
    const lower = q.options.map(o => o.toLowerCase());
    demand(new Set(lower).size === 4, `${q.id}: opciones repetidas`);
    demand(lower.every(a => lower.every(b => a === b || !b.includes(a))), `${q.id}: una opción contiene a otra`);
  }
  const topics = {};
  for (const q of questions) topics[q.topic] = (topics[q.topic] ?? 0) + 1;
  demand(JSON.stringify(topics) === JSON.stringify(family.fixture.summary?.topic_counts), 'Conteo por tema distinto del declarado');
  const positions = [0, 1, 2, 3].map(i => questions.filter(q => q.answer === i).length);
  demand(JSON.stringify(positions) === JSON.stringify(family.fixture.summary?.answer_index_counts), 'Reparto de respuestas correctas distinto del declarado');
  demand(questions.length === family.fixture.count, 'count del fixture incorrecto');
  return errors;
}

export const CONTROL = {
  question: { role: 'status', name: 'Pregunta' },
  answer: { role: 'button', name: 'Responder' },
  result: { role: 'status', name: 'Resultado' },
  next: { role: 'button', name: 'Siguiente' },
  score: { role: 'status', name: 'Puntuación' },
  final: { role: 'status', name: 'Final' },
  restart: { role: 'button', name: 'Reiniciar' },
  review: { role: 'button', name: 'Revisar' },
  seed: { role: 'spinbutton', name: 'Semilla' },
  applySeed: { role: 'button', name: 'Aplicar semilla' },
  streak: { role: 'status', name: 'Racha actual' },
  best: { role: 'status', name: 'Mejor racha' }
};
export const LISTS = { review: { name: 'Revisión', id: 'Q\\d{3}' } };

// Orden con semilla: clave ((i + 1) · s) mod 97, desempate por posición; 0 = orden del fixture.
const seededOrder = (questions, seed) => questions.map((q, i) => ({ id: q.id, i, key: ((i + 1) * seed) % 97 }))
  .sort((a, b) => a.key - b.key || a.i - b.i).map(x => x.id);
export const context = questions => ({ questions, byId: Object.fromEntries(questions.map(q => [q.id, q])), seededOrder: seed => seededOrder(questions, seed) });

// ---------- utilidades ----------
const ALERT = 'La semilla debe ser un número entero entre 0 y 96';
const ids = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `Q${String(from + i).padStart(3, '0')}`);
const correctOf = q => q.options[q.answer];
const wrongOf = q => q.options[(q.answer + 1) % 4];

const radios = ui => ui.page.getByRole('radio');
async function visibleRadio(ui, name) {
  const found = ui.page.getByRole('radio', { name, exact: true });
  for (let i = 0; i < await found.count(); i++) if (await found.nth(i).isVisible()) return found.nth(i);
  return null;
}
async function visibleRadioCount(ui) {
  const all = radios(ui);
  let n = 0;
  for (let i = 0; i < await all.count(); i++) if (await all.nth(i).isVisible()) n++;
  return n;
}
// Estado de cada opción esperada: visible, marcada, habilitada.
async function optionStates(ui, names) {
  const states = [];
  for (const name of names) {
    const radio = await visibleRadio(ui, name);
    states.push(radio ? { name, checked: await radio.isChecked(), enabled: await radio.isEnabled() } : { name, missing: true });
  }
  return states;
}
const fresh = names => names.map(name => ({ name, checked: false, enabled: true }));
async function choose(ui, name) {
  const radio = await visibleRadio(ui, name);
  if (!radio) throw new Error(`Opción ausente: ${name}`);
  await radio.check();
}
async function answer(ui, name) { await choose(ui, name); await ui.click('answer'); }
async function currentId(ui) {
  const text = await ui.textOrNull('question');
  return text ? (text.match(/^(Q\d{3})(?![A-Za-z0-9])/)?.[1] ?? text) : null;
}
async function result(ui) {
  const text = await ui.textOrNull('result');
  if (!text) return null;
  return { verdict: text.match(/^(Correcto|Incorrecto)(?![A-Za-zÁÉÍÓÚáéíóúñÑ])/)?.[1] ?? text, text };
}
const resultIs = async (ui, verdict, correct) => {
  const found = await result(ui);
  return { verdict: found?.verdict ?? null, correct: Boolean(found?.text.includes(`Respuesta correcta: ${correct}`)) };
};
const expectResult = (verdict) => ({ verdict, correct: true });
async function score(ui) {
  const text = await ui.textOrNull('score');
  const match = text?.match(/Puntuación:\s*(\d+)\s*\/\s*12(?!\d)/);
  return match ? Number(match[1]) : null;
}
async function finalScore(ui) {
  const text = await ui.textOrNull('final');
  const match = text?.match(/Puntuación final:\s*(\d+) de 12(?!\d)/);
  return match ? Number(match[1]) : null;
}
async function streaks(ui) {
  return { actual: labeled(await ui.textOrNull('streak'), 'Racha actual'), mejor: labeled(await ui.textOrNull('best'), 'Mejor racha') };
}
const streak = (actual, mejor) => ({ actual, mejor });
async function applySeed(ui, value) { await ui.fill('seed', String(value)); await ui.click('applySeed'); }
const alertMatches = async ui => (await ui.alerts()).some(a => a.includes(ALERT));
// Revisión: [{ id, verdict, text }] con el veredicto que sigue al ID.
async function review(ui) {
  return (await ui.rows('review')).map(r => ({ id: r.id, verdict: r.text.slice(r.id.length).replace(/^[^\p{L}\p{N}]+/u, '').match(/^(Correcta|Incorrecta)(?![\p{L}])/u)?.[1] ?? null, text: r.text }));
}

// Juega preguntas en el orden que presenta la página: pick(q) → texto de la opción a marcar.
// after(q) se ejecuta tras cada Responder. Pulsa Siguiente tras cada una salvo que skipLastNext y sea la última.
async function play(ui, ctx, count, pick, { after, skipLastNext = false } = {}) {
  const seen = [];
  for (let n = 0; n < count; n++) {
    const id = await currentId(ui);
    const q = ctx.byId[id];
    if (!q) throw new Error(`Pregunta no reconocida: ${id}`);
    seen.push(id);
    await answer(ui, pick(q));
    if (after) await after(q);
    if (!(skipLastNext && n === count - 1)) await ui.click('next');
  }
  return seen;
}
const allCorrect = q => correctOf(q);
const allWrong = q => wrongOf(q);

export const PLANS = {
  // ---------- R001 — responder (V0) ----------
  'R001-A01': async (ui, c, { byId }) => {
    const text = await ui.text('question');
    c.eq('pregunta Q001', text.startsWith('Q001') && text.includes('¿Cuál es la capital de Australia?'), true);
    c.eq('opciones', await optionStates(ui, byId.Q001.options), fresh(byId.Q001.options));
    c.eq('opciones visibles', await visibleRadioCount(ui), 4);
    c.eq('Responder deshabilitado', await ui.enabled('answer'), false);
    c.eq('sin Resultado', await ui.textOrNull('result') || null, null);
  },
  'R001-A02': async (ui, c) => {
    await answer(ui, 'Canberra');
    c.eq('resultado', await resultIs(ui, 'Correcto', 'Canberra'), expectResult('Correcto'));
  },
  'R001-A03': async (ui, c) => {
    await answer(ui, 'Sídney');
    c.eq('resultado', await resultIs(ui, 'Incorrecto', 'Canberra'), expectResult('Incorrecto'));
  },
  'R001-A04': async (ui, c, { byId }) => {
    await answer(ui, 'Perth');
    const canberra = await visibleRadio(ui, 'Canberra');
    if (canberra && await canberra.isEnabled()) await canberra.check();
    c.eq('opciones bloqueadas', await optionStates(ui, byId.Q001.options), byId.Q001.options.map(name => ({ name, checked: name === 'Perth', enabled: false })));
    c.eq('Responder no disponible', await ui.enabled('answer'), false);
    c.eq('resultado', (await result(ui))?.verdict ?? null, 'Incorrecto');
  },
  'R001-A05': async (ui, c, { byId }) => {
    c.eq('Siguiente al cargar', await ui.enabled('next'), false);
    await answer(ui, 'Canberra');
    await ui.click('next');
    c.eq('pregunta', await currentId(ui), 'Q002');
    c.eq('opciones Q002', await optionStates(ui, byId.Q002.options), fresh(byId.Q002.options));
    c.eq('Responder deshabilitado', await ui.enabled('answer'), false);
    c.eq('sin Resultado', await ui.textOrNull('result') || null, null);
  },
  'R001-A06': async (ui, c) => {
    await answer(ui, 'Melbourne');
    await ui.click('next');
    await answer(ui, 'Dióxido de carbono');
    c.eq('resultado Q002', await resultIs(ui, 'Correcto', 'Dióxido de carbono'), expectResult('Correcto'));
    await ui.click('next');
    c.eq('pregunta', await currentId(ui), 'Q003');
  },

  // ---------- R002 — puntuación y final (V0) ----------
  'R002-A01': async (ui, c) => {
    c.eq('al cargar', await score(ui), 0);
    await answer(ui, 'Canberra');
    c.eq('tras acertar Q001', await score(ui), 1);
    await ui.click('next');
    await answer(ui, 'Helio');
    c.eq('tras fallar Q002', await score(ui), 1);
  },
  'R002-A02': async (ui, c, ctx) => {
    const seen = [];
    const ids6 = await play(ui, ctx, 6, q => (Number(q.id.slice(1)) % 2 ? correctOf(q) : wrongOf(q)), { after: async () => seen.push(await score(ui)) });
    c.eq('preguntas', ids6, ids(1, 6));
    c.eq('puntuaciones', seen, [1, 1, 2, 2, 3, 3]);
  },
  'R002-A03': async (ui, c, ctx) => {
    const seen = await play(ui, ctx, 12, allCorrect, { skipLastNext: true });
    c.eq('preguntas', seen, ids(1, 12));
    c.eq('pregunta antes del último Siguiente', await currentId(ui), 'Q012');
    c.eq('puntuación antes del último Siguiente', await score(ui), 12);
    await ui.click('next');
    c.eq('final', await finalScore(ui), 12);
    c.eq('sin Pregunta', await ui.textOrNull('question'), null);
    c.eq('sin opciones', await visibleRadioCount(ui), 0);
  },
  'R002-A04': async (ui, c, ctx) => {
    const seen = await play(ui, ctx, 12, q => (['Q001', 'Q005', 'Q012'].includes(q.id) ? correctOf(q) : wrongOf(q)));
    c.eq('preguntas', seen, ids(1, 12));
    c.eq('final', await finalScore(ui), 3);
  },
  'R002-A05': async (ui, c, ctx) => {
    await play(ui, ctx, 12, allCorrect);
    await ui.click('restart');
    c.eq('pregunta', await currentId(ui), 'Q001');
    c.eq('puntuación', await score(ui), 0);
    c.eq('sin Final', await ui.textOrNull('final'), null);
    c.eq('sin Resultado', await ui.textOrNull('result') || null, null);
    c.eq('Responder deshabilitado', await ui.enabled('answer'), false);
  },
  'R002-A06': async (ui, c) => {
    await answer(ui, 'Canberra');
    await ui.click('next');
    await answer(ui, 'Dióxido de carbono');
    await ui.click('restart');
    c.eq('pregunta', await currentId(ui), 'Q001');
    c.eq('puntuación', await score(ui), 0);
    c.eq('sin Resultado', await ui.textOrNull('result') || null, null);
    await answer(ui, 'Canberra');
    c.eq('puntuación tras responder', await score(ui), 1);
  },

  // ---------- R003 — revisión (V1) ----------
  'R003-A01': async (ui, c, ctx) => {
    await play(ui, ctx, 12, q => ({ Q003: '1965', Q010: '186' })[q.id] ?? correctOf(q));
    await ui.click('review');
    c.eq('revisión', (await review(ui)).map(r => [r.id, r.verdict]), ids(1, 12).map(id => [id, ['Q003', 'Q010'].includes(id) ? 'Incorrecta' : 'Correcta']));
  },
  'R003-A02': async (ui, c, ctx) => {
    await play(ui, ctx, 12, q => ({ Q003: '1965', Q010: '186' })[q.id] ?? correctOf(q));
    await ui.click('review');
    const rows = Object.fromEntries((await review(ui)).map(r => [r.id, r.text]));
    const shows = (id, chosen, correct) => [Boolean(rows[id]?.includes(`Elegida: ${chosen}`)), Boolean(rows[id]?.includes(`Respuesta correcta: ${correct}`))];
    c.eq('Q003', shows('Q003', '1965', '1969'), [true, true]);
    c.eq('Q010', shows('Q010', '186', '206'), [true, true]);
    c.eq('Q001', shows('Q001', 'Canberra', 'Canberra'), [true, true]);
  },
  'R003-A03': async (ui, c, ctx) => {
    c.eq('Revisar al cargar', await ui.enabled('review'), false);
    await play(ui, ctx, 12, allCorrect, { skipLastNext: true });
    c.eq('Revisar tras responder Q012', await ui.enabled('review'), false);
    await ui.click('next');
    c.eq('lista antes de Revisar', await ui.ids('review'), []);
    await ui.click('review');
    c.eq('revisión', (await review(ui)).map(r => [r.id, r.verdict]), ids(1, 12).map(id => [id, 'Correcta']));
  },
  'R003-A04': async (ui, c, ctx) => {
    await play(ui, ctx, 12, allCorrect);
    await ui.click('review');
    await ui.click('restart');
    c.eq('lista tras Reiniciar', await ui.ids('review'), []);
    await play(ui, ctx, 12, allWrong);
    await ui.click('review');
    c.eq('segunda revisión', (await review(ui)).map(r => [r.id, r.verdict]), ids(1, 12).map(id => [id, 'Incorrecta']));
  },
  'R003-A05': async (ui, c, ctx) => {
    await play(ui, ctx, 12, q => (Number(q.id.slice(1)) % 2 ? wrongOf(q) : correctOf(q)));
    await ui.click('review');
    const rows = await review(ui);
    c.eq('revisión', rows.map(r => [r.id, r.verdict]), ids(1, 12).map(id => [id, Number(id.slice(1)) % 2 ? 'Incorrecta' : 'Correcta']));
    c.eq('Q001 elegida', Boolean(rows.find(r => r.id === 'Q001')?.text.includes('Elegida: Melbourne')), true);
    c.eq('Q002 elegida', Boolean(rows.find(r => r.id === 'Q002')?.text.includes('Elegida: Dióxido de carbono')), true);
    c.eq('final', await finalScore(ui), 6);
  },

  // ---------- R004 — orden con semilla (V2) ----------
  'R004-A01': async (ui, c, ctx) => {
    c.eq('Semilla al cargar', await ui.value('seed'), '');
    await applySeed(ui, 20);
    c.eq('orden con semilla 20', await play(ui, ctx, 12, allCorrect), ctx.seededOrder(20));
    c.eq('final', await finalScore(ui), 12);
  },
  'R004-A02': async (ui, c) => {
    await answer(ui, 'Canberra');
    await applySeed(ui, 41);
    c.eq('pregunta', await currentId(ui), 'Q012');
    c.eq('puntuación', await score(ui), 0);
    c.eq('sin Resultado', await ui.textOrNull('result') || null, null);
    c.eq('Responder deshabilitado', await ui.enabled('answer'), false);
  },
  'R004-A03': async (ui, c, ctx) => {
    await applySeed(ui, 20);
    c.eq('primera con 20', await currentId(ui), 'Q005');
    await applySeed(ui, 0);
    c.eq('orden con 0', await play(ui, ctx, 12, allCorrect), ids(1, 12));
  },
  'R004-A04': async (ui, c, ctx) => {
    await applySeed(ui, 41);
    c.eq('primera con 41', await currentId(ui), 'Q012');
    await applySeed(ui, '');
    c.eq('orden con semilla vacía', await play(ui, ctx, 12, allCorrect), ids(1, 12));
  },
  'R004-A05': async (ui, c) => {
    await applySeed(ui, 20);
    await answer(ui, 'Volga');
    for (const value of ['97', '-1', '2.5']) {
      await applySeed(ui, value);
      c.eq(`aviso con ${value}`, await alertMatches(ui), true);
      c.eq(`pregunta con ${value}`, await currentId(ui), 'Q005');
      c.eq(`resultado con ${value}`, (await result(ui))?.verdict ?? null, 'Correcto');
      c.eq(`puntuación con ${value}`, await score(ui), 1);
    }
    await ui.click('next');
    c.eq('Siguiente', await currentId(ui), 'Q010');
    await applySeed(ui, 96);
    c.eq('pregunta con 96', await currentId(ui), 'Q012');
    c.eq('puntuación con 96', await score(ui), 0);
  },
  'R004-A06': async (ui, c) => {
    await applySeed(ui, 41);
    await answer(ui, '60 grados');
    await ui.click('next');
    c.eq('antes de Reiniciar', await currentId(ui), 'Q005');
    await ui.click('restart');
    c.eq('tras Reiniciar', await currentId(ui), 'Q012');
    c.eq('puntuación', await score(ui), 0);
  },
  'R004-A07': async (ui, c, ctx) => {
    await applySeed(ui, 20);
    await play(ui, ctx, 12, q => (q.id === 'Q005' ? 'Rin' : correctOf(q)));
    await ui.click('review');
    c.eq('revisión', (await review(ui)).map(r => [r.id, r.verdict]), ctx.seededOrder(20).map(id => [id, id === 'Q005' ? 'Incorrecta' : 'Correcta']));
  },

  // ---------- R005 — rachas (V3) ----------
  'R005-A01': async (ui, c, ctx) => {
    c.eq('al cargar', await streaks(ui), streak(0, 0));
    const seen = [];
    await play(ui, ctx, 3, allCorrect, { after: async () => seen.push(await streaks(ui)) });
    c.eq('tras cada acierto', seen, [streak(1, 1), streak(2, 2), streak(3, 3)]);
  },
  'R005-A02': async (ui, c, ctx) => {
    const seen = {};
    await play(ui, ctx, 4, q => (q.id === 'Q003' ? '1965' : q.id === 'Q004' ? '56' : correctOf(q)), { after: async q => { seen[q.id] = await streaks(ui); } });
    c.eq('tras Q003', seen.Q003, streak(0, 2));
    c.eq('tras Q004', seen.Q004, streak(1, 2));
  },
  'R005-A03': async (ui, c, ctx) => {
    const seen = {};
    await play(ui, ctx, 6, q => (q.id === 'Q003' ? '1965' : correctOf(q)), { after: async q => { seen[q.id] = await streaks(ui); } });
    c.eq('tras Q005', seen.Q005, streak(2, 2));
    c.eq('tras Q006', seen.Q006, streak(3, 3));
  },
  'R005-A04': async (ui, c, ctx) => {
    await play(ui, ctx, 12, q => (q.id === 'Q009' ? 'Asia' : correctOf(q)));
    c.eq('final', await finalScore(ui), 11);
    c.eq('rachas en el final', await streaks(ui), streak(3, 8));
  },
  'R005-A05': async (ui, c) => {
    await answer(ui, 'Canberra');
    await ui.click('next');
    await answer(ui, 'Dióxido de carbono');
    await ui.click('restart');
    c.eq('tras Reiniciar', await streaks(ui), streak(0, 2));
    await answer(ui, 'Canberra');
    c.eq('tras responder', await streaks(ui), streak(1, 2));
  },
  'R005-A06': async (ui, c, ctx) => {
    await play(ui, ctx, 3, allCorrect);
    await applySeed(ui, 20);
    c.eq('tras aplicar semilla', await streaks(ui), streak(0, 3));
    await answer(ui, 'Volga');
    c.eq('tras responder Q005', await streaks(ui), streak(1, 3));
  }
};
