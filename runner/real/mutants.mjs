// Fuerza de los tests ocultos semi-reales (tarea 5 de docs/progreso-tareas-sin-modelos.md).
// Uso: npm run real:mutants -- Sxxx [Sxxx...] [--max=N]   |   npm run real:mutants -- --mini
// Para cada turno T00n: en un contenedor de la imagen de la familia (sin red) aplica las referencias de
// calibración T001..T00n, comprueba que los tests ocultos de T00n pasan y luego introduce, de uno en uno, mutantes
// en las líneas que añade la referencia T00n (código de la app, no tests). Cada mutante se evalúa con los tests
// ocultos de T001..T00n, como el oráculo de esa versión:
//   KILLED    algún test oculto falla;          SURVIVED  todos pasan (posible debilidad o mutante equivalente);
//   COMPILE   el archivo de tests no llega a ejecutarse (error de compilación o transformación);
//   ERROR     fallo de infraestructura (tiempo agotado, sin informe).
// Puntuación = KILLED / (KILLED + SURVIVED). Los SURVIVED se listan para revisión humana.
// Evidencia: docs/verification/real-mutants-sxxx.json. No modifica la familia ni el corpus.
// No ejecutar a la vez que scripts\real\ensayar-familias.cmd: ambos limpian contenedores del estrato semi-real.
import { writeFileSync, mkdtempSync, cpSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRealFamily, inPackage, TURN_OF, REAL_VERSIONS } from './families.mjs';
import { readBases, prepare } from './prepare.mjs';
import { openReal, execReal, closeReal } from './docker.mjs';
import { runSuiteIn, failing } from './suite.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);
const SOURCE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/;
const TEST = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
// Misma imagen de runtime que el ensayo --mini (runner/real/rehearse.mjs).
const RUNTIME_IMAGE = 'sha256:3ed948d6314561f36a6d7e0cc5b27f32098fa40fe11b3cb2afb927a187f11f95';

// Líneas añadidas por un parche (rutas relativas al paquete): [{ file, line (1-based en el archivo nuevo), text }].
export function addedLines(patch) {
  const out = [];
  let file = null, line = 0;
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('+++ ')) { file = raw === '+++ /dev/null' ? null : raw.slice(6); continue; }
    if (raw.startsWith('--- ') || raw.startsWith('diff --git')) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (!file) continue;
    if (raw.startsWith('+')) { out.push({ file, line, text: raw.slice(1) }); line++; }
    else if (raw.startsWith(' ')) line++;
  }
  return out.filter(l => SOURCE.test(l.file) && !TEST.test(l.file));
}

const STYLE_ATTR = /\b(className|class|style|size|variant|color|justify|align|gap|p|m|mb|mt|ml|mr|px|py|pt|pb|xs|sm|md|lg|xl|margin|padding|controlId|id|key|data-testid|order|radius|shadow|w|h)=\{?\s*$/;
// Literales de cadena de una línea con su posición, respetando comillas y escapes (las plantillas con ${…} se
// ignoran aquí). Devuelve objetos con la forma de un match: [texto, comilla, contenido] e index.
export function stringLiterals(text) {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    const quote = text[i];
    if (!`'"\``.includes(quote)) continue;
    let j = i + 1;
    while (j < text.length && text[j] !== quote) j += text[j] === '\\' ? 2 : 1;
    if (j >= text.length) break;
    const content = text.slice(i + 1, j);
    if (!(quote === '`' && content.includes('${'))) found.push(Object.assign([text.slice(i, j + 1), quote, content], { index: i }));
    i = j;
  }
  return found;
}
// Operadores de mutación, en orden de preferencia. Cada uno devuelve la línea mutada o null.
const swap = (pattern, replacement) => text => (pattern.test(text) ? text.replace(pattern, replacement) : null);
export const OPERATORS = [
  ['igualdad', text => (/ === /.test(text) ? text.replace(' === ', ' !== ') : / !== /.test(text) ? text.replace(' !== ', ' === ') : null)],
  ['relacional', text => {
    for (const [a, b] of [[' >= ', ' < '], [' <= ', ' > '], [' > ', ' <= '], [' < ', ' >= ']]) if (text.includes(a)) return text.replace(a, b);
    return null;
  }],
  ['lógico', text => (/ && /.test(text) ? text.replace(' && ', ' || ') : / \|\| /.test(text) ? text.replace(' || ', ' && ') : null)],
  ['booleano', text => (/\btrue\b/.test(text) ? text.replace(/\btrue\b/, 'false') : /\bfalse\b/.test(text) ? text.replace(/\bfalse\b/, 'true') : null)],
  ['aritmético', swap(/ ([+-]) (?=[\w(])/, (_, op) => (op === '+' ? ' - ' : ' + '))],
  ['negación', swap(/(\bif \()(?!!)/, '$1!')],
  ['texto', text => {
    // Texto de interfaz: literal de cadena (no rutas de import) o texto JSX entre etiquetas.
    // Se excluyen (2026-09-29, triaje de sobrevivientes): valores de props de estilo o de identificación interna,
    // claves de módulos CSS y posiciones de tipo de TypeScript, que no cambian el comportamiento observable.
    if (/^\s*(import|export \* from)\b/.test(text) || /^\s*(export\s+)?(type|interface)\s/.test(text)) return null;
    for (const literal of stringLiterals(text)) {
      const before = text.slice(0, literal.index);
      if (literal[2].length < 2 || /[$\\]/.test(literal[2]) || /^[./@]/.test(literal[2]) || STYLE_ATTR.test(before) || /className=/.test(before) || /styles\[$/.test(before) || /(:\s*|\|\s*)$/.test(before) || /^\s*\|/.test(text.slice(literal.index + literal[0].length))) continue;
      return text.slice(0, literal.index) + `${literal[1]}${literal[2]}·X${literal[1]}` + text.slice(literal.index + literal[0].length);
    }
    const jsx = text.match(/>([^<>{}]*[A-Za-zÁÉÍÓÚáéíóúñÑ][^<>{}]*)</);
    if (jsx) return text.replace(jsx[0], `>${jsx[1]}·X<`);
    // Plantilla: primer tramo de texto fijo de un literal `...${...}...`.
    const template = text.match(/`([^`$]*[A-Za-zÁÉÍÓÚáéíóúñÑ][^`$]*)\$\{/);
    return template && !/className=/.test(text.slice(0, template.index)) ? text.replace(template[0], `\`${template[1]}·X\${`) : null;
  }],
  ['retorno', (text, file) => {
    const match = text.match(/^(\s*)return (?!undefined\b)[^;{}]+;\s*$/);
    return match ? `${match[1]}return undefined${/\.tsx?$/.test(file) ? ' as any' : ''};` : null;
  }],
  ['borrado', text => {
    const t = text.trim();
    if (!t.endsWith(';') || /^(const|let|var|import|export|return|type|interface|case|default|break|throw)\b/.test(t) || /[{}]/.test(t)) return null;
    return text.replace(t, `/* evoguard-mutant */ void 0;`);
  }]
];

// Selección determinista: el primer operador aplicable por línea; hasta `max` mutantes repartidos entre líneas.
export function selectMutants(lines, max) {
  const candidates = [];
  for (const l of lines) {
    if (/^\s*(\/\/|\*|\/\*)/.test(l.text) || !l.text.trim()) continue;
    for (const [operator, mutate] of OPERATORS) {
      const mutated = mutate(l.text, l.file);
      if (mutated !== null && mutated !== l.text) { candidates.push({ ...l, operator, mutated }); break; }
    }
  }
  if (candidates.length <= max) return candidates;
  const step = candidates.length / max;
  return Array.from({ length: max }, (_, i) => candidates[Math.floor(i * step)]);
}

const EDIT = `const fs=require('node:fs');const [file,line,expected,text]=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const lines=fs.readFileSync(file,'utf8').split('\\n');if(lines[line-1]!==expected)throw new Error('línea inesperada en '+file+':'+line);
lines[line-1]=text;fs.writeFileSync(file,lines.join('\\n'));`;
const WRITE = `const fs=require('node:fs'),path=require('node:path');const files=JSON.parse(fs.readFileSync(0,'utf8'));
for(const [rel,text] of Object.entries(files)){const t=path.join('/workspace/repo',rel);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,text);}`;

// Ejecuta los tests ocultos de T001..T00n (como el oráculo de Vn): un mutante del turno n puede romper un turno anterior.
async function hidden(session, m, rels) {
  const result = await runSuiteIn(session, m, { files: rels, timeout: 10 * 60000 });
  if (!result.run) return { status: 'ERROR', detail: result.error };
  const mine = k => rels.some(rel => k.startsWith(`${rel} ›`));
  const tests = Object.keys(result.run.results).filter(mine);
  if (rels.some(rel => result.run.suiteFailedFiles.includes(rel))) {
    const errors = (result.run.suiteErrors ?? []).filter(e => rels.some(rel => e.startsWith(rel))).map(e => e.slice(0, 1500));
    return { status: 'COMPILE', tests: tests.length, errors };
  }
  const failed = failing(result.run, mine);
  return { status: failed.length ? 'KILLED' : 'SURVIVED', tests: tests.length, failed: failed.length, failing: failed.slice(0, 10) };
}

export async function mutateFamily(root, familyId, { max = 8 } = {}) {
  const data = loadRealFamily(root, familyId);
  const m = data.manifest;
  const base = readBases(root).bases[familyId];
  if (base?.status !== 'VERIFIED') throw new Error(`${familyId}: imagen sin verificar (npm run real:prepare)`);
  const report = { artifact_type: 'real_hidden_tests_mutation', family_id: familyId, image_id: base.image_id, max_per_turn: max, started_at: new Date().toISOString(), turns: [] };
  const dir = m.package_path === '.' ? '' : ` --directory='${m.package_path}'`;
  for (const [index, version] of REAL_VERSIONS.entries()) {
    const turn = data.turns[index];
    const turnsSoFar = data.turns.slice(0, index + 1);
    const rels = turnsSoFar.map(t => `${m.hidden_tests_dir}/${basename(t.hidden_tests)}`);
    const entry = { turn: TURN_OF[version], hidden_tests: rels, mutants: [] };
    report.turns.push(entry);
    const session = openReal(base.image_id, 'real-oracle');
    try {
      // Base: V0 de la imagen más las referencias de calibración T001..T00n aplicadas al árbol (sin commits).
      if (execReal(session, ['git', 'rev-parse', 'HEAD']) !== base.v0_repo_commit) throw new Error(`${familyId}: la imagen no está en el V0 registrado`);
      for (const t of data.turns.slice(0, index + 1)) execReal(session, ['sh', '-c', `git apply${dir} --whitespace=nowarn -`], { input: t.patchText, timeout: 300000 });
      execReal(session, ['node', '-e', WRITE], { input: JSON.stringify(Object.fromEntries(turnsSoFar.map((t, i) => [inPackage(m, rels[i]), t.hiddenTestsText]))) });
      entry.baseline = await hidden(session, m, rels);
      log(`${familyId} ${entry.turn}: referencia ${entry.baseline.status === 'SURVIVED' ? 'PASA' : entry.baseline.status} (${entry.baseline.tests ?? 0} tests ocultos)`);
      if (entry.baseline.status !== 'SURVIVED') {
        entry.error = 'la referencia no pasa sus tests ocultos';
        for (const detail of entry.baseline.errors ?? []) log(`  ${detail.replace(/\n/g, '\n    ')}`);
        for (const name of entry.baseline.failing ?? []) log(`  falla con la referencia: ${name}`);
        continue;
      }
      for (const mutant of selectMutants(addedLines(turn.patchText), max)) {
        const file = `/workspace/repo/${inPackage(m, mutant.file)}`;
        execReal(session, ['node', '-e', EDIT], { input: JSON.stringify([file, mutant.line, mutant.text, mutant.mutated]) });
        const result = await hidden(session, m, rels);
        execReal(session, ['node', '-e', EDIT], { input: JSON.stringify([file, mutant.line, mutant.mutated, mutant.text]) });
        entry.mutants.push({ file: mutant.file, line: mutant.line, operator: mutant.operator, original: mutant.text.trim().slice(0, 200), mutated: mutant.mutated.trim().slice(0, 200), result: result.status });
        log(`  ${mutant.file}:${mutant.line} ${mutant.operator}: ${result.status}`);
      }
    } finally { closeReal(session); }
    const count = s => entry.mutants.filter(x => x.result === s).length;
    entry.summary = { KILLED: count('KILLED'), SURVIVED: count('SURVIVED'), COMPILE: count('COMPILE'), ERROR: count('ERROR') };
    entry.score = entry.summary.KILLED + entry.summary.SURVIVED ? +(entry.summary.KILLED / (entry.summary.KILLED + entry.summary.SURVIVED)).toFixed(2) : null;
  }
  const all = report.turns.flatMap(t => t.mutants);
  const killed = all.filter(x => x.result === 'KILLED').length, survived = all.filter(x => x.result === 'SURVIVED').length;
  report.score = killed + survived ? +(killed / (killed + survived)).toFixed(2) : null;
  report.survivors = report.turns.flatMap(t => t.mutants.filter(x => x.result === 'SURVIVED').map(x => ({ turn: t.turn, ...x })));
  report.finished_at = new Date().toISOString();
  return report;
}

// En Windows un archivo con el atributo de solo lectura da EPERM al escribir; chmod lo quita. Si aun así falla,
// el informe se guarda en .artifacts/ para no perder la ejecución.
function writeReport(path, report) {
  const text = JSON.stringify(report, null, 2) + '\n';
  try { writeFileSync(path, text); return; } catch (error) { if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error; }
  try { chmodSync(path, 0o666); writeFileSync(path, text); return; } catch { /* sigue abajo */ }
  const fallback = join(repoRoot, '.artifacts', basename(path));
  mkdirSync(join(repoRoot, '.artifacts'), { recursive: true });
  writeFileSync(fallback, text);
  log(`AVISO: no se pudo escribir ${path}; informe guardado en ${fallback}`);
}

async function main() {
  const args = process.argv.slice(2);
  const max = Number(args.find(a => a.startsWith('--max='))?.split('=')[1] ?? 8);
  if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error('--max debe ser un entero de 1 a 50');
  if (args.includes('--mini')) {
    const root = mkdtempSync(join(repoRoot, '.artifacts', 'real-mutants-mini-'));
    try {
      for (const path of ['config', 'prompts', 'schema', 'docker']) cpSync(join(repoRoot, path), join(root, path), { recursive: true });
      mkdirSync(join(root, 'families-real'), { recursive: true });
      cpSync(join(repoRoot, 'tests/fixtures/real-mini/family'), join(root, 'families-real/S900-mini-cart'), { recursive: true });
      await prepare(root, 'S900', { base: RUNTIME_IMAGE, source: 'dir', srcDir: join(repoRoot, 'tests/fixtures/real-mini/repo'), installCmd: 'ln -s /opt/deps/node_modules node_modules' });
      const report = await mutateFamily(root, 'S900', { max });
      writeReport(join(repoRoot, 'docs/verification/real-mutants-s900.json'), report);
      log(`S900: puntuación ${report.score}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
    return;
  }
  const families = args.filter(a => /^S\d{3}$/.test(a));
  if (!families.length) throw new Error('Uso: npm run real:mutants -- Sxxx [Sxxx...] [--max=N] | --mini');
  for (const id of families) {
    const report = await mutateFamily(repoRoot, id, { max });
    writeReport(join(repoRoot, `docs/verification/real-mutants-${id.toLowerCase()}.json`), report);
    log(`${id}: puntuación ${report.score}; sobrevivientes ${report.survivors.length} → docs/verification/real-mutants-${id.toLowerCase()}.json`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
