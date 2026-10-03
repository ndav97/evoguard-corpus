// Decisión del 2026-10-02: el corpus solo usa el estrato semi-real; el sintético queda archivado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStrata, syntheticArchived, SYNTHETIC_ROOT } from '../runner/strata.mjs';
import { listFamilies } from '../runner/families.mjs';
import { generationBlockers } from '../runner/preflight.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('estratos: solo el semi-real está activo y el sintético está archivado', () => {
  const strata = loadStrata(root);
  assert.deepEqual(strata.active, ['semi-real']);
  assert.equal(strata.synthetic.status, 'ARCHIVED');
  assert.equal(strata.synthetic.path, SYNTHETIC_ROOT);
  assert.ok(syntheticArchived(root));
  assert.ok(!existsSync(join(root, 'families')), 'families/ ya no existe en la raíz');
  assert.deepEqual(listFamilies(root).map(f => f.id), strata.synthetic.families);
  for (const f of listFamilies(root)) assert.ok(f.dir.startsWith(`${SYNTHETIC_ROOT}/families/`));
});

test('estratos: el preflight rechaza generar familias sintéticas', () => {
  for (const id of ['F001', 'F002']) assert.match(generationBlockers(root, id).join('\n'), /Estrato sintético archivado/);
});

test('estratos: el banco de modelos locales usa solo tareas semi-reales', () => {
  const bench = JSON.parse(readFileSync(join(root, 'config/local-bench.json'), 'utf8'));
  assert.ok(bench.tasks.length >= 4 && bench.tasks.every(t => /^S\d{3}:V[123]$/.test(t)));
});
