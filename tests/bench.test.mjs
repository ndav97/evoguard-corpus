// Banco de modelos locales (paso 3): configuración, endpoint por túnel, modo de un solo proveedor y reintentos.
// La integración completa con contenedores se comprueba con `npm run bench:selftest`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ollamaPort, ollamaBase } from '../runner/providers/ollama.mjs';
import { withRetries } from '../runner/providers/retry.mjs';
import { createProviderAdapter } from '../runner/providers/adapter.mjs';
import { createTaskStore } from '../runner/pipeline/store.mjs';
import { runTask } from '../runner/execution/engine.mjs';
import { loadCorpus } from '../runner/validation/corpus.mjs';
import { makePacket } from '../runner/packet.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bench = JSON.parse(readFileSync(new URL('../config/local-bench.json', import.meta.url)));
const models = JSON.parse(readFileSync(new URL('../config/models.json', import.meta.url))).models;
const policy = JSON.parse(readFileSync(new URL('../config/policy.json', import.meta.url)));

test('candidatos del banco: ids únicos, contexto suficiente y líneas base del pool congelado', () => {
  const ids = bench.candidates.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of bench.candidates) {
    assert.match(c.model, /^[a-z0-9._-]+:[a-z0-9._-]+$/);
    assert.ok(c.context - c.max_output_tokens - 512 >= 4096, c.id);
  }
  for (const local of ['local_a', 'local_b']) assert.ok(bench.candidates.some(c => c.model === models[local].api_model_id && c.context === models[local].context && c.max_output_tokens === models[local].max_output_tokens), local);
});

test('Ollama siempre en 127.0.0.1; el puerto del túnel se valida', () => {
  assert.equal(ollamaBase({}), 'http://127.0.0.1:11434');
  assert.equal(ollamaBase({ EVOGUARD_OLLAMA_PORT: '11435' }), 'http://127.0.0.1:11435');
  for (const bad of ['80', 'abc', '70000', '1.5']) assert.throws(() => ollamaPort({ EVOGUARD_OLLAMA_PORT: bad }), /inválido/);
});

test('un local con contexto distinto del calibrado no pasa con la política de producción', () => {
  const config = { ...models.local_a, context: 32768, max_output_tokens: 4096 };
  assert.throws(() => createProviderAdapter({ provider: 'local_a', config }), /CONTEXT_POLICY_MISMATCH/);
});

test('reintentos: solo errores transitorios del transporte', async () => {
  let calls = 0;
  const flaky = withRetries({ async next() { calls++; if (calls < 3) throw Object.assign(new Error('x'), { code: 'NETWORK_ERROR' }); return { type: 'deliver' }; } }, { delays: [1, 1, 1] });
  assert.deepEqual(await flaky.next({}), { type: 'deliver' });
  assert.equal(calls, 3);
  let invalid = 0;
  const model = withRetries({ async next() { invalid++; throw Object.assign(new Error('x'), { code: 'INVALID_ACTION_JSON' }); } }, { delays: [1, 1, 1] });
  await assert.rejects(model.next({}), /x/);
  assert.equal(invalid, 1, 'una salida inválida del modelo no se reintenta');
});

test('singleProvider: una sola asignación, solo en ensayo', async () => {
  const data = loadCorpus(root);
  const base = {
    policy, initialProvider: 'local_a', packet: makePacket(data, 'V0'),
    adapter: { async next() { return { type: 'technical_failure' }; } },
    evaluator: { async check() { return { status: 'PASS' }; } },
    workspaces: { async open() { return { async exec() { return { status: 'FAIL', output: '' }; }, async snapshot() { return ''; }, async close() {} }; } }
  };
  const result = await runTask({ ...base, mode: 'rehearsal', singleProvider: true });
  assert.deepEqual(result.attempts.map(a => a.provider), ['local_a']);
  await assert.rejects(runTask({ ...base, mode: 'experimental', preflightBlockers: [], singleProvider: true }), /solo en ensayo/);
});

test('los registros del banco van a .artifacts/bench y no se marcan como experimentales', () => {
  const store = createTaskStore(root, { mode: 'bench', version: 'V1', taskId: `test-bench-${process.pid}-${Date.now()}` });
  try {
    assert.match(store.dir.split('\\').join('/'), /\.artifacts\/bench\//);
    assert.match(store.privateDir.split('\\').join('/'), /\.artifacts\/bench\/.*\/evaluator$/);
  } finally { rmSync(store.dir, { recursive: true, force: true }); }
});
