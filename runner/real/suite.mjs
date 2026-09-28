// Ejecución e interpretación de la suite de tests de un repositorio real (vitest o jest, informe JSON).
// Misma semántica que scripts/real/calibrar.mjs: resultados por test «archivo › nombre completo», archivos que
// no llegan a ejecutar ningún test (no compilan) y comparación estable con resultados ordenados.
import { posix } from 'node:path';
import { runReal, execReal } from './docker.mjs';

export const REPORT = '/tmp/evoguard-report.json';
// Reduce el informe a lo necesario (evita salidas de decenas de MB con mensajes y trazas completos).
const COMPACT = `const fs=require('node:fs');let j;try{j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'))}catch{process.exit(0)}
process.stdout.write(JSON.stringify({numTotalTests:j.numTotalTests,numFailedTests:j.numFailedTests,testResults:(j.testResults||[]).map(s=>({name:s.name||s.testFilePath,status:s.status,message:String(s.message||s.failureMessage||'').slice(0,1500),assertionResults:(s.assertionResults||[]).map(a=>({fullName:a.fullName||a.title,status:a.status}))}))}));`;

// Comando de la suite en el paquete (sh -lc). files: rutas relativas al paquete (opcional).
export function suiteCommand(manifest, files = []) {
  const list = files.map(f => `'${f.replace(/'/g, '')}'`).join(' ');
  return manifest.runner === 'vitest'
    ? `npx --no-install vitest run ${list} --reporter=json --outputFile=${REPORT} --maxWorkers=2`
    : `npx --no-install jest --ci ${list} --json --outputFile=${REPORT} --maxWorkers=2 --forceExit`;
}

// Informe JSON → { results: {clave: estado}, suiteFailedFiles, total, failed }. cwd: ruta absoluta del paquete.
export function parseReport(json, cwd) {
  const report = typeof json === 'string' ? JSON.parse(json) : json;
  const results = {};
  const suiteFailedFiles = [];
  const suiteErrors = [];
  for (const suite of report.testResults ?? []) {
    const file = posix.relative(cwd, suite.name ?? suite.testFilePath ?? '');
    const assertions = suite.assertionResults ?? [];
    if (suite.status === 'failed' && !assertions.length) {
      suiteFailedFiles.push(file);
      suiteErrors.push(`${file}: ${String(suite.message ?? suite.failureMessage ?? '').slice(0, 1500)}`);
    }
    for (const a of assertions) results[`${file} › ${a.fullName ?? a.title}`] = a.status;
  }
  return { results, suiteFailedFiles, suiteErrors, total: report.numTotalTests ?? Object.keys(results).length, failed: report.numFailedTests ?? null };
}

const IGNORED = new Set(['passed', 'pending', 'skipped', 'todo', 'disabled']);
export const failing = (run, filter = () => true) => Object.entries(run.results).filter(([k, v]) => filter(k) && !IGNORED.has(v)).map(([k]) => k).sort();
export const passing = (run, filter = () => true) => Object.entries(run.results).filter(([k, v]) => filter(k) && v === 'passed').map(([k]) => k).sort();
export const signature = run => JSON.stringify(Object.entries(run.results).sort(([a], [b]) => (a < b ? -1 : 1)).concat([['__suites_failed__', [...run.suiteFailedFiles].sort()]]));

// Ejecuta la suite (o archivos concretos) dentro de un contenedor semi-real y devuelve el resultado interpretado.
// { run, error: null | 'TIMEOUT' | 'SIN_INFORME' | 'INFRA_ERROR', ms, tail }
export async function runSuiteIn(session, manifest, { files = [], timeout = 30 * 60000 } = {}) {
  const pkg = manifest.package_path === '.' ? '/workspace/repo' : `/workspace/repo/${manifest.package_path}`;
  const started = Date.now();
  const outcome = runReal(session, ['sh', '-c', `rm -f ${REPORT}; ${suiteCommand(manifest, files)} > /tmp/evoguard-suite.log 2>&1; tail -c 4000 /tmp/evoguard-suite.log`], { timeout, cwd: pkg });
  const ms = Date.now() - started;
  if (outcome.status === 'TIMEOUT' || outcome.status === 'INFRA_ERROR') return { run: null, error: outcome.status, ms, tail: outcome.output };
  let report;
  try { report = execReal(session, ['node', '-e', COMPACT, REPORT], { timeout: 120000, cwd: pkg, raw: true }); }
  catch (error) { return { run: null, error: 'INFRA_ERROR', ms, tail: String(error.message).slice(0, 2000) }; }
  if (!report.trim()) return { run: null, error: 'SIN_INFORME', ms, tail: outcome.output };
  try { return { run: parseReport(report, pkg), error: null, ms, tail: outcome.output }; }
  catch { return { run: null, error: 'SIN_INFORME', ms, tail: outcome.output }; }
}
