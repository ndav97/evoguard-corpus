// Auditoría de una familia semi-real (Paso 8). Uso: npm run corpus:audit -- Sxxx [--freeze] [--runs N]
// Para cada referencia V1–V3, en contenedores nuevos desde la imagen verificada de la familia:
//  1. reconstruye su historia (V0 + referencias) y comprueba cada hash;
//  2. repite la suite visible y el control de alcance del parche;
//  3. ejecuta el oráculo (tests ocultos T1..Tn + suite) N veces (policy.oracle_stability_runs) y exige PASS idéntico;
//  4. comprueba registros (summary ACCEPTED, generation.json válidos) y ausencia de fugas en la historia visible.
// Con --freeze y todo PASS: generation.status FROZEN y evidencia en docs/verification/sxxx-audit.json.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { schemaValidators, validateRecord } from '../validation/corpus.mjs';
import { loadRealFamily, validateRealFamily, realVersions } from './families.mjs';
import { readBases } from './prepare.mjs';
import { openReal, closeReal, execReal } from './docker.mjs';
import { applySteps, realSteps, loadRealReference } from './lineage.mjs';
import { runRealOracle, scopeCheck, TEST_FILE } from './pipeline.mjs';
import { runSuiteIn, failing, knownFailures } from './suite.mjs';
import { realReferencesDir, hiddenTestsOf } from './generate.mjs';

const LEAK = /(evoguard|oracle|hidden[_ -]?tests?|reference\.patch|calibra|evaluator\/runs|PRIVATE_|(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{16,}|SYNTEROLINK|openai|anthropic|gemini|qwen|granite|local_a|local_b)/i;
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

export async function auditReal(root, familyId, { freeze = false, runs } = {}) {
  const data = loadRealFamily(root, familyId);
  const errors = validateRealFamily(data, root);
  if (errors.length) throw new Error('Familia inválida:\n' + errors.join('\n'));
  const m = data.manifest;
  const base = readBases(root).bases[familyId];
  if (!base || base.status !== 'VERIFIED') throw new Error(`${familyId}: sin imagen verificada`);
  const stabilityRuns = runs ?? data.policy.oracle_stability_runs;
  const validators = schemaValidators(root);
  const referencesDir = realReferencesDir(root, data);
  const known = knownFailures(m.known_failures);
  const report = { artifact_type: 'corpus_audit', family_id: familyId, stratum: 'semi-real', image_id: base.image_id, v0_commit: m.v0.commit, started_at: new Date().toISOString(), stability_runs: stabilityRuns, versions: {}, findings: [] };
  const finding = (version, message) => report.findings.push({ version, message });
  for (const version of realVersions(m)) {
    const entry = report.versions[version] = { reference: m.generation.references[version] };
    if (!entry.reference) { finding(version, 'sin referencia'); continue; }
    const { reference, patch } = loadRealReference(referencesDir, version);
    if (reference.candidate_commit !== entry.reference) finding(version, 'reference.json no coincide con family.yaml');
    const taskDir = join(root, reference.logs_path);
    const summary = existsSync(join(taskDir, 'summary.json')) ? JSON.parse(readFileSync(join(taskDir, 'summary.json'), 'utf8')) : null;
    if (!summary || summary.status !== 'ACCEPTED' || summary.accepted !== reference.attempt) finding(version, 'summary de la tarea no coincide con la referencia');
    for (const attempt of existsSync(join(taskDir, 'attempts')) ? readdirSync(join(taskDir, 'attempts')) : []) {
      const record = JSON.parse(readFileSync(join(taskDir, 'attempts', attempt, 'generation.json'), 'utf8'));
      if (validateRecord(record, 'generation', validators).length) finding(version, `${attempt}: generation.json inválido`);
    }
    entry.attempts = summary?.attempts?.length ?? null;
    // Historia, alcance, suite visible y fugas en un contenedor nuevo.
    const session = openReal(base.image_id, 'real-sandbox');
    try {
      const before = realSteps(version, referencesDir);
      applySteps(session, before, { v0Commit: base.v0_repo_commit });
      const existingTests = new Set(execReal(session, ['git', 'ls-files', '-z'], { raw: true }).split('\0').filter(p => TEST_FILE.test(p)));
      const violations = scopeCheck(patch, { manifest: m, existingTests });
      entry.scope = violations.length ? violations : 'PASS';
      if (violations.length) finding(version, 'alcance: ' + violations.map(v => v.detail).join('; '));
      const head = applySteps(session, realSteps(version, referencesDir, { through: true }).slice(before.length));
      entry.history_reproducible = head === reference.candidate_commit;
      if (!entry.history_reproducible) finding(version, 'la historia reconstruida no reproduce el commit de la referencia');
      const visible = execReal(session, ['git', 'log', '-p', '--format=%H %s', `${base.v0_repo_commit}..HEAD`], { raw: true, timeout: 120000 });
      if (LEAK.test(visible)) finding(version, `posible fuga en la historia visible: ${visible.match(LEAK)[0]}`);
      const suite = await runSuiteIn(session, m);
      const bad = suite.run ? [...suite.run.suiteFailedFiles.filter(f => !known.has(f)), ...failing(suite.run, k => !known.has(k))] : [suite.error];
      entry.visible_suite = { total: suite.run?.total ?? null, problems: bad.length, seconds: Math.round(suite.ms / 1000) };
      if (bad.length) finding(version, `suite visible con ${bad.length} problemas`);
    } finally { closeReal(session); }
    const oracle = await runRealOracle({ image: base.image_id, manifest: m, steps: realSteps(version, referencesDir, { through: true }), v0Commit: base.v0_repo_commit, patch: '', hiddenTests: hiddenTestsOf(data), version, runs: stabilityRuns });
    entry.oracle = { status: oracle.status, stable: oracle.stable, runs: oracle.runs.map(r => ({ status: r.status ?? r.error, total: r.total, seconds: r.seconds, hidden: r.hidden })) };
    if (oracle.status !== 'PASS') finding(version, `oráculo ${oracle.status}${oracle.stable ? '' : ' (inestable)'}`);
    log(`${familyId} ${version}: auditada (${oracle.status}, ${stabilityRuns} ejecuciones)`);
  }
  report.status = report.findings.length ? 'FAIL' : 'PASS';
  report.finished_at = new Date().toISOString();
  const text = JSON.stringify(report, null, 2) + '\n';
  const evidencePath = `docs/verification/${familyId.toLowerCase()}-audit.json`;
  writeFileSync(join(root, evidencePath), text);
  if (freeze && report.status === 'PASS') {
    const path = join(root, data.familyDir, 'family.yaml');
    const doc = YAML.parseDocument(readFileSync(path, 'utf8'));
    doc.setIn(['generation', 'status'], 'FROZEN');
    doc.setIn(['generation', 'audit'], { status: 'PASSED', reviewer: 'Claude — auditoría automatizada del pipeline (npm run corpus:audit)', evidence: [evidencePath, `sha256:${createHash('sha256').update(text).digest('hex')}`] });
    writeFileSync(path, String(doc));
    const after = validateRealFamily(loadRealFamily(root, familyId), root);
    if (after.length) throw new Error('Familia inconsistente tras congelar:\n' + after.join('\n'));
    report.frozen = true;
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const familyId = args.find(a => /^S\d{3}$/.test(a));
  const runsIndex = args.indexOf('--runs');
  if (!familyId) { console.error('Uso: npm run corpus:audit -- Sxxx [--freeze] [--runs N]'); process.exit(1); }
  auditReal(root, familyId, { freeze: args.includes('--freeze'), runs: runsIndex >= 0 ? Number(args[runsIndex + 1]) : undefined }).then(report => {
    console.log(`Auditoría ${familyId} ${report.status}${report.frozen ? ` — ${familyId} congelada (FROZEN)` : ''}`);
    for (const f of report.findings) console.log(`- ${f.version ?? familyId}: ${f.message}`);
    if (report.status !== 'PASS') process.exitCode = 1;
    else if (report.frozen) execFileSync('git', ['add', `docs/verification/${familyId.toLowerCase()}-audit.json`, loadRealFamily(root, familyId).familyDir], { cwd: root });
  }).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
