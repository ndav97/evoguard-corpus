// Pipeline (Paso 5) sin Docker: arquitectura, evaluador, persistencia, linaje y modos del motor.
// La integración con contenedores reales se comprueba con `npm run pipeline:rehearse`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkArchitecture } from '../runner/pipeline/architecture.mjs';
import { createPipelineEvaluator, architectureBaseline, VISIBLE_COMMANDS } from '../runner/pipeline/evaluator.mjs';
import { createTaskStore, saveReference } from '../runner/pipeline/store.mjs';
import { auditPatch, evolutionSeed, loadReference } from '../runner/sandbox/lineage.mjs';
import { runTask } from '../runner/execution/engine.mjs';
import { loadCorpus } from '../runner/validation/corpus.mjs';
import { makePacket } from '../runner/packet.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = architectureBaseline(root);
const rehearsal = name => readFileSync(join(root, 'tests/fixtures/rehearsal', name));
const policy = JSON.parse(readFileSync(join(root, 'config/policy.json'), 'utf8'));
const data = loadCorpus(root);

function candidateTree(app = 'App.tsx', catalog = 'catalog.ts') {
  return {
    'package.json': Buffer.from(baseline.packageJson),
    'package-lock.json': Buffer.from(baseline.packageLock),
    'fixtures/products.json': readFileSync(join(root, 'families/F001-product-catalog/fixtures/products.json')),
    'src/App.tsx': rehearsal(app),
    'src/catalog.ts': rehearsal(catalog),
    'src/catalog.test.ts': rehearsal('catalog.test.ts'),
    'src/main.tsx': readFileSync(join(root, 'templates/react-vite/src/main.tsx'))
  };
}

test('arquitectura: acepta useState centralizado con el fixture importado', () => {
  const result = checkArchitecture(candidateTree(), baseline);
  assert.equal(result.status, 'PASS', JSON.stringify(result.violations));
  assert.ok(result.metrics.components_estimate >= 1);
});

test('arquitectura: rechaza efectos, persistencia, red, dependencias nuevas y fixture alterado', () => {
  assert.match(JSON.stringify(checkArchitecture(candidateTree('App-effect.tsx'), baseline).violations), /useEffect/);
  const tree = candidateTree();
  tree['src/store.ts'] = Buffer.from("import { create } from 'zustand';\nexport const save = (v: string) => localStorage.setItem('k', v);\nexport const load = () => fetch('/api');\n");
  const packageJson = JSON.parse(baseline.packageJson); packageJson.dependencies = { ...packageJson.dependencies, zustand: '5.0.0' };
  tree['package.json'] = Buffer.from(JSON.stringify(packageJson));
  tree['fixtures/products.json'] = Buffer.from('[]');
  const text = JSON.stringify(checkArchitecture(tree, baseline).violations);
  for (const expected of ['zustand', 'localStorage', 'fetch', 'dependencias', 'fixture']) assert.match(text, new RegExp(expected));
});

test('arquitectura: las pruebas pueden importar vitest y los comentarios no cuentan como uso', () => {
  const tree = candidateTree();
  tree['src/App.tsx'] = Buffer.from(rehearsal('App.tsx').toString() + '\n// antes usábamos useEffect aquí\n/* localStorage no */\n');
  assert.equal(checkArchitecture(tree, baseline).status, 'PASS');
});

function fakeWorkspace({ outputs = {}, dist = { 'index.html': Buffer.from('<p>x</p>') }, tree = candidateTree() } = {}) {
  return {
    async exec(argv) { return outputs[argv.join(' ')] ?? { status: 'PASS', output: 'ok' }; },
    async exportTree(directory) { return directory === 'dist' ? dist : tree; }
  };
}

test('evaluador: feedback visible solo en etapas técnicas; oráculo y arquitectura solo en el canal privado', async () => {
  const sink = [];
  const evaluator = createPipelineEvaluator({ root, version: 'V0', privateSink: r => sink.push(r), oracle: () => ({ status: 'FAIL', results: [{ id: 'R001-A05', status: 'FAIL', checks: [{ observed: ['P022'] }] }] }) });
  const ws = fakeWorkspace({ outputs: { [VISIBLE_COMMANDS.typecheck.join(' ')]: { status: 'FAIL', output: 'TS2322' } } });
  const typecheck = await evaluator.check('typecheck', ws);
  assert.equal(typecheck.status, 'FAIL');
  assert.match(typecheck.feedback, /TS2322/);
  assert.deepEqual(await evaluator.check('independent_oracle', ws), { status: 'FAIL' });
  assert.deepEqual(await evaluator.check('architecture', fakeWorkspace({ tree: candidateTree('App-effect.tsx') })), { status: 'FAIL' });
  assert.match(JSON.stringify(sink), /R001-A05/);
  assert.match(JSON.stringify(sink), /useEffect/);
});

test('evaluador: sin build es FAIL del candidato; un fallo del oráculo es INFRA_ERROR', async () => {
  const sink = [];
  const broken = createPipelineEvaluator({ root, version: 'V0', privateSink: r => sink.push(r), oracle: () => { throw new Error('docker caído'); } });
  assert.deepEqual(await broken.check('independent_oracle', fakeWorkspace({ dist: null })), { status: 'FAIL' });
  assert.deepEqual(await broken.check('independent_oracle', fakeWorkspace()), { status: 'INFRA_ERROR' });
  assert.match(JSON.stringify(sink), /docker caído/);
});

test('linaje: auditoría rechaza rutas del pipeline, secretos y enlaces', () => {
  const ok = 'diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-a\n+b\n';
  assert.ok(auditPatch(ok));
  assert.throws(() => auditPatch(ok.replaceAll('src/App.tsx', 'TASK.json')), /ruta no permitida/);
  assert.throws(() => auditPatch(ok.replaceAll('src/App.tsx', 'fixtures/products.json')), /ruta no permitida/);
  assert.throws(() => auditPatch(ok + '+const k = "sk-abcdefghijklmnopqrstuvwxyz";\n'), /secreto/);
  assert.throws(() => auditPatch('diff --git a/src/l b/src/l\nnew file mode 120000\n'), /enlace/);
});

test('linaje: V1 se construye desde la referencia V0 y detecta alteraciones', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evoguard-refs-'));
  try {
    const patch = 'diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-a\n+b\n';
    const task = JSON.stringify(makePacket(data, 'V0'), null, 2) + '\n';
    const record = { outcome: 'ACCEPTED', candidate_commit: 'c'.repeat(40), base_commit: 'b'.repeat(40), id: '04-google-a1', generator: { provider: 'google' }, finished_at: 'x' };
    saveReference(root, dir, { version: 'V0', record, patch, taskText: task, taskDir: join(root, '.artifacts') });
    assert.throws(() => saveReference(root, dir, { version: 'V0', record, patch, taskText: task, taskDir: root }), /ya existe/);
    const seed = evolutionSeed(root, 'V1', dir);
    assert.equal(seed.files['TASK.json'], task);
    assert.deepEqual(seed.steps.map(s => s.type), ['expect', 'patch', 'task']);
    assert.equal(seed.steps[1].expect, 'c'.repeat(40));
    assert.equal(JSON.parse(seed.task).version, 'V1');
    assert.doesNotMatch(JSON.stringify(seed), /R004|R005|google|04-google/);
    assert.throws(() => evolutionSeed(root, 'V2', dir), /Falta la referencia validada V1/);
    writeFileSync(join(dir, 'V0', 'reference.patch'), patch + '+x\n');
    assert.throws(() => loadReference(dir, 'V0'), /alterado/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function harness(mode, extra = {}) {
  return {
    mode, policy, initialProvider: 'openai', packet: makePacket(data, 'V0'),
    adapter: { async next(ctx) { return ctx.cycle === 1 ? { type: 'tool', argv: ['x'] } : { type: 'deliver' }; } },
    evaluator: { async check() { return { status: 'PASS' }; } },
    workspaces: { async open() { return { initialization: { baseline_commit: 'a'.repeat(40) }, async exec() { return { status: 'PASS', output: '' }; }, async snapshot() { return 'diff'; }, async commit() { return 'd'.repeat(40); }, async close() {} }; } },
    ...extra
  };
}

test('motor: experimental exige preflight vacío; rehearsal acepta y registra commits', async () => {
  await assert.rejects(runTask(harness('experimental')), /preflight/);
  await assert.rejects(runTask(harness('experimental', { preflightBlockers: ['x'] })), /preflight/);
  await assert.rejects(runTask(harness('rehearsal', { simulationTimeoutMs: 10 })), /solo en simulación/);
  const result = await runTask(harness('rehearsal'));
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.artifact_type, 'pipeline_rehearsal');
  assert.equal(result.attempts[0].base_commit, 'a'.repeat(40));
  assert.equal(result.attempts[0].candidate_commit, 'd'.repeat(40));
  const simulated = await runTask(harness('simulation'));
  assert.equal(simulated.status, 'SIMULATED_ACCEPTED');
  assert.equal(simulated.attempts[0].candidate_commit, null);
});

test('persistencia: registros por intento válidos, sin sobrescritura y con canal privado separado', async () => {
  {
    const store = createTaskStore(root, { mode: 'rehearsal', version: 'V0', taskId: `test-${process.pid}-${Date.now()}` });
    try {
      store.track({ provider: 'openai', attempt: 1, cycle: 1 });
      store.call({ observed_model: 'm', tokens: { input: 10, output: 2 } });
      store.private({ stage: 'independent_oracle', report: { secret_detail: 'R001-A05' } });
      const result = await runTask(harness('rehearsal'));
      const { summary, records } = store.finalize(result, { packet: makePacket(data, 'V0'), models: null, stackText: '{}', fixtureSha256: data.family.fixture.sha256 });
      assert.equal(summary.status, 'ACCEPTED');
      assert.deepEqual(records[0].tokens, { input: 10, output: 2 });
      assert.ok(existsSync(join(store.dir, 'attempts', records[0].id, 'generation.json')));
      assert.doesNotMatch(readFileSync(join(store.dir, 'summary.json'), 'utf8'), /R001-A05/);
      assert.match(readFileSync(join(store.privateDir, 'evaluator.jsonl'), 'utf8'), /R001-A05/);
      assert.throws(() => store.event({ leaked: 'sk-abcdefghijklmnopqrstuvwxyz' }), /secreto/);
    } finally { rmSync(store.dir, { recursive: true, force: true }); }
  }
});

test('el prompt común declara los comandos visibles exactos del pipeline', () => {
  const common = readFileSync(join(root, 'prompts/common.md'), 'utf8');
  for (const argv of Object.values(VISIBLE_COMMANDS)) assert.ok(common.includes(argv.join(' ')), argv.join(' '));
});
