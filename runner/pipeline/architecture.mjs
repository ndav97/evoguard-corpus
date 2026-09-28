// Control de restricciones arquitectónicas sobre el árbol exportado del candidato, derivado del perfil
// estructural de la familia (family.yaml structural_profile) y de su prompts/architecture.md.
// Análisis estático de texto: nunca ejecuta código del candidato en el host.
// Siempre: sin backend ni servicios externos, sin almacenamiento distinto del exigido, sin dependencias nuevas,
// fixture sin modificar e importado por la aplicación. El número de componentes es guía de auditoría (5–20).
import { createHash } from 'node:crypto';

const SOURCE = /^src\/.+\.(tsx?|jsx?|mjs|cjs)$/;
const TEST = /(^tests?\/)|(\.(test|spec)\.[tj]sx?$)|(^src\/.*__tests__\/)/;
const ALWAYS_FORBIDDEN = [
  ['useInsertionEffect', /\buseInsertionEffect\b/],
  ['useSyncExternalStore', /\buseSyncExternalStore\b/],
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['document.cookie', /\bdocument\s*\.\s*cookie\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['import dinámico', /\bimport\s*\(/]
];
const API = {
  useState: /\buseState\b/, useReducer: /\buseReducer\b/, useEffect: /\buseEffect\b/, useLayoutEffect: /\buseLayoutEffect\b/,
  localStorage: /\blocalStorage\b/, createContext: /\bcreateContext\b/, useContext: /\buseContext\b/, useMemo: /\buseMemo\b/,
  defaultValue: /\bdefaultValue\s*=/, controlledValue: /\bvalue\s*=\s*\{/, onChange: /\bonChange\s*=/,
  hookDefinition: /(?:function\s+use[A-Z]\w*\s*[(<]|(?:const|let)\s+use[A-Z]\w*\s*(?::[^=]+)?=)/
};
// Perfil de F001 (compatibilidad con familias sin perfil ampliado).
const F001_PROFILE = { state_strategy: 'useState', topology: 'centralized', reducer: false, effects: false, persistence: false };

// Reglas: { forbid: [nombre, regex][], require: [descripción, predicado(stats)][] }.
export function architectureRules(profile = F001_PROFILE) {
  const forbid = [...ALWAYS_FORBIDDEN];
  const require = [];
  const need = (label, test) => require.push([label, test]);
  if (profile.reducer === false) forbid.push(['useReducer', API.useReducer]);
  if (profile.reducer === true) need('no se usa useReducer', s => s.any.useReducer);
  if (profile.effects === false) forbid.push(['useEffect', API.useEffect], ['useLayoutEffect', API.useLayoutEffect]);
  if (profile.effects === true) need('no se usa useEffect', s => s.any.useEffect);
  if (profile.persistence === false) forbid.push(['localStorage', API.localStorage]);
  if (profile.persistence === 'localStorage') need('no se usa localStorage', s => s.any.localStorage);
  if (profile.context === false) forbid.push(['createContext', API.createContext], ['useContext', API.useContext]);
  if (profile.context === true) need('no se usa Context API (createContext y useContext)', s => s.any.createContext && s.any.useContext);
  if (profile.memoization === true) need('no se usa useMemo', s => s.any.useMemo);
  if (profile.custom_hooks === true) need('no se definen hooks propios (use*)', s => s.any.hookDefinition);
  if (profile.controlled_inputs === true) {
    forbid.push(['defaultValue (campos no controlados)', API.defaultValue]);
    need('sin campos controlados (value + onChange)', s => s.any.controlledValue && s.any.onChange);
  }
  if (profile.state_strategy === 'useState' || profile.reducer === false) need('no se usa useState', s => s.any.useState);
  if (profile.topology === 'distributed') need('estado no distribuido: useState en menos de dos módulos', s => s.files.useState >= 2);
  return { forbid, require };
}

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

// files: { ruta relativa: Buffer } del workspace (sin node_modules/dist/.git);
// baseline: { packageJson, packageLock, fixturePath, fixtureSha256, profile }.
export function checkArchitecture(files, baseline) {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  const get = path => (files[path] === undefined ? null : text(files[path]));
  const fixturePath = baseline.fixturePath ?? 'fixtures/products.json';
  const rules = architectureRules(baseline.profile);

  const packageJson = get('package.json');
  if (packageJson === null) add('dependencias', 'package.json ausente');
  else {
    try { if (dependencies(packageJson) !== dependencies(baseline.packageJson)) add('dependencias', 'package.json cambia dependencias respecto del scaffold'); }
    catch { add('dependencias', 'package.json inválido'); }
  }
  if (get('package-lock.json') !== baseline.packageLock) add('dependencias', 'package-lock.json modificado');
  const fixture = files[fixturePath];
  if (!fixture || sha(fixture) !== baseline.fixtureSha256) add('fixture', `${fixturePath} ausente o modificado`);
  const fixtureImport = new RegExp(`${fixturePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

  const sources = Object.keys(files).filter(path => SOURCE.test(path) && !TEST.test(path)).sort();
  if (!sources.length) add('fuente', 'sin archivos fuente en src/');
  const stats = { any: Object.fromEntries(Object.keys(API).map(k => [k, false])), files: Object.fromEntries(Object.keys(API).map(k => [k, 0])) };
  let importsFixture = false;
  let components = 0;
  for (const path of sources) {
    const code = stripComments(text(files[path]));
    for (const [name, pattern] of rules.forbid) if (pattern.test(code)) add('api prohibida', `${name} en ${path}`);
    for (const specifier of imports(code)) {
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        if (fixtureImport.test(specifier)) importsFixture = true;
        continue;
      }
      if (!ALLOWED_PACKAGES.has(specifier)) add('dependencia externa', `${specifier} en ${path}`);
    }
    for (const [key, pattern] of Object.entries(API)) if (pattern.test(code)) { stats.any[key] = true; stats.files[key]++; }
    components += (code.match(/(?:export\s+default\s+)?function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*[:=][^;]*=>/g) ?? []).length;
  }
  for (const [label, test] of rules.require) if (!test(stats)) add(label.startsWith('no se usa useState') ? 'estado' : 'perfil estructural', label);
  if (!importsFixture) add('fixture', `la aplicación no importa ${fixturePath}`);

  return {
    status: violations.length ? 'FAIL' : 'PASS',
    violations,
    metrics: { source_files: sources.length, components_estimate: components, component_guideline: '5–20 (auditoría)' }
  };
}
