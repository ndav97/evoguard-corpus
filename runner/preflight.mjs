// Preflight de generación experimental: cada bloqueo corresponde a una condición comprobable del repositorio.
// No exige registros de ejecuciones futuras (procedencia observada), que solo existen después de generar.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { loadCorpus, validateCorpus } from './validation/corpus.mjs';
import { readContainerLock } from './sandbox/lock.mjs';
import { loadContextPolicy } from './context/policy.mjs';
import { pipelineFingerprint } from './pipeline/sources.mjs';

const FROZEN_KEYS = ['display_name', 'api_model_id', 'transport', 'context', 'max_output_tokens', 'reasoning', 'temperature', 'seed', 'digest'];

export function generationBlockers(root, familyId = 'F001') {
  const data = loadCorpus(root, familyId);
  const blockers = validateCorpus(data, root);
  let lock = null;
  try {
    lock = readContainerLock(root);
    if (data.stack.experimental.image_digest !== lock.image_id) blockers.push('Linux/Docker: stack e imagen verificada no coinciden.');
  } catch (error) { blockers.push(`Linux/Docker: ${error.message}`); }
  try {
    const models = JSON.parse(readFileSync(join(root, 'config/models.json'), 'utf8'));
    if (models.status !== 'INFERENCE_PARAMETERS_FROZEN') blockers.push('Modelos: parámetros de inferencia no congelados.');
    const ring = data.policy.provider_ring;
    for (const provider of ring) {
      const config = models.models?.[provider];
      if (!config || !FROZEN_KEYS.every(key => key in config) || !config.api_model_id) blockers.push(`Modelos: configuración incompleta de ${provider}.`);
      else if (config.transport === 'ollama' && (!/^[a-f0-9]{64}$/.test(config.digest ?? '') || config.context !== 8192)) blockers.push(`Modelos: ${provider} sin digest o contexto fijado.`);
    }
  } catch (error) { blockers.push(`Modelos: ${error.message}`); }
  try {
    if (loadContextPolicy(pathToFileURL(join(root, '/'))).status !== 'CALIBRATED') blockers.push('Política de contexto de modelos locales sin calibrar: ejecutar npm run context:calibrate -- --write.');
  } catch (error) { blockers.push(`Política de contexto: ${error.message}`); }
  if (data.family.oracle.status !== 'E2E_CALIBRATED') blockers.push('Oráculo E2E sin calibrar (family.yaml oracle.status).');
  const evidencePath = join(root, 'docs/verification/pipeline-rehearsal.json');
  if (!existsSync(evidencePath)) blockers.push('Pipeline: falta ensayo integral; ejecutar npm run pipeline:rehearse.');
  else {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    if (evidence.status !== 'PASS' || evidence.experimental !== false) blockers.push('Pipeline: el último ensayo integral no pasó.');
    if (lock && evidence.image_id !== lock.image_id) blockers.push('Pipeline: el ensayo integral usó otra imagen; repetir npm run pipeline:rehearse.');
    const current = pipelineFingerprint(root);
    const changed = Object.keys(current).filter(path => evidence.sources_sha256?.[path] !== current[path]);
    if (changed.length) blockers.push(`Pipeline: cambió código ensayado (${changed.join(', ')}); repetir npm run pipeline:rehearse.`);
  }
  if (data.family.status === 'FROZEN') blockers.push(`${familyId} está FROZEN: no se regenera; abrir nueva revisión.`);
  return blockers;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const familyId = process.argv[2] ?? 'F001';
    const blockers = generationBlockers(fileURLToPath(new URL('../', import.meta.url)), familyId);
    if (blockers.length) { console.error(`${familyId}: generación no autorizada por preflight:\n` + blockers.map(b => `- ${b}`).join('\n')); process.exitCode = 1; }
    else console.log(`${familyId}: preflight despejado; la generación experimental puede ejecutarse.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
