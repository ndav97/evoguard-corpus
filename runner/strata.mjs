// Estratos del corpus (config/strata.json). Decisión del 2026-10-02: el corpus se construye solo con el estrato
// semi-real (repositorios públicos con cambios controlados, families-real/). El estrato sintético (F001–F010) queda
// archivado en archive/sintetico/: se conserva con su historia y evidencia, pero no se genera ni forma parte del corpus.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SYNTHETIC_ROOT = 'archive/sintetico';

export function loadStrata(root) {
  return JSON.parse(readFileSync(join(root, 'config/strata.json'), 'utf8'));
}

export function syntheticArchived(root) {
  return loadStrata(root).synthetic?.status === 'ARCHIVED';
}
