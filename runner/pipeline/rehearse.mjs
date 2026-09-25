// Ensayo integral instrumental del pipeline (Paso 5): contenedores, evaluación, oráculo aislado y persistencia
// reales; el "constructor" es un guion que escribe candidatos de tests/fixtures/rehearsal/. No llama a modelos,
// no crea referencias del corpus y guarda todo en .artifacts/rehearsals/<uuid>/ con experimental: false.
// Uso: npm run pipeline:rehearse
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTask } from '../execution/engine.mjs';
import { loadCorpus, validateCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';
import { readContainerLock } from '../sandbox/lock.mjs';
import { docker } from '../sandbox/docker.mjs';
import { sandboxWorkspaces } from './workspace.mjs';
import { createPipelineEvaluator } from './evaluator.mjs';
import { createTaskStore, saveReference } from './store.mjs';
import { evolutionSeed, auditPatch } from '../sandbox/lineage.mjs';
import { seedFiles } from '../sandbox/policy.mjs';
import { openSandbox, closeSandbox } from '../sandbox/docker.mjs';
import { workspaceOps } from './workspace.mjs';
import { pipelineFingerprint } from './sources.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = name => readFileSync(join(root, 'tests/fixtures/rehearsal', name), 'utf8');

// Candidato por (proveedor, intento): archivos a escribir en el workspace.
const PLAN = {
  'openai:1': { 'src/App.tsx': 'App-type-error.tsx', 'src/catalog.ts': 'catalog.ts', 'src/catalog.test.ts': 'catalog.test.ts' },
  'openai:2': { 'src/App.tsx': 'App.tsx', 'src/catalog.ts': 'catalog-or-bug.ts' },
  'anthropic:1': { 'src/App.tsx': 'App-effect.tsx', 'src/catalog.ts': 'catalog.ts', 'src/catalog.test.ts': 'catalog.test.ts' },
  'google:1': { 'src/App.tsx': 'App.tsx', 'src/catalog.ts': 'catalog.ts', 'src/catalog.test.ts': 'catalog.test.ts' }
};
const WRITE = "const fs=require('node:fs'),p=require('node:path');const [f,d]=process.argv.slice(1);if(!/^src\\/[A-Za-z.-]+$/.test(f))throw Error('ruta');fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,Buffer.from(d,'base64'));console.log('escrito '+f);";

// Guion con las acciones del protocolo 1.1: list_files y read_file al inicio, write_file por archivo (el primer
// archivo con tool en google para cubrir también el shell), edit_file en anthropic, run_checks antes de entregar.
function scriptedAdapter(store, seen) {
  return {
    async next(context) {
      store.track(context);
      seen.push(JSON.stringify(context));
      const plan = PLAN[`${context.provider}:${context.attempt}`];
      if (!plan) return { type: 'technical_failure' };
      const steps = [{ type: 'list_files', path: '' }, { type: 'read_file', path: 'src/App.tsx' }];
      for (const [index, [path, source]] of Object.entries(plan).entries()) {
        if (context.provider === 'google' && index === 0) steps.push({ type: 'tool', argv: ['node', '-e', WRITE, path, Buffer.from(fixture(source)).toString('base64')] });
        else steps.push({ type: 'write_file', path, content: fixture(source) });
      }
      if (context.provider === 'anthropic') steps.push({ type: 'edit_file', path: 'src/catalog.ts', find: 'export const CATEGORIES', replace: '// Categorías del fixture\nexport const CATEGORIES' });
      steps.push({ type: 'run_checks' }, { type: 'deliver' });
      return steps[Math.min(context.cycle, steps.length) - 1];
    }
  };
}

async function main() {
  const lock = readContainerLock(root);
  const data = loadCorpus(root);
  assert.deepEqual(validateCorpus(data, root), []);
  const packet = makePacket(data, 'V0');
  const store = createTaskStore(root, { mode: 'rehearsal', version: 'V0' });
  console.log(`Ensayo ${store.taskId} con imagen ${lock.image_id.slice(0, 19)}…`);
  const opened = [], closed = [], seen = [];
  const result = await runTask({
    mode: 'rehearsal', packet, policy: data.policy, initialProvider: 'openai',
    adapter: scriptedAdapter(store, seen),
    workspaces: sandboxWorkspaces(root, { onOpen: s => { opened.push(s.name); console.log(`  workspace ${opened.length} abierto`); }, onClose: s => closed.push(s.name) }),
    evaluator: createPipelineEvaluator({ root, version: 'V0', privateSink: record => store.private(record) }),
    emit: event => { store.event(event); if (event.type === 'evaluation') console.log(`  ${event.provider} a${event.attempt} ${event.stage}: ${event.status}`); }
  });
  const { summary, records } = store.finalize(result, { packet, models: null, stackText: readFileSync(join(root, 'config/stack.json'), 'utf8'), fixtureSha256: data.family.fixture.sha256 });

  // Comprobaciones del ensayo.
  assert.equal(result.status, 'ACCEPTED');
  assert.deepEqual(records.map(r => [r.generator.provider, r.attempt, r.outcome]), [['openai', 1, 'REPAIR'], ['openai', 2, 'REASSIGN'], ['anthropic', 1, 'REASSIGN'], ['google', 1, 'ACCEPTED']]);
  assert.equal(records[0].validation.typecheck, 'FAIL');
  assert.equal(records[1].validation.independent_oracle, 'FAIL');
  assert.equal(records[2].validation.independent_oracle, 'PASS');
  assert.equal(records[2].validation.architecture, 'FAIL');
  assert.ok(Object.values(records[3].validation).every(status => status === 'PASS'));
  assert.match(records[3].candidate_commit, /^[a-f0-9]{40}$/);
  assert.equal(opened.length, 3);
  assert.deepEqual([...closed].sort(), [...opened].sort());
  assert.equal(docker(['container', 'ls', '--all', '--filter', 'label=org.evoguard.role', '--format', '{{.Names}}']), '', 'contenedores remanentes');
  // Protocolo 1.1: la primera llamada de cada asignación ve la vista del workspace con el contenido de src/.
  const first = JSON.parse(seen[0]);
  assert.equal(first.messages[0].content.source, 'workspace');
  assert.match(first.messages[0].content.overview.contents['src/App.tsx'], /Scaffold base/);
  const visibleAll = seen.join('\n');
  assert.match(visibleAll, /== typecheck: FAIL/, 'run_checks muestra el fallo de tipos');
  assert.match(visibleAll, /editado src\/catalog\.ts/, 'edit_file se ejecutó en el contenedor');
  assert.match(visibleAll, /escrito src\/App\.tsx/, 'write_file se ejecutó en el contenedor');
  // El constructor ve el feedback de typecheck, pero nunca detalles del oráculo ni de arquitectura.
  const visible = seen.join('\n');
  assert.match(visible, /TS2322|not assignable/);
  assert.doesNotMatch(visible, /"checks"|"observed"|"violations"|useEffect en|R001-A05[^"]*FAIL/);
  const events = readFileSync(join(store.dir, 'events.jsonl'), 'utf8');
  assert.doesNotMatch(events, /"checks"|"observed"|"violations"/);
  const privateLog = readFileSync(join(store.privateDir, 'evaluator.jsonl'), 'utf8');
  assert.match(privateLog, /R001-A05/);
  assert.match(privateLog, /useEffect/);
  const patch = readFileSync(join(store.dir, 'attempts', summary.accepted, 'patch.diff'), 'utf8');
  assert.match(patch, /src\/App\.tsx/);
  // Evolución: la V0 instrumental se guarda como referencia SOLO dentro del ensayo y se reconstruye el workspace V1.
  const referencesDir = join(store.dir, 'references');
  const accepted = records.find(r => r.outcome === 'ACCEPTED');
  saveReference(root, referencesDir, { version: 'V0', record: accepted, patch, taskText: seedFiles(root, 'V0')['TASK.json'], taskDir: store.dir });
  assert.throws(() => auditPatch('diff --git a/TASK.json b/TASK.json\n', 'prueba'), /ruta no permitida/);
  const seed = evolutionSeed(root, 'V1', referencesDir);
  const session = openSandbox(root, { seed });
  try {
    const ops = workspaceOps(session);
    const log = await ops.exec(['git', 'log', '--format=%s']);
    assert.equal(log.output.trim(), 'task: V1\nreference: V0\nscaffold: isolated baseline (not V0)');
    assert.equal(session.initialization.history[1].commit, accepted.candidate_commit, 'la referencia V0 se reproduce con el mismo hash');
    const task = JSON.parse((await ops.exec(['cat', 'TASK.json'])).output);
    assert.equal(task.version, 'V1');
    assert.deepEqual(task.requirements.map(r => r.id), ['R001', 'R002', 'R003']);
    const all = (await ops.exec(['git', 'log', '--all', '-p', '--format=%H %s'])).output;
    assert.doesNotMatch(all, /R004|R005|T002|T003|oracle|openai|anthropic|google|local_a|instrumental/i);
    assert.equal((await ops.exec(['node', 'node_modules/vite/bin/vite.js', 'build'])).status, 'PASS');
    assert.equal((await ops.exec(['git', 'remote', '-v'])).output.trim(), '');
  } finally { closeSandbox(session.name, session.image); }
  console.log('  V1 reconstruido desde la referencia V0 del ensayo: historia y hashes reproducibles');

  const evidence = { artifact_type: 'pipeline_rehearsal', status: 'PASS', experimental: false, task_id: store.taskId, image_id: lock.image_id, checked_at: new Date().toISOString(),
    outcomes: records.map(r => ({ provider: r.generator.provider, attempt: r.attempt, outcome: r.outcome, validation: r.validation })), evolution_seed_v1: 'PASS', sources_sha256: pipelineFingerprint(root) };
  writeFileSync(join(store.dir, 'rehearsal-check.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  // Evidencia versionada para el preflight (sin registros del ensayo, que quedan fuera de Git).
  writeFileSync(join(root, 'docs/verification/pipeline-rehearsal.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`PASS: ensayo integral guardado en ${store.dir}`);
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
