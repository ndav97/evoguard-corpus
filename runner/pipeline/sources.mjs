// Código que el ensayo integral ejercita. Su huella queda en docs/verification/pipeline-rehearsal.json;
// si cambia cualquiera de estos archivos, el preflight exige repetir `npm run pipeline:rehearse`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const PIPELINE_SOURCES = [
  'runner/execution/engine.mjs', 'runner/protocol/actions.mjs', 'runner/protocol/execute.mjs', 'config/protocol.json', 'runner/context/policy.mjs', 'runner/providers/adapter.mjs',
  'runner/pipeline/workspace.mjs', 'runner/pipeline/evaluator.mjs', 'runner/pipeline/architecture.mjs', 'runner/pipeline/store.mjs', 'runner/pipeline/rehearse.mjs',
  'runner/oracle/evaluate.mjs', 'runner/oracle/spec.mjs', 'runner/oracle/generic-adapter.mjs', 'runner/oracle/families/index.mjs', 'runner/oracle/families/F001/index.mjs', 'runner/oracle/families/F001/spec-lock.json',
  'runner/oracle/plans.mjs', 'runner/oracle/reference.mjs', 'runner/oracle/ui-adapter.mjs', 'runner/oracle/remote.mjs', 'runner/oracle/container.mjs', 'runner/families.mjs',
  'runner/sandbox/docker.mjs', 'runner/sandbox/policy.mjs', 'runner/sandbox/lineage.mjs', 'runner/sandbox/seed-init.mjs'
];

export function pipelineFingerprint(root) {
  return Object.fromEntries(PIPELINE_SOURCES.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
}
