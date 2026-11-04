// Cambios neutros (2026-11-03): solo el hash exacto declarado, nunca para el ensayo general.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { neutralChanges, rehearsalCurrent } from '../runner/real/rehearsal-status.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('cambios neutros: bien formados y nunca aplicados al ensayo general', () => {
  const changes = neutralChanges(root);
  assert.ok(changes.length >= 1);
  for (const c of changes) assert.notEqual(c.from_sha256, c.to_sha256);
  const mini = rehearsalCurrent(root, '--mini');
  if (!mini.current) assert.doesNotMatch(mini.reason, /PASS vigente/);
});
