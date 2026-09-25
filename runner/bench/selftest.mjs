// Autoprueba del banco sin GPU: un Ollama simulado en 127.0.0.1 responde como un "modelo" guionado que usa el
// protocolo 1.1 (list_files, write_file ×3, run_checks, deliver) escribiendo una solución conocida. Ejercita el
// adaptador real, la política de contexto del candidato, contenedores, evaluación, oráculo y registros.
// Uso: npm run bench:selftest   (no escribe en docs/; resultados en .artifacts/bench/)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBench } from './local.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = name => readFileSync(join(root, 'tests/fixtures/rehearsal', name), 'utf8');
const MODEL = 'selftest-coder:1b';
const DIGEST = 'f'.repeat(64);
const empty = { path: '', content: '', find: '', replace: '', argv: [] };
const plan = [
  { ...empty, type: 'list_files' },
  { ...empty, type: 'write_file', path: 'src/App.tsx', content: fixture('App-full.tsx') },
  { ...empty, type: 'write_file', path: 'src/catalog-full.ts', content: fixture('catalog-full.ts') },
  { ...empty, type: 'write_file', path: 'src/catalog-full.test.ts', content: fixture('catalog-full.test.ts') },
  { ...empty, type: 'run_checks' },
  { ...empty, type: 'deliver' }
];

export function startFakeOllama() {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/api/tags') return response.end(JSON.stringify({ models: [{ name: MODEL, digest: DIGEST, details: { quantization_level: 'SIM' } }] }));
      if (request.url === '/api/version') return response.end(JSON.stringify({ version: 'selftest' }));
      const payload = JSON.parse(body);
      const text = payload.messages.map(m => m.content).join('');
      const promptTokens = Math.ceil(Buffer.byteLength(text) / 4);
      if (payload.options?.num_predict === 1) return response.end(JSON.stringify({ model: MODEL, done: true, done_reason: 'stop', message: { content: '{' }, prompt_eval_count: Math.ceil(Buffer.byteLength(text) / 3.6), eval_count: 1 }));
      const input = JSON.parse(payload.messages.at(-1).content);
      const action = plan[Math.min(input.cycle, plan.length) - 1];
      response.end(JSON.stringify({ model: MODEL, done: true, done_reason: 'stop', message: { content: JSON.stringify(action) }, prompt_eval_count: promptTokens, eval_count: 50 }));
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = await startFakeOllama();
  process.env.EVOGUARD_OLLAMA_PORT = String(server.address().port);
  try {
    const report = await runBench(root, {
      outputs: false,
      tasks: (process.argv[2] ?? 'V1').split(','),
      config: { tasks: ['V1'], defaults: { temperature: 0, seed: 42, keep_alive: '1m' }, candidates: [{ id: 'selftest', model: MODEL, context: 32768, max_output_tokens: 4096 }] }
    });
    const ok = report.candidates[0].tasks && Object.values(report.candidates[0].tasks).every(t => t.status === 'ACCEPTED');
    console.log(ok ? 'PASS: autoprueba del banco' : 'FAIL: autoprueba del banco');
    if (!ok) process.exitCode = 1;
  } finally { server.close(); }
}
