// Código que ejercita el ensayo del pipeline semi-real (npm run real:rehearse -- --mini). Si cambia, el preflight
// de las familias semi-reales exige repetir el ensayo.
// El transporte de proveedores (runner/providers/*) no forma parte: los ensayos usan constructores guionados y no
// lo ejecutan. Se verifica con sus pruebas unitarias y con `npm run providers:diagnose` (decisión 2026-09-29).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const REAL_PIPELINE_SOURCES = [
  'runner/execution/engine.mjs', 'runner/protocol/actions.mjs', 'runner/protocol/execute.mjs', 'config/protocol.json', 'runner/context/policy.mjs',
  'runner/pipeline/workspace.mjs', 'runner/pipeline/store.mjs', 'runner/sandbox/lineage.mjs',
  'runner/real/families.mjs', 'runner/real/docker.mjs', 'runner/real/suite.mjs', 'runner/real/prepare.mjs', 'runner/real/lineage.mjs', 'runner/real/pipeline.mjs', 'runner/real/rehearse.mjs', 'runner/real/generate.mjs', 'runner/real/audit.mjs', 'runner/real/preflight.mjs',
  'docker/real/install.sh', 'prompts/real-turn.md', 'schema/real-family.schema.json'
];

export function realFingerprint(root) {
  return Object.fromEntries(REAL_PIPELINE_SOURCES.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
