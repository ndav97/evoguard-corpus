// Bloqueos comunes a ambos estratos: modelos congelados y política de contexto calibrada.
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadContextPolicy } from './context/policy.mjs';

const FROZEN_KEYS = ['display_name', 'api_model_id', 'transport', 'context', 'max_output_tokens', 'reasoning', 'temperature', 'seed', 'digest'];

// Modelos congelados y política de contexto calibrada (comunes a ambos estratos).
export function modelBlockers(root, ring) {
  const blockers = [];
  try {
    const models = JSON.parse(readFileSync(join(root, 'config/models.json'), 'utf8'));
    if (models.status !== 'INFERENCE_PARAMETERS_FROZEN') blockers.push('Modelos: parámetros de inferencia no congelados.');
    for (const provider of ring) {
      const config = models.models?.[provider];
      if (!config || !FROZEN_KEYS.every(key => key in config) || !config.api_model_id) blockers.push(`Modelos: configuración incompleta de ${provider}.`);
      else if (config.transport === 'ollama' && (!/^[a-f0-9]{64}$/.test(config.digest ?? '') || config.context !== 8192)) blockers.push(`Modelos: ${provider} sin digest o contexto fijado.`);
    }
  } catch (error) { blockers.push(`Modelos: ${error.message}`); }
  try {
    if (loadContextPolicy(pathToFileURL(join(root, '/'))).status !== 'CALIBRATED') blockers.push('Política de contexto de modelos locales sin calibrar: ejecutar npm run context:calibrate -- --write.');
  } catch (error) { blockers.push(`Política de contexto: ${error.message}`); }
  return blockers;
}

