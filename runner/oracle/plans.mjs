// Planes ejecutables del oráculo F001, uno por caso declarativo de oracle/F001/R00x.cases.yaml.
// Cada plan traduce literalmente los pasos del caso a acciones del adaptador y compara
// observaciones de la UI con expectativas derivadas del fixture (reference.mjs) o
// transcritas del texto del caso. La vinculación con el texto canónico se comprueba por hash
// en evaluate.mjs (spec-lock.json): si el caso cambia, el plan deja de ser ejecutable.
import { CATEGORIES, filterProducts, sortProducts, pages, ids, range, PAGE_SIZE } from './reference.mjs';

const MAX_PAGES = 10;

// Recorre las páginas existentes desde la actual; si no hay navegación, devuelve una sola página.
async function walk(a) {
  const seen = [await a.visibleIds()];
  for (let step = 1; step < MAX_PAGES && await a.canNext(); step++) {
    await a.next();
    seen.push(await a.visibleIds());
  }
  return seen;
}
const all = async a => (await walk(a)).flat();
const sorted = list => [...list].sort();
const nameToId = (products, name) => {
  const product = products.find(item => item.name === name);
  if (!product) throw new Error(`Producto inexistente en fixture: ${name}`);
  return product.id;
};
const INVALID_INDEX = /NaN|undefined|Infinity|(^|[\s(:])-\d/;

export const PLANS = {
  // ---------- R001 — búsqueda (V0) ----------
  'R001-A01': async (a, c) => {
    await a.reset(); await a.search('mouse');
    c.set('resultados', await all(a), ['P001']);
  },
  'R001-A02': async (a, c) => {
    await a.reset(); await a.search('mouse');
    const first = await all(a);
    await a.search('MOUSE');
    c.set("resultados 'mouse'", first, ['P001']);
    c.set("resultados 'MOUSE'", await all(a), ['P001']);
  },
  'R001-A03': async (a, c) => {
    await a.reset(); await a.search(' mouse ');
    c.set('resultados', await all(a), ['P001']);
  },
  'R001-A04': async (a, c) => {
    await a.reset(); await a.category('Home'); await a.search('   ');
    c.set('resultados', await all(a), range('P010', 'P017'));
  },
  'R001-A05': async (a, c) => {
    await a.reset(); await a.search('bottle'); await a.category('Sports');
    c.set('bottle + Sports', await all(a), ['P022']);
    await a.category('Home');
    c.set('bottle + Home', await all(a), ['P013']);
  },

  // ---------- R002 — categoría (V0) ----------
  'R002-A01': async (a, c) => {
    await a.reset(); await a.category('All'); await a.search('');
    c.set('All sin búsqueda', await all(a), range('P001', 'P030'));
  },
  'R002-A02': async (a, c) => {
    const expected = { Electronics: range('P001', 'P009'), Home: range('P010', 'P017'), Sports: range('P018', 'P024'), Books: range('P025', 'P030') };
    await a.reset();
    for (const category of CATEGORIES) {
      await a.category(category);
      c.set(category, await all(a), expected[category]);
    }
  },
  'R002-A03': async (a, c) => {
    await a.reset(); await a.category('Electronics');
    c.set('Electronics', await all(a), range('P001', 'P009'));
    await a.category('Books');
    c.set('Books sin recargar', await all(a), range('P025', 'P030'));
  },
  'R002-A04': async (a, c) => {
    await a.reset(); await a.search('bottle');
    for (const [category, expected] of [['Home', ['P013']], ['Sports', ['P022']], ['Electronics', []]]) {
      await a.category(category);
      c.set(`bottle + ${category}`, await all(a), expected);
    }
  },
  'R002-A05': async (a, c, { products }) => {
    await a.reset(); await a.category('Books'); await a.search('mouse');
    c.set('resultados', await all(a), []);
    const text = await a.visibleText();
    c.eq('ningún producto del fixture visible en la página', products.filter(p => text.includes(p.name)).map(p => p.id), []);
  },

  // ---------- R003 — orden (V1) ----------
  ...Object.fromEntries(['name-asc', 'name-desc', 'price-asc', 'price-desc'].map((mode, index) => [`R003-A0${index + 1}`, async (a, c, { products }) => {
    await a.reset(); await a.sort(mode);
    c.eq(`orden ${mode}`, await all(a), ids(sortProducts(products, mode)));
  }])),
  'R003-A05': async (a, c) => {
    await a.reset(); await a.search('bottle'); await a.category('All'); await a.sort('price-asc');
    c.eq('bottle, All, precio asc', await all(a), ['P013', 'P022']);
    await a.category('Sports');
    c.eq('después Sports', await all(a), ['P022']);
  },
  'R003-A06': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.search('bottle');
    c.eq('bottle con nombre desc', await all(a), ['P022', 'P013']);
  },
  'R003-A07': async (a, c, { products }) => {
    await a.reset(); await a.sort('name-desc'); await a.category('Books');
    const names = ['Testing Software', 'Practical TypeScript', 'Modern React', 'Design Patterns', 'Data Structures', 'Clean Code'];
    c.eq('Books con nombre desc', await all(a), names.map(name => nameToId(products, name)));
  },

  // ---------- R004 — paginación (V2) ----------
  'R004-A01': async (a, c, { products }) => {
    await a.reset();
    const seen = await walk(a);
    c.eq('tamaños de página', seen.map(page => page.length), [10, 10, 10]);
    c.set('30 IDs únicos', seen.flat(), ids(products));
  },
  'R004-A02': async (a, c, { products }) => {
    const expected = pages(ids(products));
    await a.reset();
    c.eq('primera: anterior/siguiente', [await a.canPrevious(), await a.canNext()], [false, true]);
    c.eq('página 1', await a.visibleIds(), expected[0]);
    await a.next();
    c.eq('página 2', await a.visibleIds(), expected[1]);
    await a.next();
    c.eq('página 3', await a.visibleIds(), expected[2]);
    c.eq('siguiente deshabilitado en tercera', await a.canNext(), false);
  },
  'R004-A03': async (a, c) => {
    await a.reset(); await a.search('bottle'); await a.category('Sports');
    c.eq('página única', await a.visibleIds(), ['P022']);
    c.eq('anterior/siguiente', [await a.canPrevious(), await a.canNext()], [false, false]);
  },
  'R004-A04': async (a, c, { products }) => {
    const byPrice = ids(sortProducts(products, 'price-asc'));
    await a.reset(); await a.sort('price-asc');
    const seen = await walk(a);
    c.eq('tamaños de página', seen.map(page => page.length), [10, 10, 10]);
    c.eq('concatenación = orden global precio asc', seen.flat(), byPrice);
    await a.reset(); await a.sort('price-asc'); await a.next();
    c.eq('segunda página precio asc', await a.visibleIds(), byPrice.slice(10, 20));
    await a.sort('name-desc');
    c.eq('sigue en página 2 con nombre desc', await a.visibleIds(), ids(sortProducts(products, 'name-desc')).slice(10, 20));
    c.eq('anterior disponible en página 2', await a.canPrevious(), true);
  },
  'R004-A05': async (a, c, { products }) => {
    await a.reset(); await a.next(); await a.next();
    await a.search('bottle');
    c.eq('bottle vuelve a primera', await a.visibleIds(), ['P013', 'P022']);
    c.eq('sin anterior', await a.canPrevious(), false);
    const matches = ids(sortProducts(filterProducts(products, { query: 'e' }), 'name-asc'));
    if (matches.length <= 2 * PAGE_SIZE) throw new Error("Premisa del caso inválida: 'e' debe tener más de 20 coincidencias");
    await a.reset(); await a.sort('name-asc'); await a.next();
    await a.search('e');
    c.eq("'e' vuelve a primera página", await a.visibleIds(), matches.slice(0, 10));
    c.eq('sin anterior', await a.canPrevious(), false);
  },
  'R004-A06': async (a, c) => {
    await a.reset(); await a.next(); await a.next();
    await a.category('Electronics');
    c.eq('Electronics en primera página', await a.visibleIds(), range('P001', 'P009'));
    c.eq('anterior/siguiente', [await a.canPrevious(), await a.canNext()], [false, false]);
  },
  'R004-A07': async (a, c, { products }) => {
    const expected = pages(ids(products));
    await a.reset();
    await a.previous();
    c.eq('anterior en primera no cambia', await a.visibleIds(), expected[0]);
    await a.next(); await a.next();
    c.eq('tercera', await a.visibleIds(), expected[2]);
    await a.next();
    c.eq('siguiente en tercera no cambia', await a.visibleIds(), expected[2]);
    c.eq('navegación válida en tercera', [await a.canPrevious(), await a.canNext()], [true, false]);
  },
  'R004-A08': async (a, c) => {
    await a.reset(); await a.next(); await a.next();
    await a.search('zzzz-no-product');
    c.eq('cero productos', await a.visibleIds(), []);
    c.eq('sin anterior/siguiente', [await a.canPrevious(), await a.canNext()], [false, false]);
    c.eq('sin índice inválido visible', INVALID_INDEX.test(await a.visibleText()), false);
  },

  // ---------- R005 — selección (V3) ----------
  'R005-A01': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001');
    c.eq('identidad', await a.selectedId(), 'P001');
  },
  'R005-A02': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001'); await a.select('P003');
    c.eq('identidad', await a.selectedId(), 'P003');
    c.eq('marcas en la lista', (await a.markedIds()).filter(id => id !== 'P003'), []);
  },
  'R005-A03': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001');
    c.eq('identidad observable', await a.selectedId(), 'P001');
    c.eq('ninguna otra marca', (await a.markedIds()).filter(id => id !== 'P001'), []);
  },
  'R005-A04': async (a, c, { products }) => {
    if (!ids(sortProducts(products, 'price-asc')).slice(10, 20).includes('P001')) throw new Error('Premisa del caso inválida: P001 debe estar en la segunda página por precio');
    await a.reset(); await a.sort('price-asc'); await a.next();
    c.eq('P001 visible en segunda página por precio', (await a.visibleIds()).includes('P001'), true);
    await a.select('P001'); await a.sort('name-desc');
    c.eq('identidad tras ordenar', await a.selectedId(), 'P001');
  },
  'R005-A05': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001'); await a.next();
    c.eq('P001 fuera de la página visible', (await a.visibleIds()).includes('P001'), false);
    c.eq('identidad', await a.selectedId(), 'P001');
  },
  'R005-A06': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001'); await a.next(); await a.previous();
    c.eq('P001 visible de nuevo', (await a.visibleIds()).includes('P001'), true);
    c.eq('identidad', await a.selectedId(), 'P001');
  },
  'R005-A07': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001');
    await a.search('mouse');
    c.eq("conserva con 'mouse'", await a.selectedId(), 'P001');
    await a.search('bottle');
    c.eq("limpia con 'bottle'", await a.selectedId(), null);
    await a.search('');
    c.eq('no reaparece al limpiar búsqueda', await a.selectedId(), null);
  },
  'R005-A08': async (a, c) => {
    await a.reset(); await a.sort('name-desc'); await a.select('P001');
    for (const [category, expected] of [['Electronics', 'P001'], ['Books', null], ['All', null]]) {
      await a.category(category);
      c.eq(`selección con ${category}`, await a.selectedId(), expected);
    }
  }
};
