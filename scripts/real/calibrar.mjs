#!/usr/bin/env node
// EvoGuard — calibración de las familias semi-reales (families-real/Sxxx-*/).
//
// Para cada familia y cada turno Tn, sobre la base V0 ya instalada (caché de la
// verificación de bases), comprueba:
//   1. Antes del cambio (V0 + referencias T1..Tn-1):
//      - los tests ocultos de turnos anteriores pasan (preservación);
//      - los tests ocultos de Tn fallan al menos en parte (fail-to-pass).
//   2. Después del cambio (+ referencia Tn):
//      - todos los tests ocultos de T1..Tn pasan;
//      - la suite completa del repo pasa, salvo sus fallos conocidos de V0;
//      - el resultado es idéntico en dos ejecuciones (estabilidad).
// Al terminar deja el workspace exactamente en V0.
//
// Uso (dentro del contenedor, sin red):
//   node scripts/real/calibrar.mjs --cache /cache/repos --out .artifacts/real-calibration [--family S001]

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const cache = args.cache ?? '/cache/repos';
const out = path.resolve(root, args.out ?? '.artifacts/real-calibration');
const only = args.family ?? null;
const runs = Number(args.runs ?? 2);
const log = (...a) => console.error(...a);

function sh(cmd, cwd, timeoutMin = 20) {
  return new Promise((resolve) => {
    const t0 = Date.now(); let outText = ''; let timedOut = false;
    const child = spawn(cmd, { cwd, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
    const add = (d) => { outText += d; if (outText.length > 400000) outText = outText.slice(-200000); };
    child.stdout.on('data', add); child.stderr.on('data', add);
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* */ } }, timeoutMin * 60000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0 && !timedOut, timedOut, out: outText.slice(-3000), ms: Date.now() - t0 }); });
  });
}

async function git(cwd, cmd) {
  const r = await sh(`git ${cmd}`, cwd, 5);
  if (!r.ok) throw new Error(`git ${cmd}: ${r.out}`);
  return r.out;
}

// Ejecuta tests y devuelve { name -> 'passed' | 'failed' } a partir del informe JSON.
async function runTests(fam, wt, files) {
  const cwd = path.join(wt, fam.package_path ?? '.');
  const report = path.join(wt, '.evoguard-calib.json');
  await fs.rm(report, { force: true });
  const list = (files ?? []).map((f) => `"${f}"`).join(' ');
  const cmd = fam.runner === 'vitest'
    ? `npx --no-install vitest run ${list} --reporter=json --outputFile="${report}" --maxWorkers=2`
    : `npx --no-install jest --ci ${list} --json --outputFile="${report}" --maxWorkers=2 --forceExit`;
  const r = await sh(cmd, cwd);
  let j = null;
  try { j = JSON.parse(await fs.readFile(report, 'utf8')); } catch { /* sin informe */ }
  if (!j) return { error: r.timedOut ? 'TIMEOUT' : 'SIN_INFORME', tail: r.out, results: {}, suiteFailedFiles: [] };
  const results = {};
  let suitesFailed = 0;
  const suiteErrors = [];
  const suiteFailedFiles = [];
  for (const s of j.testResults ?? []) {
    const file = path.relative(cwd, s.name ?? s.testFilePath ?? '');
    if (s.status === 'failed' && !(s.assertionResults ?? []).length) { suitesFailed++; suiteFailedFiles.push(file); suiteErrors.push(`${file}: ${String(s.message ?? s.failureMessage ?? '').slice(0, 1500)}`); }
    for (const a of s.assertionResults ?? []) results[`${file} › ${a.fullName ?? a.title}`] = a.status;
  }
  return { results, suitesFailed, suiteErrors, suiteFailedFiles, total: j.numTotalTests, failed: j.numFailedTests, ms: r.ms, tail: j.numFailedTests || suitesFailed ? r.out : undefined };
}

const passed = (res, filter = () => true) => Object.entries(res.results).filter(([k, v]) => filter(k) && v === 'passed').map(([k]) => k);
const failed = (res, filter = () => true) => Object.entries(res.results).filter(([k, v]) => filter(k) && v !== 'passed' && v !== 'pending' && v !== 'skipped' && v !== 'todo').map(([k]) => k);

async function resetToV0(fam, wt) {
  await git(wt, 'checkout -q -f -- .');
  await git(wt, 'clean -q -fd');                     // conserva node_modules (ignorado)
  const head = (await git(wt, 'rev-parse HEAD')).trim();
  if (head !== fam.v0.commit) throw new Error(`El workspace no está en V0 (${head})`);
}

async function stage(fam, dir, wt, upTo, withPatchOf) {
  await resetToV0(fam, wt);
  // Los parches son relativos al paquete de la app: desde la raíz del repo hay que indicar
  // --directory, o git ignora el parche en silencio. Además se comprueba que cambió algo.
  const pkg = fam.package_path && fam.package_path !== '.' ? ` --directory="${fam.package_path}"` : '';
  for (const t of fam.turns.slice(0, withPatchOf)) {
    const before = await git(wt, 'diff --stat');
    await git(wt, `apply${pkg} "${path.join(dir, t.reference_patch)}"`);
    if ((await git(wt, 'diff --stat')) === before) throw new Error(`El parche ${t.reference_patch} no modificó ningún archivo`);
  }
  const hidden = path.join(wt, fam.package_path ?? '.', fam.hidden_tests_dir);
  await fs.mkdir(hidden, { recursive: true });
  for (const t of fam.turns.slice(0, upTo)) await fs.copyFile(path.join(dir, t.hidden_tests), path.join(hidden, path.basename(t.hidden_tests)));
}

async function calibrateFamily(dir) {
  const fam = YAML.parse(await fs.readFile(path.join(dir, 'family.yaml'), 'utf8'));
  const wt = path.join(cache, '_baselines', fam.workspace);
  const res = { id: fam.id, repo: fam.repo, v0: fam.v0.commit, turns: [], ok: true };
  if (!existsSync(path.join(wt, 'node_modules')) && !existsSync(path.join(wt, fam.package_path ?? '.', 'node_modules'))) {
    return { ...res, ok: false, error: `Base no instalada en ${wt}. Ejecuta antes verificar-bases.` };
  }
  const known = new Set(fam.known_failures ?? []);
  const hiddenRel = (t) => path.posix.join(fam.hidden_tests_dir, path.basename(t.hidden_tests));
  try {
    for (const [i, t] of fam.turns.entries()) {
      log(`  ${fam.id} ${t.id}: antes del cambio…`);
      const n = i + 1;
      const r = { id: t.id, checks: {} };
      const isTurn = (k) => k.startsWith(hiddenRel(t));
      const isPrev = (k) => fam.turns.slice(0, i).some((p) => k.startsWith(hiddenRel(p)));

      // 1. Antes: V0 + referencias anteriores, con los tests ocultos hasta Tn.
      await stage(fam, dir, wt, n, i);
      const before = await runTests(fam, wt, fam.turns.slice(0, n).map(hiddenRel));
      // Un archivo oculto que ni siquiera compila antes del cambio (p. ej. ts-jest con comprobación
      // de tipos y una prop nueva) cuenta como fallo del turno: ninguno de sus tests puede pasar.
      const suiteFailedBefore = before.suiteFailedFiles ?? [];
      const turnSuiteFailed = suiteFailedBefore.includes(hiddenRel(t));
      const prevSuiteFailed = fam.turns.slice(0, i).map(hiddenRel).filter((f) => suiteFailedBefore.includes(f));
      r.before = { error: before.error, suite_errors: before.suiteErrors, f2p: failed(before, isTurn), f2p_suite: turnSuiteFailed, already_passing: passed(before, isTurn), prev_failing: [...failed(before, isPrev), ...prevSuiteFailed] };
      r.checks.tests_fallan_antes = !before.error && (r.before.f2p.length > 0 || turnSuiteFailed);
      r.checks.preservacion_antes = !before.error && r.before.prev_failing.length === 0;

      // 2. Después: + referencia Tn; tests ocultos y suite completa, dos veces.
      log(`  ${fam.id} ${t.id}: después del cambio (${runs} ejecuciones de la suite completa)…`);
      await stage(fam, dir, wt, n, n);
      const after = [];
      for (let k = 0; k < runs; k++) after.push(await runTests(fam, wt, null));
      const a = after[0];
      const hiddenFailing = failed(a, (k) => isTurn(k) || isPrev(k));
      const suiteFailing = failed(a, (k) => !k.startsWith(fam.hidden_tests_dir) && !known.has(k));
      const hiddenCount = Object.keys(a.results).filter((k) => isTurn(k)).length;
      r.after = { error: a.error, hidden_tests: hiddenCount, hidden_failing: hiddenFailing, suite_total: a.total, suite_failing: suiteFailing,
        suites_failed: a.suitesFailed, suite_errors: a.suiteErrors, seconds: Math.round((a.ms ?? 0) / 1000), tail: hiddenFailing.length || suiteFailing.length || a.suitesFailed || a.error ? a.tail : undefined };
      r.checks.tests_pasan_despues = !a.error && hiddenCount > 0 && hiddenFailing.length === 0;
      r.checks.suite_sin_regresiones = !a.error && suiteFailing.length === 0 && !a.suitesFailed;
      const sig = (x) => JSON.stringify(Object.entries(x.results).sort(([p], [q]) => (p < q ? -1 : 1)));
      r.checks.estable = after.every((x) => sig(x) === sig(a));
      r.ok = Object.values(r.checks).every(Boolean);
      res.turns.push(r);
      if (!r.ok) res.ok = false;
      log(`  ${fam.id} ${t.id}: ${r.ok ? 'OK' : 'FALLA'} — fallan antes ${turnSuiteFailed ? `todos (no compila)` : r.before.f2p.length}/${hiddenCount}, ocultos que fallan después ${hiddenFailing.length}, regresiones en la suite ${suiteFailing.length}${r.checks.estable ? '' : ', INESTABLE'}`);
    }
  } finally {
    await resetToV0(fam, wt).catch((e) => log(`  aviso: no se pudo restaurar V0: ${e.message}`));
  }
  return res;
}

async function main() {
  const famRoot = path.join(root, 'families-real');
  const dirs = (await fs.readdir(famRoot)).filter((d) => /^S\d{3}-/.test(d) && (!only || d.startsWith(only))).sort();
  await fs.mkdir(out, { recursive: true });
  const all = [];
  for (const d of dirs) {
    log(`\n${d}`);
    const r = await calibrateFamily(path.join(famRoot, d)).catch((e) => ({ id: d.slice(0, 4), ok: false, error: String(e.message).slice(0, 2000) }));
    await fs.writeFile(path.join(out, `${r.id}.json`), JSON.stringify(r, null, 2));
    all.push(r);
  }
  const lines = ['| Familia | Turno | Fallan antes | Ocultos OK después | Suite sin regresiones | Estable | Resultado |', '|---|---|---|---|---|---|---|'];
  for (const f of all) {
    if (f.error) { lines.push(`| ${f.id} | — | — | — | — | — | ERROR: ${f.error.split('\n')[0]} |`); continue; }
    for (const t of f.turns) lines.push(`| ${f.id} | ${t.id} | ${t.before.f2p_suite ? `${t.after.hidden_tests}/${t.after.hidden_tests} (no compila)` : `${t.before.f2p.length}/${t.after.hidden_tests}`} | ${t.checks.tests_pasan_despues ? 'sí' : 'NO'} | ${t.checks.suite_sin_regresiones ? 'sí' : 'NO'} | ${t.checks.estable ? 'sí' : 'NO'} | ${t.ok ? 'OK' : 'FALLA'} |`);
  }
  await fs.writeFile(path.join(out, 'resumen.md'), `# Calibración de familias semi-reales — ${new Date().toISOString()}\n\n${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  const ok = all.filter((f) => f.ok).length;
  console.log(`\n${ok} de ${all.length} familias calibradas correctamente.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
