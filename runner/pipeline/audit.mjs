// Auditoría del episodio de una familia (Paso 8). Uso: npm run corpus:audit -- [Fxxx] [--freeze]   (sin familia: F001)
// Para cada referencia V0–V3, en contenedores nuevos y aislados:
//  1. reconstruye su historia desde el scaffold y comprueba el hash del commit registrado;
//  2. repite typecheck, build y pruebas de desarrollo con los comandos fijos del pipeline;
//  3. ejecuta el oráculo de su versión N veces (policy.oracle_stability_runs) y exige PASS idéntico;
//  4. repite el control de arquitectura;
//  5. comprueba registros (summary ACCEPTED coherente, generation.json válidos) y ausencia de fugas
//     (oráculo, procedencia, secretos, requisitos futuros) en la historia visible del workspace.
// Con --freeze y todo PASS: provenance.audit PASSED, family AUDITED → FROZEN y stack.experimental_frozen.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadCorpus, validateCorpus, schemaValidators, validateRecord } from '../validation/corpus.mjs';
import { evolutionSeed, loadReference } from '../sandbox/lineage.mjs';
import { openSandbox, closeSandbox } from '../sandbox/docker.mjs';
import { readContainerLock } from '../sandbox/lock.mjs';
import { workspaceOps } from './workspace.mjs';
import { VISIBLE_COMMANDS, architectureBaseline } from './evaluator.mjs';
import { checkArchitecture } from './architecture.mjs';
import { runOracleInContainer } from '../oracle/container.mjs';
import { CORPUS_REFERENCES } from './store.mjs';

const VERSIONS = ['V0', 'V1', 'V2', 'V3'];
const LEAK = /(spec-lock|plans\.mjs|runner\/oracle|oracle\/F\d{3}|evaluator\/runs|PRIVATE_|"observed"|"checks"|sk-[A-Za-z0-9_-]{16,}|SYNTEROLINK|openai|anthropic|gemini|qwen|granite|local_a|local_b)/i;
const FUTURE = { V0: /R00[345]|T00[123]/, V1: /R00[45]|T00[23]/, V2: /R005|T003/, V3: null };
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

export async function auditCorpus(root, { familyId = 'F001', freeze = false, runs } = {}) {
  const data = loadCorpus(root, familyId);
  const dir = data.familyDir;
  const errors = validateCorpus(data, root);
  if (errors.length) throw new Error('Corpus inválido:\n' + errors.join('\n'));
  const lock = readContainerLock(root);
  const stabilityRuns = runs ?? data.policy.oracle_stability_runs;
  const baseline = architectureBaseline(root, familyId);
  const validators = schemaValidators(root);
  const referencesDir = CORPUS_REFERENCES(root, familyId);
  const report = { artifact_type: 'corpus_audit', family_id: familyId, image_id: lock.image_id, started_at: new Date().toISOString(), stability_runs: stabilityRuns, versions: {}, findings: [] };
  const finding = (version, message) => report.findings.push({ version, message });

  for (const version of VERSIONS) {
    const entry = report.versions[version] = { reference: data.family.reference_versions[version] };
    if (!entry.reference) { finding(version, 'sin referencia'); continue; }
    const { reference } = loadReference(referencesDir, version);
    // Registros de la tarea que produjo la referencia.
    const taskDir = join(root, reference.logs_path);
    const summary = existsSync(join(taskDir, 'summary.json')) ? JSON.parse(readFileSync(join(taskDir, 'summary.json'), 'utf8')) : null;
    if (!summary || summary.status !== 'ACCEPTED' || summary.accepted !== reference.attempt) finding(version, 'summary de la tarea no coincide con la referencia');
    for (const attempt of existsSync(join(taskDir, 'attempts')) ? readdirSync(join(taskDir, 'attempts')) : []) {
      const record = JSON.parse(readFileSync(join(taskDir, 'attempts', attempt, 'generation.json'), 'utf8'));
      const problems = validateRecord(record, 'generation', validators);
      if (problems.length) finding(version, `${attempt}: generation.json inválido`);
    }
    entry.attempts = summary?.attempts?.length ?? null;
    // Reconstrucción y verificación en contenedor nuevo.
    const session = openSandbox(root, { seed: evolutionSeed(root, version, referencesDir, { through: true, familyId }) });
    try {
      const ops = workspaceOps(session);
      entry.history_reproducible = session.initialization.baseline_commit === reference.candidate_commit;
      if (!entry.history_reproducible) finding(version, 'la historia reconstruida no reproduce el commit de la referencia');
      const visibleHistory = (await ops.exec(['git', 'log', '--all', '-p', '--format=%H %an %ae %s'], { timeout: 120000 })).output;
      if (LEAK.test(visibleHistory)) finding(version, `posible fuga en la historia visible: ${visibleHistory.match(LEAK)[0]}`);
      if (FUTURE[version] && FUTURE[version].test(visibleHistory)) finding(version, 'la historia visible menciona requisitos o turnos futuros');
      entry.visible_checks = {};
      for (const [stage, argv] of Object.entries(VISIBLE_COMMANDS)) {
        const outcome = await ops.exec(argv, { timeout: 600000 });
        entry.visible_checks[stage] = outcome.status;
        if (outcome.status !== 'PASS') finding(version, `${stage}: ${outcome.status}`);
      }
      const files = await ops.exportTree('.');
      const architecture = checkArchitecture(files ?? {}, baseline);
      entry.architecture = { status: architecture.status, violations: architecture.violations, metrics: architecture.metrics };
      if (architecture.status !== 'PASS') finding(version, 'arquitectura: ' + architecture.violations.map(v => v.detail).join('; '));
      const dist = await ops.exportTree('dist', { exclude: [] });
      entry.oracle_runs = [];
      for (let run = 0; run < stabilityRuns; run++) {
        const result = runOracleInContainer(root, version, dist, { familyId });
        entry.oracle_runs.push({ status: result.status, passed: result.passed, total: result.total, failing: result.results.filter(r => r.status !== 'PASS').map(r => r.id) });
        log(`  ${version} oráculo ${run + 1}/${stabilityRuns}: ${result.passed}/${result.total}`);
      }
      const signature = JSON.stringify(entry.oracle_runs.map(r => [r.status, r.failing]));
      entry.oracle_stable = entry.oracle_runs.every(r => JSON.stringify([r.status, r.failing]) === JSON.stringify([entry.oracle_runs[0].status, entry.oracle_runs[0].failing]));
      if (!entry.oracle_stable || entry.oracle_runs.some(r => r.status !== 'PASS')) finding(version, `oráculo no estable o no aprobado: ${signature}`);
    } finally { closeSandbox(session.name, session.image); }
    log(`${version}: auditada`);
  }
  report.turns_complete = data.turns.every(turn => turn.reference_commit && turn.patch_path);
  if (!report.turns_complete) finding(null, 'turnos sin referencia registrada');
  if (data.provenance.authorship.human_functional_corrections !== false) finding(null, 'correcciones humanas declaradas');
  report.status = report.findings.length ? 'FAIL' : 'PASS';
  report.finished_at = new Date().toISOString();
  const text = JSON.stringify(report, null, 2) + '\n';
  const evidencePath = `docs/verification/${familyId.toLowerCase()}-audit.json`;
  writeFileSync(join(root, evidencePath), text);
  if (freeze && report.status === 'PASS') {
    const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
    const write = (path, value) => writeFileSync(join(root, path), JSON.stringify(value, null, 2) + '\n');
    const provenance = read(`${dir}/provenance.yaml`);
    provenance.audit = { status: 'PASSED', reviewer: 'Claude — auditoría automatizada del pipeline (npm run corpus:audit)', evidence: [evidencePath, `sha256:${createHash('sha256').update(text).digest('hex')}`] };
    if (familyId === 'F001') provenance.similarity_review.status = 'NOT_APPLICABLE_SINGLE_FAMILY';
    write(`${dir}/provenance.yaml`, provenance);
    const family = read(`${dir}/family.yaml`);
    family.status = 'FROZEN';
    write(`${dir}/family.yaml`, family);
    const stack = read('config/stack.json');
    stack.experimental_frozen = true;
    write('config/stack.json', stack);
    const after = validateCorpus(loadCorpus(root, familyId), root);
    if (after.length) throw new Error('Corpus inconsistente tras congelar:\n' + after.join('\n'));
    report.frozen = true;
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const familyId = /^F\d{3}$/.test(args[0] ?? '') ? args.shift() : 'F001';
  if (args.some(flag => flag !== '--freeze')) { console.error('Uso: npm run corpus:audit -- [Fxxx] [--freeze]'); process.exit(1); }
  auditCorpus(root, { familyId, freeze: args.includes('--freeze') }).then(report => {
    console.log(`Auditoría ${familyId} ${report.status}${report.frozen ? ` — ${familyId} congelada (FROZEN)` : ''}`);
    for (const f of report.findings) console.log(`- ${f.version ?? familyId}: ${f.message}`);
    if (report.status !== 'PASS') process.exitCode = 1;
    else if (report.frozen) execFileSync('git', ['add', `docs/verification/${familyId.toLowerCase()}-audit.json`, loadCorpus(root, familyId).familyDir, 'config/stack.json'], { cwd: root });
  }).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
