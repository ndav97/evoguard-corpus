// Protocolo de acciones 1.1: análisis, validación, diagnóstico de salidas rechazadas y ejecución sobre workspace.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAction, validateAction, extractJson, rejectedSample, ACTION_SCHEMA } from '../runner/protocol/actions.mjs';
import { performAction, actionArgvChars, MAX_ACTION_ARGV_CHARS } from '../runner/protocol/execute.mjs';
import { createProviderAdapter } from '../runner/providers/adapter.mjs';

const full = (type, extra = {}) => ({ type, path: '', content: '', find: '', replace: '', argv: [], ...extra });
const models = JSON.parse(readFileSync(new URL('../config/models.json', import.meta.url))).models;

test('esquema plano con todas las claves obligatorias (salida estricta en los cinco proveedores)', () => {
  assert.deepEqual(ACTION_SCHEMA.required.sort(), Object.keys(ACTION_SCHEMA.properties).sort());
  assert.equal(ACTION_SCHEMA.additionalProperties, false);
});

test('acciones válidas se reducen a sus campos significativos', () => {
  assert.deepEqual(validateAction(full('read_file', { path: 'src/App.tsx' })), { type: 'read_file', path: 'src/App.tsx' });
  assert.deepEqual(validateAction(full('list_files')), { type: 'list_files', path: '' });
  assert.deepEqual(validateAction(full('write_file', { path: 'src/a.ts', content: 'export {}' })), { type: 'write_file', path: 'src/a.ts', content: 'export {}' });
  assert.deepEqual(validateAction(full('edit_file', { path: 'src/a.ts', find: 'a', replace: '' })), { type: 'edit_file', path: 'src/a.ts', find: 'a', replace: '' });
  assert.deepEqual(validateAction(full('tool', { argv: ['ls'] })), { type: 'tool', argv: ['ls'] });
  assert.deepEqual(validateAction(full('run_checks')), { type: 'run_checks' });
  assert.deepEqual(validateAction({ type: 'deliver', argv: [] }), { type: 'deliver' }, 'formato 1.0 aún admitido');
});

test('acciones inconsistentes o rutas peligrosas se rechazan', () => {
  for (const bad of [
    full('read_file'), full('read_file', { path: '../x' }), full('read_file', { path: '/etc/passwd' }),
    full('write_file', { path: 'a/../../b', content: 'x' }), full('edit_file', { path: 'a' }),
    full('tool'), full('deliver', { argv: ['x'] }), full('deliver', { path: 'x' }), { ...full('deliver'), extra: 1 }, full('borrar')
  ]) assert.throws(() => validateAction(bad), /INVALID_ACTION/, JSON.stringify(bad));
});

test('normalización acotada: solo espacios y un bloque ```json que envuelve todo el objeto', () => {
  const json = JSON.stringify(full('deliver'));
  assert.equal(extractJson(json).normalization, 'none');
  assert.equal(extractJson(`  ${json}\n`).normalization, 'whitespace');
  assert.equal(parseAction('```json\n' + json + '\n```').normalization, 'markdown_fence');
  for (const bad of [`Aquí está: ${json}`, `${json}\nListo.`, '```json\n' + json + '\n```\nExplicación', '']) assert.throws(() => parseAction(bad), /INVALID_ACTION_JSON/);
});

test('normalización acotada: preámbulo en prosa seguido del objeto (muestras reales de Sonnet vía Synterolink)', () => {
  const list = '{"type":"list_files","path":"","content":"","find":"","replace":"","argv":[]}';
  const read = '{\n  "type": "read_file",\n  "path": "src/App.tsx",\n  "content": "",\n  "find": "",\n  "replace": "",\n  "argv": []\n}';
  const intro = "I'll build a product catalog with search and category filter functionality. Let me start by exploring the repository structure.";
  const fenced = parseAction(`${intro}\n\n\`\`\`json\n${list}\n\`\`\``);
  assert.deepEqual(fenced, { action: { type: 'list_files', path: '' }, normalization: 'prose_prefix_fence', discarded_chars: intro.length });
  assert.equal(parseAction(`${intro}\n\n${list}`).normalization, 'prose_prefix');
  assert.equal(parseAction('I need to read the current `App.tsx` file:\n\n```json\n' + read + '\n```').action.path, 'src/App.tsx');
  for (const bad of [
    `${intro}\n\n<function_calls>\n<invoke name="list_files">\n<parameter name="path"></parameter>\n</invoke>\n</function_calls>`,
    `${intro} ${list}`,                                   // sin línea propia
    `${intro}\n\n${list}\n\nListo.`,                      // texto después
    `${intro}\n\n${list}\n${list}`,                       // dos objetos
    `Primero ${list} y luego:\n\n${list}`,                  // JSON dentro de la prosa
    '```js\nx\n```\n\n' + list,                           // bloque de código en el preámbulo
    'x'.repeat(2001) + '\n\n' + list                        // preámbulo demasiado largo
  ]) assert.throws(() => parseAction(bad), /INVALID_ACTION_JSON/, bad.slice(0, 60));
});

test('el texto rechazado se conserva recortado, con hash y sin secretos', () => {
  const sample = rejectedSample('Claro, aquí va la acción sk-abcdefghijklmnopqrstuvwx y x-api-key: 123 ' + 'z'.repeat(5000));
  assert.equal(sample.length, 5070);
  assert.match(sample.sha256, /^[a-f0-9]{64}$/);
  assert.ok(sample.head.length <= 2000);
  assert.doesNotMatch(sample.head, /sk-abcdefghij|x-api-key/);
  assert.match(sample.head, /Claro, aquí va/);
});

test('el adaptador registra la muestra rechazada y la normalización aplicada', async () => {
  const calls = [];
  const reply = text => async () => Response.json({ id: 'r', model: 'claude-sonnet-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 5, output_tokens: 5 } });
  const make = text => createProviderAdapter({ provider: 'anthropic', config: models.anthropic, apiKey: 'FAKE', fetchImpl: reply(text), onCall: c => calls.push(c) });
  const context = { provider: 'anthropic', attempt: 1, cycle: 1, packet: { request: 'x' }, messages: [] };
  await assert.rejects(make('Voy a leer el archivo primero.').next(context), /INVALID_ACTION_JSON/);
  assert.match(calls[0].rejected_output.head, /Voy a leer/);
  assert.deepEqual(await make('```json\n' + JSON.stringify(full('run_checks')) + '\n```').next(context), { type: 'run_checks' });
  assert.equal(calls[1].normalization, 'markdown_fence');
  assert.equal(calls[1].action_type, 'run_checks');
  assert.equal(calls[1].protocol_version, '1.1');
});

// Workspace falso que interpreta el script del ejecutor en memoria no es necesario: basta verificar lo que se envía.
function recorder(result = { status: 'PASS', output: 'ok' }) {
  const seen = [];
  return { seen, async exec(argv) { seen.push(argv); return result; } };
}

test('el ejecutor protege TASK.json, fixtures, .git, node_modules y dist', async () => {
  const ws = recorder();
  for (const path of ['TASK.json', 'fixtures/products.json', '.git/config', 'node_modules/x.js', 'dist/index.html']) {
    const result = await performAction(ws, { type: 'write_file', path, content: 'x' });
    assert.equal(result.status, 'FAIL', path);
    assert.match(result.output, /protegida/);
  }
  assert.equal(ws.seen.length, 0, 'no se ejecuta nada para rutas protegidas');
  const write = await performAction(ws, { type: 'write_file', path: 'src/App.tsx', content: 'á' });
  assert.equal(write.status, 'PASS');
  assert.equal(ws.seen[0][3], 'write');
  assert.equal(Buffer.from(ws.seen[0][5], 'base64').toString('utf8'), 'á');
});

test('una edición o escritura que no cabe en la línea de comandos falla de forma visible, sin ejecutarse', async () => {
  const ws = recorder();
  const path = 'ui/src/app/applications/components/applications-list/applications-summary.tsx';
  // Tamaños reales de π0 (S010, Qwen3-Coder): 21 633 bytes se ejecutaron; 21 846 hacían caer el proceso en Windows.
  const big = await performAction(ws, { type: 'edit_file', path, find: 'a'.repeat(11000), replace: 'b'.repeat(10846) });
  assert.equal(big.status, 'FAIL');
  assert.match(big.output, /demasiado grande para ejecutarse/);
  const write = await performAction(ws, { type: 'write_file', path, content: 'c'.repeat(23000) });
  assert.equal(write.status, 'FAIL');
  assert.equal(ws.seen.length, 0, 'no se lanza ningún proceso');
  const ok = await performAction(ws, { type: 'edit_file', path, find: 'a'.repeat(10800), replace: 'b'.repeat(10800) });
  assert.equal(ok.status, 'PASS');
  assert.equal(ws.seen.length, 1);
  assert.ok(actionArgvChars(ws.seen[0].slice(3)) <= MAX_ACTION_ARGV_CHARS);
});

test('run_checks ejecuta los tres comandos visibles del pipeline y agrega sus salidas', async () => {
  const ws = { seen: [], async exec(argv) { this.seen.push(argv.join(' ')); return argv.includes('--noEmit') ? { status: 'FAIL', output: 'TS2322' } : { status: 'PASS', output: 'ok' }; } };
  const result = await performAction(ws, { type: 'run_checks' });
  assert.equal(result.status, 'FAIL');
  assert.match(result.output, /== typecheck: FAIL[\s\S]*TS2322[\s\S]*== build: PASS[\s\S]*== development_tests: PASS/);
  assert.equal(ws.seen.length, 3);
});
