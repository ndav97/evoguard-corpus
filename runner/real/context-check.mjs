// ¿Cabe el primer mensaje de cada turno semi-real en la ventana de los modelos locales? (tarea 9)
// Uso: npm run real:context -- [Sxxx ...] [--windows=8192:1024,16384:4096,32768:4096]
// Para cada familia abre un contenedor de su imagen (sin red), obtiene la vista inicial del workspace exactamente
// como la verá el modelo en V1 (árbol del paquete y archivos de la zona del cambio) y construye el primer mensaje
// con la política de contexto de los modelos locales para cada ventana. Informa el nivel de la vista que cabe
// (completa, solo árbol, directorio de la zona, …), los tokens estimados y el margen que queda para el historial.
// Evidencia: docs/verification/real-context.json. No usa modelos.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listRealFamilies, loadRealFamily, makeRealPacket } from './families.mjs';
import { readBases } from './prepare.mjs';
import { realWorkspaces } from './pipeline.mjs';
import { buildContextInput, loadContextPolicy } from '../context/policy.mjs';
import { INSTRUCTION, ACTION_SCHEMA, RESPONSE_CONTRACT } from '../protocol/actions.mjs';

const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

// Nivel de la vista del workspace que ha entrado en el mensaje.
export function viewLevel(overview) {
  if (!overview) return 'sin vista';
  if (/directorio de la zona/.test(overview.omitted ?? '')) return Object.keys(overview.contents ?? {}).length ? 'directorio de la zona + archivo recortado' : 'solo directorio de la zona';
  if (overview.omitted) return 'árbol completo sin contenidos';
  return Object.keys(overview.contents ?? {}).length ? 'completa' : 'árbol completo (archivos demasiado grandes)';
}

export function measure(overview, packet, policy, windows) {
  return windows.map(([context, output]) => {
    const p = structuredClone(policy);
    p.budget = { ...p.budget, context_tokens: context, output_reserve_tokens: output, input_tokens: context - output - (p.budget.template_reserve_tokens ?? 512) };
    try {
      const { input, trace } = buildContextInput({ packet, messages: [{ role: 'user', content: { source: 'workspace', overview } }], attempt: 1, cycle: 1 }, { policy: p, responseContract: RESPONSE_CONTRACT, overhead: INSTRUCTION + JSON.stringify(ACTION_SCHEMA) });
      const shown = JSON.parse(input).history.messages.find(m => m.content?.source === 'workspace')?.content?.overview;
      return { context, output, input_budget: p.budget.input_tokens, fits: true, level: viewLevel(shown), estimated_tokens: trace.estimated_tokens, history_margin: p.budget.input_tokens - trace.estimated_tokens };
    } catch (error) {
      return { context, output, input_budget: p.budget.input_tokens, fits: false, error: error.code ?? error.message };
    }
  });
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const windows = (args.find(a => a.startsWith('--windows='))?.split('=')[1] ?? '8192:1024,16384:4096,32768:4096').split(',').map(w => w.split(':').map(Number));
  const ids = args.filter(a => /^S\d{3}$/.test(a));
  const families = ids.length ? ids : listRealFamilies(root).map(f => f.id).filter(id => id !== 'S900');
  const policy = loadContextPolicy(pathToFileURL(join(root, '/')));
  const bases = readBases(root).bases;
  const report = { artifact_type: 'real_context_fit', created_at: new Date().toISOString(), estimator: policy.estimator, windows, families: {} };
  for (const id of families) {
    const data = loadRealFamily(root, id);
    const base = bases[id];
    const workspace = await realWorkspaces({ image: base.image_id, manifest: data.manifest, steps: [], v0Commit: base.v0_repo_commit }).open();
    try {
      const overview = await workspace.overview();
      const packet = makeRealPacket(data, 'V1');
      const results = measure(overview, packet, policy, windows);
      report.families[id] = { files: overview.files.length, tree_bytes: Buffer.byteLength(JSON.stringify(overview.files)), contents_bytes: Buffer.byteLength(JSON.stringify(overview.contents)), results };
      log(`${id}: ${overview.files.length} archivos; ${results.map(r => `${r.context}: ${r.fits ? `${r.level}, ${r.estimated_tokens} tokens, margen ${r.history_margin}` : r.error}`).join(' | ')}`);
    } finally { await workspace.close(); }
  }
  writeFileSync(join(root, 'docs/verification/real-context.json'), JSON.stringify(report, null, 2) + '\n');
  log('→ docs/verification/real-context.json');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
