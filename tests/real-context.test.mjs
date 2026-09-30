import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { measure } from '../runner/real/context-check.mjs';
import { loadRealFamily, makeRealPacket } from '../runner/real/families.mjs';
import { loadContextPolicy } from '../runner/context/policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('repositorio grande: a 8k solo cabe el directorio de la zona; a 32k cabe la vista completa', () => {
  const data = loadRealFamily(root, 'S005');
  const focus = data.manifest.focus;
  const dir = focus.slice(0, focus.lastIndexOf('/') + 1);
  const files = [...Array.from({ length: 700 }, (_, i) => `frontend/src/components/module-${i}/component-file-${i}.tsx`), `${dir}Other.tsx`, focus];
  const overview = { note: 'vista', files, contents: { [focus]: 'x'.repeat(5000) } };
  const policy = loadContextPolicy(new URL('../', import.meta.url));
  const [small, large] = measure(overview, makeRealPacket(data, 'V1'), policy, [[8192, 1024], [32768, 4096]]);
  assert.equal(small.fits, true);
  assert.match(small.level, /directorio de la zona/);
  assert.equal(large.level, 'completa');
  assert.ok(large.history_margin > 5000);
});
