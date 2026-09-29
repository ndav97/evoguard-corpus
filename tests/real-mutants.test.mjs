import test from 'node:test';
import assert from 'node:assert/strict';
import { addedLines, selectMutants } from '../runner/real/mutants.mjs';

const patch = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -3,2 +3,6 @@ export const x = 1;
 const keep = 2;
+export const limit = (n: number) => n >= 3 && n < 10;
+export function label(n: number) {
+  return n > 1 ? 'Varios' : 'Uno';
+}
diff --git a/src/a.test.ts b/src/a.test.ts
--- /dev/null
+++ b/src/a.test.ts
@@ -0,0 +1 @@
+it('x', () => { expect(1 === 1).toBe(true); });
`;

test('líneas añadidas con su número en el archivo nuevo, sin archivos de test', () => {
  assert.deepEqual(addedLines(patch).map(l => [l.file, l.line]), [['src/a.ts', 4], ['src/a.ts', 5], ['src/a.ts', 6], ['src/a.ts', 7]]);
});

test('un mutante por línea con el primer operador aplicable y reparto determinista', () => {
  const all = selectMutants(addedLines(patch), 10);
  assert.deepEqual(all.map(m => [m.line, m.operator]), [[4, 'relacional'], [6, 'relacional']]);
  assert.equal(all[0].mutated, 'export const limit = (n: number) => n < 3 && n < 10;');
  assert.equal(selectMutants(addedLines(patch), 1).length, 1);
});
