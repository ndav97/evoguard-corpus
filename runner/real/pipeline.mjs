// R3 — Workspaces y evaluador del estrato semi-real para runTask (runner/execution/engine.mjs).
// - Workspace del constructor: contenedor nuevo desde la imagen de la familia, historia reconstruida (V0 + parches
//   aceptados), vista inicial acotada a la zona del cambio y run_checks = la suite del repositorio.
// - Etapas: typecheck (si la familia lo define), build (no aplica), development_tests (suite completa, visible),
//   independent_oracle (tests ocultos T1..Tn + suite sin regresiones en un contenedor aparte; privado) y
//   architecture (control de alcance: dependencias, configuración, tests existentes, directorio oculto).
import { workspaceOps } from '../pipeline/workspace.mjs';
import { openReal, closeReal, execReal } from './docker.mjs';
import { applySteps } from './lineage.mjs';
import { runSuiteIn, failing, signature, suiteCommand } from './suite.mjs';
import { inPackage, scopeViolation, visibleChecks, REAL_VERSIONS } from './families.mjs';

export const TEST_FILE = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test-utils?\.[cm]?[jt]sx?$/;
const pkgDir = manifest => (manifest.package_path === '.' ? '/workspace/repo' : `/workspace/repo/${manifest.package_path}`);
const tail = (text, n = 16000) => (text.length > n ? `[… ${text.length - n} caracteres omitidos …]\n${text.slice(-n)}` : text);

// Adaptador de ejecución de workspaceOps (misma interfaz que execSandbox) sobre un contenedor semi-real.
const execAdapter = session => (_name, _image, argv, options = {}) => execReal(session, argv, options);

function listTracked(session) {
  return execReal(session, ['git', 'ls-files', '-z'], { raw: true, timeout: 120000 }).split('\0').filter(Boolean);
}

// Paquete de archivos para escribir en un contenedor (tests ocultos): { ruta: texto }.
const WRITE_FILES = `const fs=require('node:fs'),path=require('node:path');const files=JSON.parse(fs.readFileSync(0,'utf8'));
for(const [rel,text] of Object.entries(files)){if(rel.split('/').some(s=>!s||s==='..'))throw new Error('ruta inválida');const t=path.join('/workspace/repo',rel);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,text);}
console.log(Object.keys(files).length);`;

export function realWorkspaces({ image, manifest, steps = [], v0Commit, onOpen = () => {}, onClose = () => {} }) {
  const checks = visibleChecks(manifest);
  return {
    async open() {
      const session = openReal(image, 'real-sandbox');
      try {
        const baseline = applySteps(session, steps, { v0Commit });
        const tracked = listTracked(session);
        const existingTests = new Set(tracked.filter(path => TEST_FILE.test(path)));
        const hiddenDir = inPackage(manifest, manifest.hidden_tests_dir);
        const ops = workspaceOps({ name: session.name, image, initialization: { baseline_commit: baseline } }, { exec: execAdapter(session) });
        onOpen(session);
        return {
          ...ops,
          session,
          initialization: { baseline_commit: baseline },
          existingTests,
          // Escrituras bloqueadas con mensaje visible (el control de alcance lo vuelve a comprobar al entregar).
          protectedPath(path) {
            if (existingTests.has(path)) return true;
            if (path === hiddenDir || path.startsWith(`${hiddenDir}/`)) return true;
            const rel = manifest.package_path === '.' ? path : path.startsWith(`${manifest.package_path}/`) ? path.slice(manifest.package_path.length + 1) : path;
            return Boolean(scopeViolation(rel) || scopeViolation(path));
          },
          async runChecks({ timeout = 30 * 60000 } = {}) {
            const parts = [];
            let status = 'PASS';
            for (const [name, argv] of Object.entries(checks)) {
              const command = `cd '${pkgDir(manifest)}' && ${argv.join(' ')} > /tmp/evoguard-check.log 2>&1; code=$?; tail -c 12000 /tmp/evoguard-check.log; exit $code`;
              const result = await ops.exec(['sh', '-c', command], { timeout });
              if (result.status === 'TIMEOUT' || result.status === 'INFRA_ERROR') return result;
              if (result.status !== 'PASS') status = 'FAIL';
              parts.push(`== ${name}: ${result.status}\n$ (en ${manifest.package_path}) ${argv.join(' ')}\n${result.output}`);
            }
            return { status, output: parts.join('\n') };
          },
          async overview({ timeout = 60000 } = {}) {
            const files = tracked.filter(path => manifest.package_path === '.' || path.startsWith(`${manifest.package_path}/`));
            const shown = files.length > 1500 ? files.filter(path => !TEST_FILE.test(path)).slice(0, 1500) : files;
            const contents = {};
            let budget = 24000;
            const focusDir = manifest.focus.slice(0, manifest.focus.lastIndexOf('/') + 1);
            const base = manifest.focus.replace(/\.[^.]+$/, '');
            const related = [manifest.focus, ...files.filter(p => p !== manifest.focus && p.startsWith(base) && TEST_FILE.test(p)), ...files.filter(p => p !== manifest.focus && p.startsWith(focusDir) && !p.slice(focusDir.length).includes('/') && !TEST_FILE.test(p))];
            for (const path of related) {
              const text = execReal(session, ['cat', path], { raw: true, timeout });
              if (Buffer.byteLength(text) > budget) { if (path === manifest.focus) contents[path] = `${text.slice(0, budget)}\n[… recortado: usa read_file o tool sed -n …]`; break; }
              contents[path] = text; budget -= Buffer.byteLength(text);
            }
            return {
              note: `Repositorio real en su estado actual. Paquete de la app: ${manifest.package_path}. Zona del cambio: ${manifest.focus}. Se listan ${shown.length} de ${files.length} archivos versionados del paquete (sin node_modules).`,
              files: shown, contents
            };
          },
          async close() {
            closeReal(session);
            onClose(session);
          }
        };
      } catch (error) {
        closeReal(session);
        throw error;
      }
    }
  };
}

// Control de alcance sobre el parche del candidato (diff respecto de la base del workspace).
export function scopeCheck(patch, { manifest, existingTests }) {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  if (typeof patch !== 'string') return [{ rule: 'parche', detail: 'no textual' }];
  if (Buffer.byteLength(patch) > 4 * 1024 * 1024) add('parche', 'mayor de 4 MiB');
  const hiddenDir = inPackage(manifest, manifest.hidden_tests_dir);
  for (const match of patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)\n((?:(?!diff --git ).*\n)*)/gm)) {
    const [, from, to, header] = match;
    for (const path of new Set([from, to])) {
      const rel = manifest.package_path === '.' ? path : path.startsWith(`${manifest.package_path}/`) ? path.slice(manifest.package_path.length + 1) : path;
      const reason = scopeViolation(path) ?? scopeViolation(rel);
      if (reason) add('alcance', `${path}: ${reason}`);
      if (existingTests.has(path)) add('tests existentes', `${path} ${/^deleted file mode/m.test(header) ? 'borrado' : 'modificado'}`);
      if (path === hiddenDir || path.startsWith(`${hiddenDir}/`)) add('alcance', `${path}: directorio reservado`);
    }
    if (/^(new|deleted) file mode 120000|^new mode 120000/m.test(header)) add('alcance', `${to}: enlace simbólico`);
  }
  return violations;
}

// Oráculo semi-real en un contenedor nuevo: reconstruye la base, aplica el parche del candidato, copia los tests
// ocultos de T1..Tn y ejecuta la suite completa. Devuelve el informe completo (privado).
export async function runRealOracle({ image, manifest, steps, v0Commit, patch, hiddenTests, version, runs = 1 }) {
  const n = REAL_VERSIONS.indexOf(version) + 1;
  const hiddenRel = hiddenTests.slice(0, n).map(t => ({ turn: t.id, rel: `${manifest.hidden_tests_dir}/${t.file}` }));
  const known = new Set(manifest.known_failures);
  const report = { version, runs: [] };
  const signatures = [];
  for (let run = 0; run < runs; run++) {
    const session = openReal(image, 'real-oracle');
    try {
      applySteps(session, steps, { v0Commit });
      if (patch.length) execReal(session, ['git', 'apply', '--binary', '--whitespace=nowarn', '-'], { input: patch, timeout: 300000 });
      execReal(session, ['node', '-e', WRITE_FILES], { input: JSON.stringify(Object.fromEntries(hiddenTests.slice(0, n).map(t => [inPackage(manifest, `${manifest.hidden_tests_dir}/${t.file}`), t.text]))) });
      const result = await runSuiteIn(session, manifest);
      if (!result.run) { report.runs.push({ error: result.error, tail: result.tail }); continue; }
      const isHidden = key => key.startsWith(`${manifest.hidden_tests_dir}/`);
      const perTurn = Object.fromEntries(hiddenRel.map(({ turn, rel }) => {
        const keys = Object.keys(result.run.results).filter(k => k.startsWith(`${rel} ›`));
        return [turn, { tests: keys.length, failing: failing(result.run, k => k.startsWith(`${rel} ›`)), compile_error: result.run.suiteFailedFiles.includes(rel) }];
      }));
      const suiteFailing = failing(result.run, k => !isHidden(k) && !known.has(k));
      const suiteBroken = result.run.suiteFailedFiles.filter(f => !f.startsWith(`${manifest.hidden_tests_dir}/`));
      const pass = Object.values(perTurn).every(t => t.tests > 0 && !t.failing.length && !t.compile_error) && !suiteFailing.length && !suiteBroken.length;
      report.runs.push({ status: pass ? 'PASS' : 'FAIL', seconds: Math.round(result.ms / 1000), total: result.run.total, hidden: perTurn, suite_failing: suiteFailing, suite_broken: suiteBroken, tail: pass ? undefined : result.tail });
      signatures.push(signature(result.run));
    } finally { closeReal(session); }
  }
  report.stable = signatures.length === runs && signatures.every(s => s === signatures[0]);
  report.status = report.runs.every(r => r.status === 'PASS') && report.stable ? 'PASS' : report.runs.some(r => r.error) ? 'INFRA_ERROR' : 'FAIL';
  return report;
}

// Evaluador para runTask. hiddenTests: [{ id, file, text }] de T001..T003 (solo en el host).
export function createRealEvaluator({ image, manifest, steps, v0Commit, version, hiddenTests, privateSink = () => {}, oracleRuns = 1 }) {
  const checks = visibleChecks(manifest);
  return {
    async check(stage, workspace, { timeout = 30 * 60000 } = {}) {
      if (stage === 'build') return { status: 'NOT_APPLICABLE', feedback: 'sin build en el estrato semi-real' };
      if (stage === 'typecheck') {
        if (!checks.typecheck) return { status: 'NOT_APPLICABLE', feedback: 'la familia no define comprobación de tipos' };
        const outcome = await workspace.exec(['sh', '-c', `cd '${pkgDir(manifest)}' && ${checks.typecheck.join(' ')} > /tmp/evoguard-tc.log 2>&1; code=$?; tail -c 16000 /tmp/evoguard-tc.log; exit $code`], { timeout });
        if (['TIMEOUT', 'INFRA_ERROR'].includes(outcome.status)) return { status: outcome.status };
        return { status: outcome.status, feedback: `$ ${checks.typecheck.join(' ')}\n${outcome.output}` };
      }
      if (stage === 'development_tests') {
        // Suite completa del repositorio en el propio workspace del constructor (feedback visible).
        const result = await runSuiteIn(workspace.session, manifest, { timeout });
        if (result.error === 'TIMEOUT') return { status: 'TIMEOUT' };
        if (result.error === 'INFRA_ERROR') return { status: 'INFRA_ERROR' };
        const command = `$ (en ${manifest.package_path}) ${suiteCommand(manifest).replace(/ --(reporter=json|json) --outputFile=\S+/, '')}`;
        if (!result.run) return { status: 'FAIL', feedback: `${command}\nLa suite no produjo informe (¿error de configuración o de compilación?).\n${tail(result.tail ?? '')}` };
        const known = new Set(manifest.known_failures);
        const problems = [...result.run.suiteFailedFiles.map(f => `NO COMPILA / NO EJECUTA: ${f}`), ...failing(result.run, k => !known.has(k)).map(k => `FALLA: ${k}`)];
        const status = problems.length || !result.run.total ? 'FAIL' : 'PASS';
        return { status, feedback: `${command}\n${result.run.total} tests; ${problems.length} problemas${problems.length ? `:\n${problems.slice(0, 60).join('\n')}` : ''}\n${tail(result.tail ?? '', 12000)}` };
      }
      if (stage === 'architecture') {
        let patch;
        try { patch = await workspace.snapshot({ timeout: 120000 }); } catch (error) { await privateSink({ stage, infra_error: error.message.slice(0, 1000) }); return { status: 'INFRA_ERROR' }; }
        const violations = scopeCheck(patch, { manifest, existingTests: workspace.existingTests ?? new Set() });
        await privateSink({ stage, status: violations.length ? 'FAIL' : 'PASS', report: { violations } });
        return { status: violations.length ? 'FAIL' : 'PASS' };
      }
      if (stage === 'independent_oracle') {
        try {
          const patch = await workspace.snapshot({ timeout: 120000 });
          const report = await runRealOracle({ image, manifest, steps, v0Commit, patch, hiddenTests, version, runs: oracleRuns });
          await privateSink({ stage, status: report.status, report });
          return { status: report.status };
        } catch (error) {
          await privateSink({ stage, infra_error: error.message.slice(0, 4000) });
          return { status: 'INFRA_ERROR' };
        }
      }
      throw new Error(`Etapa desconocida: ${stage}`);
    }
  };
}
