// Evaluador del oráculo F001.
// - Ejecuta un plan explícito por caso (plans.mjs), vinculado por hash al texto canónico
//   de oracle/F001 (spec-lock.json). Un caso desconocido o modificado no es ejecutable.
// - Separa evaluación abstracta (adapter) de apertura de página (URL de calibración).
// - Filtra casos por versión: una versión solo se evalúa con requisitos ya introducidos.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from '../../templates/react-vite/node_modules/playwright/index.mjs';
import { connectCatalog } from './ui-adapter.mjs';
import { PLANS } from './plans.mjs';
import { loadProducts } from './reference.mjs';

export const VERSIONS = ['V0', 'V1', 'V2', 'V3'];
const ROOT = new URL('../../', import.meta.url);
const LOCK = JSON.parse(readFileSync(new URL('./spec-lock.json', import.meta.url), 'utf8'));
const PRODUCTS = loadProducts(ROOT);

export const specHash = spec => createHash('sha256').update(JSON.stringify({ id: spec.id, steps: spec.steps, expected: spec.expected })).digest('hex');

export function loadCases(root = ROOT) {
  const cases = [];
  for (const requirement of ['R001', 'R002', 'R003', 'R004', 'R005']) {
    const file = JSON.parse(readFileSync(new URL(`oracle/F001/${requirement}.cases.yaml`, root), 'utf8'));
    if (!VERSIONS.includes(file.minimum_version)) throw new Error(`Versión mínima inválida en ${requirement}`);
    for (const spec of file.cases) cases.push({ ...spec, requirement, minimum_version: file.minimum_version });
  }
  return cases;
}

export function casesFor(version, cases = loadCases()) {
  if (!VERSIONS.includes(version)) throw new Error(`Versión desconocida: ${version}`);
  return cases.filter(spec => VERSIONS.indexOf(spec.minimum_version) <= VERSIONS.indexOf(version));
}

function planFor(spec) {
  if (!spec || typeof spec.id !== 'string') throw new Error('Caso de oráculo inválido');
  const plan = PLANS[spec.id];
  if (!plan || !LOCK.cases[spec.id]) throw new Error(`Caso de oráculo sin plan ejecutable: ${spec.id}`);
  if (LOCK.cases[spec.id] !== specHash(spec)) throw new Error(`Caso ${spec.id} difiere de la especificación vinculada; revisar plan y spec-lock.json`);
  return plan;
}

function recorder() {
  const checks = [];
  const add = (label, observed, expected) => checks.push({ label, observed, expected, pass: isDeepStrictEqual(observed, expected) });
  return {
    checks,
    eq: add,
    // Comparación como conjunto con multiplicidad: detecta ausencias y duplicados, ignora el orden.
    set: (label, observed, expected) => add(label, [...observed].sort(), [...expected].sort())
  };
}

// Evalúa un caso contra un adapter ya conectado.
export async function evaluateCase(spec, adapter) {
  const plan = planFor(spec);
  if (!adapter || typeof adapter.visibleIds !== 'function' || typeof adapter.reset !== 'function') throw new Error('Se requiere un adapter válido');
  const record = recorder();
  try {
    await plan(adapter, record, { products: PRODUCTS });
  } catch (error) {
    if (/Premisa del caso inválida/.test(error.message)) throw error;
    // La UI no permitió completar el escenario (control ausente, tiempo agotado...): es un fallo del candidato.
    return { id: spec.id, status: 'FAIL', checks: record.checks, error: error.message.split('\n')[0] };
  }
  if (!record.checks.length) throw new Error(`Plan ${spec.id} sin comprobaciones`);
  return { id: spec.id, status: record.checks.every(check => check.pass) ? 'PASS' : 'FAIL', checks: record.checks };
}

// Sesión de navegador sobre un servidor HTTP local (127.0.0.1); openAdapter() crea una página nueva por caso.
async function openBrowserSession(handler, { timeout = 3000, search = '' } = {}) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const closeServer = () => new Promise(resolve => server.close(resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    await closeServer();
    throw error;
  }
  const context = await browser.newContext();
  const address = `http://127.0.0.1:${server.address().port}/${search}`;
  let current = null;
  return {
    async openAdapter() {
      // Una página viva por vez: cada caso empieza en una página nueva y la anterior se libera.
      if (current) await current.close().catch(() => {});
      const page = current = await context.newPage();
      page.setDefaultTimeout(timeout);
      await page.goto(address, { waitUntil: 'load' });
      return connectCatalog(page);
    },
    async close() {
      try { await browser.close(); } finally { await closeServer(); }
    }
  };
}

// Página de calibración local (file:), un único HTML autocontenido.
export async function openCalibrationSession(target, options = {}) {
  if (!(target instanceof URL) || target.protocol !== 'file:') throw new Error('Se requiere una URL file: de calibración');
  const file = new URL(target); file.search = ''; file.hash = '';
  const html = readFileSync(file, 'utf8');
  return openBrowserSession((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  }, { ...options, search: target.search });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

// Build estático del candidato (dist de Vite) desde memoria: { ruta: Buffer }. Solo sirve esos archivos;
// rutas desconocidas sin extensión reciben index.html (SPA). No hay acceso al sistema de archivos.
export async function openSiteSession(files, options = {}) {
  if (!files || !Buffer.isBuffer(files['index.html'])) throw new Error('Build sin index.html');
  return openBrowserSession((request, response) => {
    let path;
    try { path = decodeURIComponent(new URL(request.url, 'http://x').pathname).replace(/^\/+/, ''); } catch { path = ''; }
    if (path === '' || (!files[path] && !/\.[A-Za-z0-9]+$/.test(path))) path = 'index.html';
    const body = files[path];
    if (!body) { response.writeHead(404); response.end(); return; }
    const extension = path.slice(path.lastIndexOf('.'));
    response.writeHead(200, { 'content-type': TYPES[extension] ?? 'application/octet-stream' });
    response.end(body);
  }, options);
}

export async function withCalibrationPage(target, run, options) {
  const session = await openCalibrationSession(target, options);
  try {
    return await run(() => session.openAdapter());
  } finally {
    await session.close();
  }
}

// Compatibilidad: acepta un adapter (pruebas unitarias) o una URL file: (calibración UI).
export async function runCase(spec, target, options) {
  planFor(spec);
  if (!(target instanceof URL)) {
    if (!target || typeof target.visibleIds !== 'function') throw new Error('Se requiere un adapter válido');
    return evaluateCase(spec, target);
  }
  return withCalibrationPage(target, async open => evaluateCase(spec, await open()), options);
}

// Ejecuta todos los casos aplicables a una versión. openAdapter() debe devolver un adapter nuevo por caso.
export async function runSuite(version, openAdapter, { cases = loadCases() } = {}) {
  const selected = casesFor(version, cases);
  const results = [];
  for (const spec of selected) results.push(await evaluateCase(spec, await openAdapter()));
  return { version, status: results.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL', total: results.length, passed: results.filter(r => r.status === 'PASS').length, results };
}

export async function runSuiteOnSite(version, files, options) {
  const session = await openSiteSession(files, options);
  try { return await runSuite(version, () => session.openAdapter()); } finally { await session.close(); }
}

export function runSuiteOnPage(version, target, options) {
  return withCalibrationPage(target, open => runSuite(version, open), options);
}
