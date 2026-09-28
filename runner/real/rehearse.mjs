// Ensayo instrumental del pipeline semi-real (R3/R4): contenedores, evaluación, oráculo, alcance y linaje reales;
// el «constructor» es un guion que aplica los parches de referencia de calibración (nunca modelos).
// Uso:
//   npm run real:rehearse -- --mini     familia de prueba S900 (tests/fixtures/real-mini) sobre la imagen del
//                                       runtime; no necesita red. Deja docs/verification/real-pipeline-rehearsal.json.
//   npm run real:rehearse -- Sxxx       familia real con imagen VERIFIED (npm run real:prepare). Deja
//                                       docs/verification/real-rehearsal-sxxx.json.
// Guion por versión:
//   V1: 1.er proveedor borra un test existente además de aplicar el cambio → oráculo PASS, alcance FAIL (REASSIGN);
//       2.º entrega sin cambios → oráculo FAIL (REASSIGN, sin feedback);
//       3.º intenta escribir un test existente (bloqueado), rompe el archivo de la zona del cambio → tests FAIL
//       (REPAIR con feedback visible) y en el intento 2 aplica la referencia → ACCEPTED.
//   V2 y V3: el proveedor del plan aplica la referencia → ACCEPTED, sobre la historia reconstruida por hash.
// Al final: oráculo de V3 dos veces (estabilidad) y comprobación de que no quedan contenedores.
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runTask } from '../execution/engine.mjs';
import { createTaskStore, saveReference } from '../pipeline/store.mjs';
import { docker } from '../sandbox/docker.mjs';
import { loadRealFamily, validateRealFamily, makeRealPacket, REAL_VERSIONS, TURN_OF, inPackage } from './families.mjs';
import { prepare, readBases } from './prepare.mjs';
import { realWorkspaces, createRealEvaluator, runRealOracle, TEST_FILE } from './pipeline.mjs';
import { realSteps } from './lineage.mjs';
import { realFingerprint } from './sources.mjs';
import { generateReal } from './generate.mjs';
import { auditReal } from './audit.mjs';
import { execFileSync } from 'node:child_process';

const RUNTIME_IMAGE = 'sha256:3ed948d6314561f36a6d7e0cc5b27f32098fa40fe11b3cb2afb927a187f11f95';
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const sha = text => createHash('sha256').update(text).digest('hex');
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

// Borra un test existente «normal» del paquete: un archivo de test bajo src/ que no sea configuración ni tenga
// instantáneas (borrar una instantánea o la configuración de tests rompería la suite y no probaría el alcance).
const DELETE_TEST = m => `f=$(git ls-files ${m.package_path === '.' ? '' : `'${m.package_path}/'`} | grep -E '(^|/)src/.*\\.(test|spec)\\.[cm]?[jt]sx?$' | grep -vi config | while read t; do b=$(basename "$t"); git ls-files | grep -q "__snapshots__/$b.snap" && continue; echo "$t"; break; done); test -n "$f" && git rm -q "$f" && echo "borrado $f"`;

function scriptedAdapter(data, version, store, seen) {
  const m = data.manifest;
  const turn = data.turns.find(t => t.id === TURN_OF[version]);
  const dir = m.package_path === '.' ? '' : ` --directory='${m.package_path}'`;
  const apply = { type: 'tool', argv: ['sh', '-c', `git apply${dir} --whitespace=nowarn - <<'EVOGUARD_PATCH'\n${turn.patchText.replace(/\n+$/, '')}\nEVOGUARD_PATCH`] };
  const inspect = [{ type: 'list_files', path: m.package_path === '.' ? '' : m.package_path }, { type: 'read_file', path: m.focus }];
  const scenario = version === 'V1';
  return {
    async next(context) {
      store.track(context);
      seen.push(JSON.stringify(context));
      const position = REAL_VERSIONS.indexOf(version);
      const plan = m.generation.plan;
      const ring = ['openai', 'anthropic', 'google', 'local_a', 'local_b'];
      const order = ring.indexOf(context.provider) - ring.indexOf(plan[version]);
      const assignment = (order + 5) % 5; // 0 = proveedor del plan
      let steps;
      if (!scenario || position !== 0) steps = [...inspect, apply, { type: 'run_checks' }, { type: 'deliver' }];
      else if (assignment === 0) steps = [...inspect, apply, { type: 'tool', argv: ['sh', '-c', DELETE_TEST(m)] }, { type: 'deliver' }];
      else if (assignment === 1) steps = [...inspect, { type: 'deliver' }];
      else if (assignment === 2 && context.attempt === 1) steps = [...inspect, { type: 'write_file', path: '__EXISTING_TEST__', content: '// no\n' }, { type: 'tool', argv: ['sh', '-c', `printf '\\n)))) syntax error\\n' >> '${m.focus}'`] }, { type: 'deliver' }];
      else if (assignment === 2) steps = [{ type: 'tool', argv: ['git', 'checkout', '--', m.focus] }, apply, { type: 'run_checks' }, { type: 'deliver' }];
      else steps = [{ type: 'technical_failure' }];
      const step = steps[Math.min(context.cycle, steps.length) - 1];
      if (step.path === '__EXISTING_TEST__') {
        // Primer test existente del paquete, tomado del listado que ve el constructor.
        const overview = context.messages.find(message => message.content?.source === 'workspace')?.content?.overview;
        return { ...step, path: overview.files.find(path => TEST_FILE.test(path)) ?? `${m.package_path === '.' ? '' : `${m.package_path}/`}package.json` };
      }
      return step;
    }
  };
}

async function rehearseVersion({ root, data, base, version, referencesDir, stepsFor }) {
  const m = data.manifest;
  const packet = makeRealPacket(data, version);
  const store = createTaskStore(root, { mode: 'rehearsal', familyId: m.id, version });
  const steps = stepsFor(version);
  const hiddenTests = data.turns.map(t => ({ id: t.id, file: basename(t.hidden_tests), text: t.hiddenTestsText }));
  const opened = [], closed = [], seen = [];
  log(`${m.id} ${version}: tarea ${store.taskId}`);
  const result = await runTask({
    mode: 'rehearsal', packet: { ...packet, version }, policy: data.policy, initialProvider: m.generation.plan[version],
    adapter: scriptedAdapter(data, version, store, seen),
    workspaces: realWorkspaces({ image: base.image_id, manifest: m, steps, v0Commit: base.v0_repo_commit, onOpen: s => opened.push(s.name), onClose: s => closed.push(s.name) }),
    evaluator: createRealEvaluator({ image: base.image_id, manifest: m, steps, v0Commit: base.v0_repo_commit, version, hiddenTests, privateSink: record => store.private(record) }),
    emit: event => {
      store.event(event);
      if (event.type === 'evaluation') log(`  ${event.provider} a${event.attempt} ${event.stage}: ${event.status}`);
      if (event.type === 'attempt_finished') log(`  ${event.provider} a${event.attempt}: ${event.outcome}${event.reason ? ` (${event.reason})` : ''}`);
    }
  });
  const { summary, records } = store.finalize(result, { packet, models: null, stackText: JSON.stringify(base), fixtureSha256: base.image_id.slice(7) });
  assert.equal(result.status, 'ACCEPTED', `${version}: ${JSON.stringify(summary.attempts)}`);
  assert.deepEqual([...closed].sort(), [...opened].sort(), 'workspaces sin cerrar');
  const accepted = records.find(r => r.outcome === 'ACCEPTED');
  const patch = readFileSync(join(store.dir, 'attempts', accepted.id, 'patch.diff'), 'utf8');
  const reference = saveReference(root, referencesDir, { version, record: accepted, patch, taskText: JSON.stringify(packet, null, 2) + '\n', taskDir: store.dir, familyId: m.id });
  return { store, records, seen, reference, summary };
}

export async function rehearseReal(root, familyId, { base: baseOverride } = {}) {
  const data = loadRealFamily(root, familyId);
  assert.deepEqual(validateRealFamily(data, root), []);
  const base = baseOverride ?? readBases(root).bases[familyId];
  if (!base || base.status !== 'VERIFIED') throw new Error(`${familyId}: sin imagen verificada; ejecutar npm run real:prepare -- ${familyId}`);
  docker(['image', 'inspect', base.image_id]);
  const referencesDir = join(root, '.artifacts/real/rehearsal-references', `${familyId}-${Date.now()}`);
  const stepsFor = version => realSteps(version, referencesDir);
  const report = { artifact_type: 'real_pipeline_rehearsal', family_id: familyId, image_id: base.image_id, experimental: false, started_at: new Date().toISOString(), versions: {} };
  for (const version of REAL_VERSIONS) {
    const { records, seen, reference, store } = await rehearseVersion({ root, data, base, version, referencesDir, stepsFor });
    report.versions[version] = { task_id: store.taskId, outcomes: records.map(r => ({ provider: r.generator.provider, attempt: r.attempt, outcome: r.outcome, reason: r.failure_reason, validation: r.validation })), candidate_commit: reference.candidate_commit };
    const privateLog = readFileSync(join(store.privateDir, 'evaluator.jsonl'), 'utf8');
    const visible = seen.join('\n');
    // El constructor nunca ve tests ocultos, informes del oráculo ni violaciones de alcance.
    for (const turn of data.turns) assert.ok(!visible.includes(basename(turn.hidden_tests)), 'nombre de test oculto visible');
    assert.doesNotMatch(visible, /"violations"|"hidden"|suite_failing|evoguard-report/);
    if (version === 'V1') {
      const outcomes = records.map(r => [r.attempt, r.outcome, r.failure_reason]);
      assert.deepEqual(outcomes, [[1, 'REASSIGN', 'architecture'], [1, 'REASSIGN', 'independent_oracle'], [1, 'REPAIR', 'development_tests'], [2, 'ACCEPTED', null]]);
      assert.equal(records[0].validation.independent_oracle, 'PASS', 'borrar un test no lo detecta el oráculo, sí el alcance');
      assert.match(privateLog, /tests existentes/);
      assert.match(visible, /ruta protegida/, 'la escritura sobre un test existente se bloquea con mensaje visible');
      assert.match(visible, /problemas/, 'el feedback de la suite es visible para reparar');
      assert.equal(records[3].validation.build, 'NOT_APPLICABLE');
      const first = JSON.parse(seen[0]);
      assert.equal(first.messages[0].content.source, 'workspace');
      assert.ok(first.messages[0].content.overview.contents[data.manifest.focus], 'la vista inicial incluye la zona del cambio');
    } else {
      assert.deepEqual(records.map(r => r.outcome), ['ACCEPTED']);
      assert.equal(records[0].base_commit, report.versions[REAL_VERSIONS[REAL_VERSIONS.indexOf(version) - 1]].candidate_commit, 'la base es la referencia anterior reproducida por hash');
    }
    log(`${familyId} ${version}: ACEPTADA (${reference.generator.provider}) ${reference.candidate_commit}`);
  }
  // Estabilidad del oráculo de V3 sobre la historia completa (dos ejecuciones idénticas).
  const hiddenTests = data.turns.map(t => ({ id: t.id, file: basename(t.hidden_tests), text: t.hiddenTestsText }));
  const final = await runRealOracle({ image: base.image_id, manifest: data.manifest, steps: realSteps('V3', referencesDir, { through: true }), v0Commit: base.v0_repo_commit, patch: '', hiddenTests, version: 'V3', runs: 2 });
  assert.equal(final.status, 'PASS', JSON.stringify(final));
  report.v3_oracle_stability = { status: final.status, stable: final.stable, runs: final.runs.map(r => ({ status: r.status, total: r.total, seconds: r.seconds })) };
  assert.equal(docker(['container', 'ls', '--all', '--filter', 'label=org.evoguard.role', '--format', '{{.Names}}']), '', 'contenedores remanentes');
  report.status = 'PASS';
  report.finished_at = new Date().toISOString();
  rmSync(referencesDir, { recursive: true, force: true });
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--mini') {
    // Raíz desechable con la familia de prueba; la imagen se construye sobre el runtime (sin red).
    const root = mkdtempSync(join(repoRoot, '.artifacts', 'real-mini-'));
    try {
      for (const path of ['config', 'prompts', 'schema', 'docker']) cpSync(join(repoRoot, path), join(root, path), { recursive: true });
      mkdirSync(join(root, 'families-real'), { recursive: true });
      cpSync(join(repoRoot, 'tests/fixtures/real-mini/family'), join(root, 'families-real/S900-mini-cart'), { recursive: true });
      const prepared = await prepare(root, 'S900', { base: RUNTIME_IMAGE, source: 'dir', srcDir: join(repoRoot, 'tests/fixtures/real-mini/repo'), // Hook de git que siempre falla (como husky/lefthook instalados por el gestor de paquetes): los commits del
      // pipeline deben ignorarlo.
      installCmd: "ln -s /opt/deps/node_modules node_modules && printf '#!/bin/sh\\nexit 1\\n' > /workspace/repo/.git/hooks/pre-commit && chmod +x /workspace/repo/.git/hooks/pre-commit" });
      assert.equal(prepared.status, 'VERIFIED', JSON.stringify(prepared.checks));
      const report = await rehearseReal(root, 'S900');
      // Generación y auditoría con los comandos reales (constructor instrumental, sin preflight de modelos) en la
      // raíz desechable versionada con git: referencias en families-real/, family.yaml actualizado y FROZEN.
      const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
      git(['init', '-q']); git(['config', 'user.name', 'EvoGuard Rehearsal']); git(['config', 'user.email', 'rehearsal@evoguard.invalid']);
      for (const dir of ['runs/corpus-generation', 'evaluator/runs', 'docs/verification']) mkdirSync(join(root, dir), { recursive: true });
      git(['add', '-A']); git(['commit', '-q', '-m', 'ensayo']);
      const data = loadRealFamily(root, 'S900');
      for (const version of REAL_VERSIONS) {
        const status = await generateReal(root, 'S900', version, { blockers: () => [], adapterFactory: ({ store }) => {
          const turn = loadRealFamily(root, 'S900').turns[REAL_VERSIONS.indexOf(version)];
          return { async next(context) { store.track(context); return [{ type: 'tool', argv: ['sh', '-c', `git apply --directory='app' - <<'EVOGUARD_PATCH'\n${turn.patchText.replace(/\n+$/, '')}\nEVOGUARD_PATCH`] }, { type: 'run_checks' }, { type: 'deliver' }][Math.min(context.cycle, 3) - 1]; } };
        } });
        assert.equal(status, 'ACCEPTED', version);
      }
      const audit = await auditReal(root, 'S900', { freeze: true, runs: 2 });
      assert.equal(audit.status, 'PASS', JSON.stringify(audit.findings));
      const frozen = loadRealFamily(root, 'S900').manifest.generation;
      assert.equal(frozen.status, 'FROZEN');
      assert.ok(REAL_VERSIONS.every(v => /^[a-f0-9]{40}$/.test(frozen.references[v])));
      assert.match(git(['log', '--format=%s']), /corpus: S900 V3 reference generated by/);
      report.generation_and_audit = { status: 'PASS', references: frozen.references, audit: { status: audit.status, stability_runs: audit.stability_runs } };
      log(`S900: generación V1–V3 y auditoría con congelamiento: PASS`);
      report.sources_sha256 = realFingerprint(repoRoot);
      writeFileSync(join(repoRoot, 'docs/verification/real-pipeline-rehearsal.json'), JSON.stringify(report, null, 2) + '\n');
      log('PASS: ensayo del pipeline semi-real (familia de prueba S900) → docs/verification/real-pipeline-rehearsal.json');
      rmSync(root, { recursive: true, force: true });
    } catch (error) {
      log(`Registros del ensayo fallido conservados en ${root}`);
      throw error;
    }
  } else if (/^S\d{3}$/.test(args[0] ?? '')) {
    const report = await rehearseReal(repoRoot, args[0]);
    report.sources_sha256 = realFingerprint(repoRoot);
    writeFileSync(join(repoRoot, `docs/verification/real-rehearsal-${args[0].toLowerCase()}.json`), JSON.stringify(report, null, 2) + '\n');
    log(`PASS: ensayo de ${args[0]} → docs/verification/real-rehearsal-${args[0].toLowerCase()}.json`);
  } else {
    console.error('Uso: npm run real:rehearse -- --mini | Sxxx'); process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
