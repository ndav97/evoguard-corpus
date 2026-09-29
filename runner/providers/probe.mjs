// Sonda del transporte Anthropic vía Synterolink (diagnóstico, no genera corpus).
// Uso: npm run providers -- probe [--rounds=N] [--variants=D,F]
// Motivo (docs/operational-decisions.md, 2026-09-28): Sonnet 5 responde con prosa y pseudo-llamadas XML aunque el
// adaptador pide salida estructurada, lo que indica que el intermediario no aplica `output_config.format`. La sonda
// prueba variantes de la petición con el mismo contexto que `providers diagnose` y registra, por llamada, el estado
// HTTP (con el cuerpo del error recortado y redactado), los tipos de bloque devueltos, stop_reason y si la acción es
// válida. Con eso se elige el transporte; el adaptador no cambia hasta decidirlo.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACTION_SCHEMA, INSTRUCTION, RESPONSE_CONTRACT, parseAction, validateAction, rejectedSample } from '../protocol/actions.mjs';
import { connectionFor } from './connection.mjs';

const TOOL = { name: 'runner_action', description: 'Submit the next runner action (protocol 1.1). Call it exactly once per turn.', input_schema: ACTION_SCHEMA };

// Cada variante recibe la configuración y devuelve { body, headers } adicionales a los comunes.
export const VARIANTS = {
  A_output_config: c => ({ body: { thinking: { type: 'adaptive' }, output_config: { effort: c.reasoning, format: { type: 'json_schema', schema: ACTION_SCHEMA } } } }),
  B_output_format_beta: c => ({ body: { thinking: { type: 'adaptive' }, output_config: { effort: c.reasoning }, output_format: { type: 'json_schema', schema: ACTION_SCHEMA } }, headers: { 'anthropic-beta': 'structured-outputs-2025-11-13' } }),
  C_output_config_no_thinking: c => ({ body: { output_config: { effort: c.reasoning, format: { type: 'json_schema', schema: ACTION_SCHEMA } } } }),
  D_tool_auto_thinking: c => ({ body: { thinking: { type: 'adaptive' }, output_config: { effort: c.reasoning }, tools: [TOOL], tool_choice: { type: 'auto' } } }),
  E_tool_forced: c => ({ body: { output_config: { effort: c.reasoning }, tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name } } }),
  // Segunda sonda (2026-09-29): D con la herramienta en modo estricto (el esquema se impone a la entrada).
  F_tool_auto_thinking_strict: c => ({ body: { thinking: { type: 'adaptive' }, output_config: { effort: c.reasoning }, tools: [{ ...TOOL, strict: true }], tool_choice: { type: 'auto' } } })
};

export function classify(raw) {
  const blocks = raw?.content ?? [];
  const types = blocks.map(b => b.type);
  const tool = blocks.find(b => b.type === 'tool_use');
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
  let valid = false, via = null, error = null;
  try {
    if (tool) { validateAction(tool.input); via = 'tool_use'; }
    else { via = parseAction(text).normalization; }
    valid = true;
  } catch (e) { error = e.code ?? 'INVALID'; }
  const toolInput = tool ? rejectedSample(JSON.stringify(tool.input ?? null), 600).head : null;
  return { block_types: types, stop_reason: raw?.stop_reason ?? null, observed_model: raw?.model ?? null, valid, via, error, text_chars: text.length, text_sample: valid && !text ? null : rejectedSample(text, 300).head, tool_input: toolInput };
}

export async function probe({ models, credentials, packet, scenarios, rounds = 2, only = null, fetchImpl = fetch, root, log = console.log }) {
  const config = models.anthropic;
  const apiKey = credentials.anthropic;
  if (!apiKey) throw new Error('Falta la credencial de anthropic (.env)');
  const { base_url } = connectionFor('anthropic', config);
  const report = { artifact_type: 'anthropic_transport_probe', experimental: true, created_at: new Date().toISOString(), model: config.api_model_id, rounds, variants: {} };
  const chosen = Object.entries(VARIANTS).filter(([name]) => !only || only.includes(name[0]));
  if (!chosen.length) throw new Error(`Variantes desconocidas: ${only}`);
  for (const [name, variant] of chosen) {
    const row = report.variants[name] = { calls: [], summary: null };
    for (let round = 0; round < rounds; round++) for (const scenario of scenarios) {
      const input = JSON.stringify({ response_contract: RESPONSE_CONTRACT, packet, messages: scenario.messages, attempt: 1, cycle: round + 1 });
      const extra = variant(config);
      const body = { model: config.api_model_id, max_tokens: config.max_output_tokens, system: INSTRUCTION, messages: [{ role: 'user', content: input }], ...extra.body };
      const started = Date.now();
      const call = { scenario: scenario.name, http: null };
      try {
        const response = await fetchImpl(`${base_url}/messages`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(300000), headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...(extra.headers ?? {}) }, body: JSON.stringify(body) });
        call.http = response.status;
        const textBody = await response.text();
        if (!response.ok) Object.assign(call, { valid: false, error: `HTTP_${response.status}`, error_body: rejectedSample(textBody, 400).head });
        else Object.assign(call, classify(JSON.parse(textBody)));
      } catch (e) { Object.assign(call, { valid: false, error: e.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR' }); }
      call.duration_ms = Date.now() - started;
      row.calls.push(call);
    }
    const ok = row.calls.filter(c => c.valid);
    const count = key => row.calls.reduce((acc, c) => { const k = c[key] ?? 'null'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
    row.summary = { valid: `${ok.length}/${row.calls.length}`, via: count('via'), errors: count('error'), block_types: count('block_types'), http: count('http') };
    log(`${name}: ${row.summary.valid} válidas; vía ${JSON.stringify(row.summary.via)}; errores ${JSON.stringify(row.summary.errors)}; bloques ${JSON.stringify(row.summary.block_types)}`);
    const failed = row.calls.find(c => c.error_body);
    if (failed) log(`  error HTTP ${failed.http}: ${JSON.stringify(failed.error_body.slice(0, 300))}`);
  }
  const directory = join(root, '.artifacts/providers'); mkdirSync(directory, { recursive: true });
  const path = join(directory, `probe-anthropic-${report.created_at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  log(`Informe: ${path}`);
  return report;
}
