// Calibración del estimador de contexto con los tokenizadores reales de los modelos locales (Ollama).
// Envía a /api/chat exactamente la forma que usa el adaptador (system = instrucción, user = entrada gestionada)
// con num_ctx amplio y num_predict 1, y lee prompt_eval_count (incluye plantilla). keep_alive 0 evita caché.
// Muestras: núcleo V0–V3 y núcleo + historiales representativos (código TSX, logs de npm/tsc, texto español).
// Resultado: bytes/token mínimo observado por modelo; se fija el menor de ambos en config/context.json
// (status CALIBRATED) y la evidencia en docs/verification/context-calibration.json.
// Uso: npm run context:calibrate            (solo mide e informa)
//      npm run context:calibrate -- --write (además actualiza config y evidencia)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';
import { buildContextInput, loadContextPolicy, validatePolicy } from './policy.mjs';
import { ACTION_SCHEMA, INSTRUCTION, RESPONSE_CONTRACT } from '../providers/adapter.mjs';
import { ollamaBase } from '../providers/ollama.mjs';

const root = new URL('../../', import.meta.url);
const OLLAMA = ollamaBase();
const MEASURE_CTX = 16384;

function sampleHistories() {
  const tsx = readFileSync(new URL('templates/react-vite/src/App.tsx', root), 'utf8');
  const code = (tsx + '\n').repeat(6);
  const npmLog = Array.from({ length: 60 }, (_, i) => `src/components/Item${i}.tsx(${i + 3},${i % 17 + 1}): error TS2322: Type 'string | undefined' is not assignable to type 'string'.`).join('\n');
  const vite = 'vite v8.3.0 building client environment for production...\ntransforming...\n✓ 42 modules transformed.\ndist/index.html  0.30 kB │ gzip: 0.23 kB\ndist/assets/index-Cxv0RrxE.js  219.73 kB │ gzip: 68.65 kB\n✓ built in 139ms\n';
  const spanish = 'La búsqueda no distingue mayúsculas; los productos se filtran por categoría y se ordenan conservando el orden del fixture en los empates. '.repeat(20);
  const steps = (argv, output) => [{ role: 'assistant', content: { type: 'tool', argv } }, { role: 'tool', content: { status: 'FAIL', output } }];
  return {
    code: steps(['sh', '-lc', `cat > src/App.tsx <<'EOF'\n${code}\nEOF`], vite),
    tsc: steps(['npx', 'tsc', '--noEmit'], npmLog),
    spanish: [{ role: 'user', content: { source: 'development_tests', feedback: spanish, attempt: 2 } }, ...steps(['sh', '-lc', 'npm test'], spanish)],
    json: steps(['cat', 'fixtures/products.json'], readFileSync(new URL('families/F001-product-catalog/fixtures/products.json', root), 'utf8'))
  };
}

async function count(model, input) {
  const response = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, stream: false, keep_alive: 0, format: ACTION_SCHEMA, messages: [{ role: 'system', content: INSTRUCTION }, { role: 'user', content: input }], options: { num_ctx: MEASURE_CTX, num_predict: 1, temperature: 0, seed: 42 } })
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const body = await response.json();
  if (!Number.isInteger(body.prompt_eval_count) || body.prompt_eval_count >= MEASURE_CTX - 1) throw new Error('prompt_eval_count ausente o truncado');
  return body.prompt_eval_count;
}

async function main() {
  const write = process.argv.includes('--write');
  const policy = loadContextPolicy(root);
  const models = JSON.parse(readFileSync(new URL('config/models.json', root), 'utf8')).models;
  const data = loadCorpus(fileURLToPath(root));
  // Presupuesto amplio solo para construir muestras grandes; la medición no depende del estimador.
  const wide = structuredClone(policy);
  wide.estimator.bytes_per_token = 1000;
  const overhead = INSTRUCTION + JSON.stringify(ACTION_SCHEMA);
  const samples = [];
  const histories = sampleHistories();
  for (const version of ['V0', 'V1', 'V2', 'V3']) {
    const packet = makePacket(data, version);
    samples.push({ name: `${version}-core`, input: buildContextInput({ packet, messages: [], attempt: 1, cycle: 1 }, { policy: wide, responseContract: RESPONSE_CONTRACT, overhead }).input });
    if (version === 'V3') for (const [name, messages] of Object.entries(histories)) {
      samples.push({ name: `${version}-${name}`, input: buildContextInput({ packet, messages, attempt: 2, cycle: 3 }, { policy: wide, responseContract: RESPONSE_CONTRACT, overhead }).input });
    }
  }
  const tags = await (await fetch(`${OLLAMA}/api/tags`)).json();
  const version = await fetch(`${OLLAMA}/api/version`).then(r => r.json()).catch(() => ({}));
  const results = {};
  for (const provider of policy.applies_to) {
    const config = models[provider];
    if (!tags.models?.some(m => m.name === config.api_model_id && m.digest === config.digest)) throw new Error(`${provider}: modelo o digest distinto del configurado`);
    results[provider] = { model: config.api_model_id, digest: config.digest, samples: [] };
    for (const sample of samples) {
      const bytes = Buffer.byteLength(overhead + sample.input, 'utf8');
      const tokens = await count(config.api_model_id, sample.input);
      results[provider].samples.push({ name: sample.name, bytes, tokens, bytes_per_token: +(bytes / tokens).toFixed(4) });
      console.log(`${provider} ${sample.name}: ${bytes} B / ${tokens} tokens = ${(bytes / tokens).toFixed(3)} B/token`);
    }
    results[provider].min_bytes_per_token = Math.min(...results[provider].samples.map(s => s.bytes_per_token));
  }
  const minimum = Math.min(...Object.values(results).map(r => r.min_bytes_per_token));
  const bytesPerToken = Math.floor(minimum * 100) / 100;
  console.log(`Mínimo observado: ${minimum} B/token → bytes_per_token ${bytesPerToken} con safety_factor ${policy.estimator.safety_factor}`);
  if (!write) { console.log('Sin --write: no se modificó ningún archivo.'); return; }
  const evidence = { artifact_type: 'context_calibration', experimental: false, measured_at: new Date().toISOString(), ollama_version: version.version ?? null, measure_num_ctx: MEASURE_CTX, method: 'prompt_eval_count de /api/chat con la misma instrucción, esquema y entrada que el adaptador; keep_alive 0', results, minimum_bytes_per_token: minimum };
  const evidenceText = JSON.stringify(evidence, null, 2) + '\n';
  writeFileSync(new URL('docs/verification/context-calibration.json', root), evidenceText);
  const updated = structuredClone(policy);
  updated.status = 'CALIBRATED';
  updated.estimator.bytes_per_token = bytesPerToken;
  updated.estimator.calibration = { evidence: 'docs/verification/context-calibration.json', measured_at: evidence.measured_at, minimum_bytes_per_token: minimum, samples: samples.length * policy.applies_to.length };
  validatePolicy(updated);
  writeFileSync(new URL('config/context.json', root), JSON.stringify(updated, null, 2) + '\n');
  console.log('Actualizados config/context.json (CALIBRATED) y docs/verification/context-calibration.json.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
