// Control de restricciones arquitectónicas de F001 sobre el árbol exportado del candidato.
// Análisis estático de texto: nunca ejecuta código del candidato en el host.
// Restricciones (prompts/common.md y family.yaml structural_profile): useState centralizado y datos derivados;
// sin useReducer, efectos, persistencia, gestores externos, backend ni servicios externos; sin dependencias nuevas;
// fixture sin modificar. El número de componentes es guía de auditoría (5–20), no condición de rechazo.
import { createHash } from 'node:crypto';

const SOURCE = /^src\/.+\.(tsx?|jsx?|mjs|cjs)$/;
const TEST = /(^tests?\/)|(\.(test|spec)\.[tj]sx?$)|(^src\/.*__tests__\/)/;
const FORBIDDEN = [
  ['useReducer', /\buseReducer\b/],
  ['useEffect', /\buseEffect\b/],
  ['useLayoutEffect', /\buseLayoutEffect\b/],
  ['useInsertionEffect', /\buseInsertionEffect\b/],
  ['useSyncExternalStore', /\buseSyncExternalStore\b/],
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['document.cookie', /\bdocument\s*\.\s*cookie\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['import dinámico', /\bimport\s*\(/]
];
const ALLOWED_PACKAGES = new Set(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']);

const sha = data => createHash('sha256').update(data).digest('hex');
const text = buffer => Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer);
// Elimina comentarios de bloque y de línea (aproximado; los falsos positivos en cadenas se prefieren a omisiones).
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
const imports = source => [...source.matchAll(/(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1] ?? m[2] ?? m[3]);

function dependencies(packageJson) {
  const parsed = JSON.parse(packageJson);
  return JSON.stringify({ dependencies: parsed.dependencies ?? {}, devDependencies: parsed.devDependencies ?? {}, peerDependencies: parsed.peerDependencies ?? {}, optionalDependencies: parsed.optionalDependencies ?? {} });
}

// files: { ruta relativa: Buffer } del workspace (sin node_modules/dist/.git); baseline: { package.json, package-lock.json, fixtureSha256 }.
export function checkArchitecture(files, baseline) {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  const get = path => (files[path] === undefined ? null : text(files[path]));

  const packageJson = get('package.json');
  if (packageJson === null) add('dependencias', 'package.json ausente');
  else {
    try { if (dependencies(packageJson) !== dependencies(baseline.packageJson)) add('dependencias', 'package.json cambia dependencias respecto del scaffold'); }
    catch { add('dependencias', 'package.json inválido'); }
  }
  if (get('package-lock.json') !== baseline.packageLock) add('dependencias', 'package-lock.json modificado');
  const fixture = files['fixtures/products.json'];
  if (!fixture || sha(fixture) !== baseline.fixtureSha256) add('fixture', 'fixtures/products.json ausente o modificado');

  const sources = Object.keys(files).filter(path => SOURCE.test(path) && !TEST.test(path)).sort();
  if (!sources.length) add('fuente', 'sin archivos fuente en src/');
  let usesState = false;
  let importsFixture = false;
  let components = 0;
  for (const path of sources) {
    const code = stripComments(text(files[path]));
    for (const [name, pattern] of FORBIDDEN) if (pattern.test(code)) add('api prohibida', `${name} en ${path}`);
    for (const specifier of imports(code)) {
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (/fixtures\/products\.json$/.test(specifier)) importsFixture = true;
        continue;
      }
      if (!ALLOWED_PACKAGES.has(specifier)) add('dependencia externa', `${specifier} en ${path}`);
    }
    if (/\buseState\b/.test(code)) usesState = true;
    components += (code.match(/(?:export\s+default\s+)?function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*[:=][^;]*=>/g) ?? []).length;
  }
  if (!usesState) add('estado', 'no se usa useState');
  if (!importsFixture) add('fixture', 'la aplicación no importa fixtures/products.json');

  return {
    status: violations.length ? 'FAIL' : 'PASS',
    violations,
    metrics: { source_files: sources.length, components_estimate: components, component_guideline: '5–20 (auditoría)' }
  };
}
