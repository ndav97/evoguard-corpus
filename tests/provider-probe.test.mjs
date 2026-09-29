import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probe, classify, VARIANTS } from '../runner/providers/probe.mjs';

const models = { anthropic: { api_model_id: 'claude-sonnet-5', transport: 'anthropic', access_provider: 'synterolink', base_url: 'https://api.synterolink.com/v1', max_output_tokens: 4096, reasoning: 'high' } };
const action = { type: 'list_files', path: '', content: '', find: '', replace: '', argv: [] };

test('classify distingue tool_use, prosa normalizada y pseudo-llamadas XML', () => {
  assert.deepEqual([classify({ content: [{ type: 'thinking' }, { type: 'tool_use', input: action }] }).via, classify({ content: [{ type: 'text', text: 'Veamos.\n\n' + JSON.stringify(action) }] }).via], ['tool_use', 'prose_prefix']);
  const xml = classify({ content: [{ type: 'text', text: 'Veamos.\n\n<function_calls>\n<invoke name="list_files">' }] });
  assert.equal(xml.valid, false); assert.equal(xml.error, 'INVALID_ACTION_JSON');
});

test('la sonda prueba cada variante, registra errores HTTP sin la clave y escribe el informe', async () => {
  const root = mkdtempSync(join(tmpdir(), 'probe-'));
  const seen = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); seen.push({ url, body, headers: init.headers });
    if (body.output_format) return new Response(JSON.stringify({ error: { message: 'output_format: Extra inputs are not permitted' } }), { status: 400 });
    const content = body.tools ? [{ type: 'tool_use', name: 'runner_action', input: action }] : [{ type: 'text', text: 'Intro.\n\n<function_calls>' }];
    return new Response(JSON.stringify({ model: 'claude-sonnet-5', stop_reason: body.tools ? 'tool_use' : 'end_turn', content }), { status: 200 });
  };
  const report = await probe({ models, credentials: { anthropic: 'sk-test-abcdefghijklmnopqrstuvwxyz' }, packet: { family_id: 'F001' }, scenarios: [{ name: 's', messages: [] }], rounds: 1, fetchImpl, root, log: () => {} });
  assert.equal(seen.length, Object.keys(VARIANTS).length);
  assert.ok(seen.every(s => s.url === 'https://api.synterolink.com/v1/messages'));
  assert.equal(report.variants.B_output_format_beta.calls[0].error, 'HTTP_400');
  assert.match(report.variants.B_output_format_beta.calls[0].error_body, /Extra inputs/);
  assert.equal(report.variants.E_tool_forced.calls[0].via, 'tool_use');
  assert.match(report.variants.E_tool_forced.calls[0].tool_input, /list_files/);
  assert.equal(seen.find(s => s.body.tools?.[0].strict).body.thinking.type, 'adaptive');
  const subset = await probe({ models, credentials: { anthropic: 'k' }, packet: {}, scenarios: [{ name: 's', messages: [] }], rounds: 1, only: ['D', 'F'], fetchImpl, root, log: () => {} });
  assert.deepEqual(Object.keys(subset.variants), ['D_tool_auto_thinking', 'F_tool_auto_thinking_strict']);
  assert.equal(report.variants.A_output_config.calls[0].valid, false);
  for (const file of readdirSync(join(root, '.artifacts/providers'))) assert.doesNotMatch(readFileSync(join(root, '.artifacts/providers', file), 'utf8'), /sk-test/);
});
