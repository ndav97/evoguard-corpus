// Política de contexto: solo modelos con ventana limitada; los comerciales reciben contexto completo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../runner/validation/corpus.mjs';
import { makePacket } from '../runner/packet.mjs';
import { buildContextInput, loadContextPolicy, estimateTokens, clip, policyFor } from '../runner/context/policy.mjs';
import { createProviderAdapter, INSTRUCTION, ACTION_SCHEMA, RESPONSE_CONTRACT } from '../runner/providers/adapter.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = loadCorpus(root);
const policy = loadContextPolicy();
const models = JSON.parse(readFileSync(new URL('../config/models.json', import.meta.url))).models;
const overhead = INSTRUCTION + JSON.stringify(ACTION_SCHEMA);
const build = (context, p = policy) => buildContextInput(context, { policy: p, responseContract: RESPONSE_CONTRACT, overhead });
const action = JSON.stringify({ type: 'deliver', argv: [] });

// Historial pesado de 24 pasos + feedback de reparación.
function heavyHistory(outputLines = 3000) {
  const messages = [];
  for (let i = 0; i < 24; i++) {
    messages.push({ role: 'assistant', content: { type: 'tool', argv: ['sh', '-lc', `cat > src/F${i}.tsx <<'X'\n${'const a = 1;\n'.repeat(400)}X`] } });
    messages.push({ role: 'tool', content: { status: 'FAIL', output: `inicio-${i}\n${'error TS2322\n'.repeat(outputLines)}fin-${i}` } });
    if (i === 5) messages.push({ role: 'user', content: { source: 'build', feedback: `FEEDBACK_VISIBLE\n${'x\n'.repeat(5000)}FEEDBACK_END`, attempt: 2 } });
  }
  return messages;
}

// Política con la proporción típica medida en pruebas previas (~3,2 B/token), para ejercitar la ventana.
const calibrated = structuredClone(policy);
calibrated.estimator.bytes_per_token = 3.2;
// Ventana pequeña (8 192 tokens, la de los locales de 7–8B hasta 2026-10-11) para ejercitar recortes y omisiones.
const small = structuredClone(calibrated);
small.budget = { context_tokens: 8192, output_reserve_tokens: 1024, template_reserve_tokens: 512, input_tokens: 6656 };
delete small.budget_by_provider; // la ventana reducida de prueba rige para todos los modelos
const smallConfig = config => ({ ...config, context: 8192, max_output_tokens: 1024 });

test('la política alcanza exactamente a los modelos con ventana limitada', () => {
  const limited = Object.entries(models).filter(([, config]) => config.context !== null).map(([provider]) => provider);
  assert.deepEqual([...policy.applies_to].sort(), limited.sort());
  for (const provider of policy.applies_to) {
    const own = policyFor(policy, provider).budget;
    assert.equal(models[provider].context, own.context_tokens, provider);
    assert.equal(models[provider].max_output_tokens, own.output_reserve_tokens, provider);
  }
});

test('el núcleo de V0–V3 cabe en el presupuesto con requisitos y ui_contract íntegros', () => {
  for (const version of ['V0', 'V1', 'V2', 'V3']) {
    const packet = makePacket(data, version);
    const { input, trace } = build({ packet, messages: [], attempt: 1, cycle: 1 });
    assert.ok(trace.estimated_tokens <= policy.budget.input_tokens, `${version}: ${trace.estimated_tokens}`);
    const visible = JSON.parse(input);
    assert.deepEqual(visible.packet.requirements, packet.requirements);
    assert.equal(visible.packet.request, packet.request);
    assert.equal(visible.packet.prompt, packet.prompt);
    assert.equal(visible.packet.products, undefined);
    assert.match(JSON.stringify(visible.packet.workspace_files), /fixtures\/products\.json.*30 productos/);
  }
});

test('con historial pesado conserva feedback y el paso más reciente, y declara lo omitido', () => {
  for (const version of ['V0', 'V3']) {
    const { input, trace } = build({ packet: makePacket(data, version), messages: heavyHistory(), attempt: 2, cycle: 25 }, small);
    assert.ok(trace.estimated_tokens <= small.budget.input_tokens);
    const visible = JSON.parse(input);
    const text = JSON.stringify(visible.history);
    assert.match(text, /FEEDBACK_VISIBLE/);
    assert.match(text, /FEEDBACK_END/);
    assert.match(text, /fin-23/, 'el último resultado de herramienta conserva su final');
    assert.match(text, /bytes omitidos por la política de contexto/);
    assert.equal(visible.history.omitted_steps, trace.steps_omitted);
    assert.equal(trace.steps_included + trace.steps_omitted, 24);
    assert.ok(trace.steps_omitted > 0);
    const order = visible.history.messages.map(m => m.role);
    assert.equal(order.at(-1), 'tool');
  }
});

test('la entrada es determinista y no serializa campos privados del contexto', () => {
  const context = { packet: makePacket(data, 'V1'), messages: heavyHistory(), attempt: 2, cycle: 25, oracle: 'PRIVATE_CANARY', provider: 'local_a' };
  const first = build(context, calibrated);
  const second = build(structuredClone(context), calibrated);
  assert.equal(first.trace.input_sha256, second.trace.input_sha256);
  assert.doesNotMatch(first.input, /PRIVATE_CANARY/);
});

test('núcleo excesivo o ventana sin el último paso se rechazan, nunca se recortan en silencio', () => {
  assert.throws(() => build({ packet: { request: 'x'.repeat(40000) }, messages: [], attempt: 1, cycle: 1 }, small), /CONTEXT_CORE_TOO_LARGE/);
  assert.throws(() => build({ packet: { request: 'x'.repeat(200000) }, messages: [], attempt: 1, cycle: 1 }), /CONTEXT_CORE_TOO_LARGE/);
  const tight = structuredClone(policy);
  const coreBytes = Buffer.byteLength(overhead + build({ packet: { request: 'r' }, messages: [], attempt: 1, cycle: 1 }).input);
  tight.budget.input_tokens = estimateTokens('a'.repeat(coreBytes + 150), policy);
  const history = [{ role: 'assistant', content: { type: 'tool', argv: ['echo', 'y'.repeat(5000)] } }, { role: 'tool', content: { status: 'PASS', output: 'z'.repeat(5000) } }];
  assert.throws(() => build({ packet: { request: 'r' }, messages: history, attempt: 1, cycle: 2 }, tight), /CONTEXT_WINDOW_TOO_SMALL/);
});

test('el recorte conserva inicio y final con aviso explícito', () => {
  const text = `INICIO${'m'.repeat(10000)}FINAL`;
  const clipped = clip(text, 1000, 0.4);
  assert.ok(clipped.startsWith('INICIO'));
  assert.ok(clipped.endsWith('FINAL'));
  assert.match(clipped, /bytes omitidos/);
  assert.equal(clip('corto', 1000, 0.4), 'corto');
});

function fakeFetch(config, promptTokens, seen) {
  return async (url, options) => {
    if (url.endsWith('/api/version')) return Response.json({ version: config.ollama_version ?? '0.0.0' });
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: config.api_model_id, digest: config.digest }] });
    if (url.endsWith('/api/show')) return Response.json({ capabilities: ['completion'] });
    seen.push(JSON.parse(options.body));
    if (config.transport === 'ollama') return Response.json({ model: config.api_model_id, done: true, done_reason: 'stop', message: { content: action }, prompt_eval_count: promptTokens, eval_count: 3 });
    if (config.transport === 'openai') return Response.json({ model: config.api_model_id, status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: action }] }], usage: { input_tokens: promptTokens, output_tokens: 3 } });
    if (config.transport === 'anthropic') return Response.json({ model: config.api_model_id, stop_reason: 'end_turn', content: [{ type: 'text', text: action }], usage: { input_tokens: promptTokens, output_tokens: 3 } });
    return Response.json({ modelVersion: config.api_model_id, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: action }] } }], usageMetadata: { promptTokenCount: promptTokens, candidatesTokenCount: 3 } });
  };
}
const visibleInput = (config, body) => JSON.parse(config.transport === 'openai' ? body.input : config.transport === 'google' ? body.contents[0].parts[0].text : anthropicText(body.messages.at(-1).content));
// Anthropic recibe la entrada en bloques de texto (caché por bloques); su concatenación es la entrada completa.
const anthropicText = content => typeof content === 'string' ? content : content.map(b => b.text).join('');

test('los modelos comerciales reciben paquete completo e historial íntegro, sin ventana', async () => {
  // ~200 KB de historial: muy por encima del presupuesto local, dentro del tope de 1 MB por llamada de los comerciales.
  const messages = heavyHistory(500);
  const packet = makePacket(data, 'V3');
  const gemini = { display_name: 'Gemini', api_model_id: 'gemini-3.8-flash', transport: 'google', access_provider: 'vnaipro', base_url: 'https://apikey.vnaipro.app/v1beta', context: null, max_output_tokens: 16384, reasoning: 'high', temperature: null, seed: null, digest: null };
  for (const [provider, config] of [['openai', models.openai], ['anthropic', models.anthropic], ['google', gemini]]) {
    const seen = [];
    let observation;
    const adapter = createProviderAdapter({ provider, config, apiKey: 'FAKE', fetchImpl: fakeFetch(config, 50000, seen), onCall: r => observation = r });
    await adapter.next({ provider, attempt: 2, cycle: 25, packet, messages });
    const visible = visibleInput(config, seen[0]);
    assert.deepEqual(visible.packet, packet);
    assert.deepEqual(visible.messages, messages);
    assert.equal(observation.context.policy, 'full_context');
  }
});

test('los locales reciben contexto gestionado y registran la traza por llamada', async () => {
  // los modelos aún sin digest (pendientes del banco) quedan bloqueados por el adaptador y la verificación previa
  for (const provider of policy.applies_to.filter(p => models[p].digest_status !== 'PENDING_BENCH')) {
    const config = smallConfig(models[provider]);
    const seen = [];
    let observation;
    const adapter = createProviderAdapter({ provider, config, fetchImpl: fakeFetch(config, 900, seen), onCall: r => observation = r, contextPolicy: small });
    await adapter.next({ provider, attempt: 2, cycle: 25, packet: makePacket(data, 'V2'), messages: heavyHistory() });
    const visible = visibleInput(config, seen[0]);
    assert.ok(visible.history.omitted_steps > 0);
    assert.equal(observation.context.budget_tokens, small.budget.input_tokens);
    assert.match(observation.context.input_sha256, /^[a-f0-9]{64}$/);
    assert.equal(seen[0].options.num_ctx, 8192);
  }
});

test('tokens reales por encima de la estimación se rechazan como violación de contexto', async () => {
  const config = models.local_a;
  const seen = [];
  const adapter = createProviderAdapter({ provider: 'local_a', config, fetchImpl: fakeFetch(config, 30000, seen) });
  await assert.rejects(adapter.next({ provider: 'local_a', attempt: 1, cycle: 1, packet: { request: 'breve' }, messages: [] }), /CONTEXT_(ESTIMATE_VIOLATION|CORE_TOO_LARGE)/);
  assert.ok(seen.length <= 2, 'como mucho una reconstrucción antes de rechazar');
});

test('si una llamada excede la estimación, la entrada se reconstruye una vez con la proporción observada', async () => {
  const config = models.local_a, seen = [];
  let n = 0, record;
  const base = fakeFetch(config, 0, seen);
  const fetchImpl = async (url, options) => {
    const res = await base(url, options);
    if (!url.endsWith('/api/chat')) return res;
    const body = await res.json(); n++;
    return Response.json({ ...body, prompt_eval_count: n === 1 ? 7100 : 100 });
  };
  const adapter = createProviderAdapter({ provider: 'local_a', config, fetchImpl, onCall: r => record = r });
  await adapter.next({ provider: 'local_a', attempt: 1, cycle: 1, packet: { request: 'breve' }, messages: [] });
  assert.equal(n, 2); assert.equal(record.context_rebuilt.first_input_tokens, 7100); assert.equal(record.tokens.input, 100);
});

test('protocolo 1.1: la vista del workspace se conserva o se reduce al árbol, nunca se pierde', () => {
  const overview = { note: 'Vista', files: ['src/App.tsx (40000 B)'], contents: { 'src/App.tsx': 'x'.repeat(40000), 'src/b.ts': 'b' } };
  const messages = [{ role: 'user', content: { source: 'workspace', overview } }];
  const { input } = build({ packet: makePacket(data, 'V3'), messages, attempt: 1, cycle: 1 }, calibrated);
  const visible = JSON.parse(input).history.messages[0].content.overview;
  assert.deepEqual(visible.files, overview.files);
  assert.equal(visible.contents['src/b.ts'], 'b', 'los archivos pequeños caben');
  assert.equal(visible.contents['src/App.tsx'], undefined, 'los grandes se omiten y se leen con read_file');
  const write = [{ role: 'assistant', content: { type: 'write_file', path: 'src/App.tsx', content: 'y'.repeat(20000) } }, { role: 'tool', content: { status: 'PASS', output: 'escrito' } }];
  for (let i = 0; i < 4; i++) messages.push(...structuredClone(write));
  const trimmed = JSON.parse(build({ packet: makePacket(data, 'V3'), messages, attempt: 1, cycle: 9 }, calibrated).input);
  const writes = trimmed.history.messages.filter(m => m.role === 'assistant').map(m => m.content.content.length);
  assert.equal(writes.at(-1), 20000, 'la escritura más reciente se conserva íntegra si cabe');
  assert.ok(writes.slice(0, -1).some(n => n < 20000) || trimmed.history.omitted_steps > 0, 'las anteriores se recortan u omiten para caber en la ventana');
});

test('2026-10-12: un archivo de 6 KB leído se ve completo; al no caber, los pasos antiguos bajan de nivel', () => {
  const file = 'línea de código '.repeat(400);
  const read = [{ role: 'assistant', content: { type: 'read_file', path: 'src/a.tsx' } }, { role: 'tool', content: { status: 'PASS', output: file } }];
  const messages = [...structuredClone(read)];
  const one = JSON.parse(build({ packet: makePacket(data, 'V3'), messages, attempt: 1, cycle: 2 }, calibrated).input);
  assert.equal(one.history.messages.at(-1).content.output, file, 'la lectura reciente llega completa');
  for (let i = 0; i < 12; i++) messages.push(...structuredClone(read));
  const many = JSON.parse(build({ packet: makePacket(data, 'V3'), messages, attempt: 1, cycle: 14 }, calibrated).input);
  assert.equal(many.history.messages.at(-1).content.output, file, 'la más reciente sigue completa');
  const outs = many.history.messages.filter(m => m.role === 'tool').map(m => m.content.output.length);
  assert.ok(outs.length < 13 || outs.some(n => n < file.length), 'las antiguas se comprimen u omiten');
});

test('bytes por token propios de un modelo: solo cambian la ranura indicada', async () => {
  const { policyFor, loadContextPolicy: load } = await import('../runner/context/policy.mjs');
  const policy = load();
  assert.equal(policyFor(policy, 'google').estimator.bytes_per_token, policy.estimator.by_provider.google);
  assert.equal(policyFor(policy, 'local_b').estimator.bytes_per_token, policy.estimator.by_provider.local_b);
  assert.equal(policyFor(policy, 'local_a').estimator.bytes_per_token, policy.estimator.by_provider.local_a);
  assert.ok(policy.estimator.by_provider.google * policy.estimator.safety_factor <= 2.13, 'cubre el mínimo observado de Gemma');
});

test('presupuesto propio (2026-10-31): local_c y local_d amplían su ventana sin cambiar la de los modelos congelados', () => {
  for (const p of ['google', 'local_a', 'local_b']) assert.deepEqual(policyFor(policy, p).budget, policy.budget, p);
  for (const p of Object.keys(policy.budget_by_provider ?? {})) {
    const own = policyFor(policy, p);
    assert.deepEqual(own.budget, policy.budget_by_provider[p], p);
    assert.equal(own.estimator.bytes_per_token, policy.estimator.by_provider?.[p] ?? policy.estimator.bytes_per_token, p);
  }
});
