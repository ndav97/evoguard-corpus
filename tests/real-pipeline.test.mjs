// Estrato semi-real sin Docker: control de alcance, detección de tests, informes de la suite y paquete visible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scopeCheck, TEST_FILE } from '../runner/real/pipeline.mjs';
import { parseReport, failing, signature, suiteCommand } from '../runner/real/suite.mjs';
import { dockerfile } from '../runner/real/prepare.mjs';
import { realRunArgs } from '../runner/real/docker.mjs';

const manifest = { package_path: 'ui', hidden_tests_dir: 'src/app/evoguard', runner: 'jest', known_failures: [] };
const diff = (path, extra = '') => `diff --git a/${path} b/${path}\n${extra}index 1..2 100644\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a\n+b\n`;

test('control de alcance: acepta código nuevo y tests nuevos', () => {
  const patch = diff('ui/src/app/x.tsx') + diff('ui/src/app/x.test.tsx', 'new file mode 100644\n');
  assert.deepEqual(scopeCheck(patch, { manifest, existingTests: new Set(['ui/src/app/old.test.tsx']) }), []);
});

test('control de alcance: rechaza dependencias, configuración, tests existentes y el directorio reservado', () => {
  const existingTests = new Set(['ui/src/app/old.test.tsx']);
  const text = patch => JSON.stringify(scopeCheck(patch, { manifest, existingTests }));
  assert.match(text(diff('ui/package.json')), /dependencias/);
  assert.match(text(diff('ui/pnpm-lock.yaml')), /dependencias/);
  assert.match(text(diff('ui/jest.config.js')), /configuración/);
  assert.match(text(diff('ui/src/app/old.test.tsx')), /tests existentes.*modificado/);
  assert.match(text(diff('ui/src/app/old.test.tsx', 'deleted file mode 100644\n')), /borrado/);
  assert.match(text(diff('ui/src/app/evoguard/T001.test.tsx', 'new file mode 100644\n')), /reservado/);
  assert.match(text(diff('.github/workflows/ci.yml')), /no permitido/);
  assert.match(text(diff('ui/src/link', 'new file mode 120000\n')), /enlace/);
});

test('detección de archivos de test', () => {
  for (const path of ['src/a.test.tsx', 'src/a.spec.js', 'src/__tests__/a.jsx', 'src/test-utils.tsx', 'src/__mocks__/x.js']) assert.ok(TEST_FILE.test(path), path);
  for (const path of ['src/testing.tsx', 'src/latest.ts', 'src/a.tsx']) assert.ok(!TEST_FILE.test(path), path);
});

test('informe de la suite: resultados por test, archivos que no compilan y firma estable', () => {
  const report = { numTotalTests: 3, numFailedTests: 1, testResults: [
    { name: '/workspace/repo/ui/src/a.test.tsx', status: 'failed', assertionResults: [{ fullName: 'a ok', status: 'passed' }, { fullName: 'a mal', status: 'failed' }] },
    { name: '/workspace/repo/ui/src/b.test.tsx', status: 'failed', message: 'SyntaxError', assertionResults: [] },
    { name: '/workspace/repo/ui/src/c.test.tsx', status: 'passed', assertionResults: [{ title: 'c', status: 'passed' }, { fullName: 'c todo', status: 'todo' }] }
  ] };
  const run = parseReport(report, '/workspace/repo/ui');
  assert.deepEqual(failing(run), ['src/a.test.tsx › a mal']);
  assert.deepEqual(run.suiteFailedFiles, ['src/b.test.tsx']);
  const shuffled = parseReport({ ...report, testResults: [...report.testResults].reverse() }, '/workspace/repo/ui');
  assert.equal(signature(run), signature(shuffled));
  assert.match(suiteCommand({ runner: 'vitest' }), /vitest run .*--reporter=json/);
  assert.match(suiteCommand({ runner: 'jest' }, ['src/x.test.tsx']), /jest --ci 'src\/x\.test\.tsx' --json/);
});

test('imagen y contenedores: V0 determinista, instalación con lockfile y aislamiento', () => {
  const text = dockerfile({ source: 'git' });
  assert.match(text, /git fetch -q --depth 1 "\$REPO_URL" "\$V0_COMMIT"/);
  assert.match(text, /test "\$\(git rev-parse FETCH_HEAD\)" = "\$V0_COMMIT"/);
  assert.match(text, /GIT_AUTHOR_DATE=2000-01-01T00:00:00Z/);
  assert.match(text, /test -z "\$\(git status --porcelain\)"/);
  const install = readFileSync(new URL('../docker/real/install.sh', import.meta.url), 'utf8');
  assert.match(install, /--frozen-lockfile/);
  assert.match(install, /npm ci/);
  const args = realRunArgs(`sha256:${'a'.repeat(64)}`, `evoguard-realbox-${'b'.repeat(32)}`, 'real-sandbox');
  for (const flag of ['--network=none', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=1000:1000', '--pull=never']) assert.ok(args.includes(flag), flag);
  assert.ok(args.includes('--env=HTTPS_PROXY='));
  assert.throws(() => realRunArgs('node:24', `evoguard-realbox-${'b'.repeat(32)}`, 'real-sandbox'), /digest/);
  assert.throws(() => realRunArgs(`sha256:${'a'.repeat(64)}`, 'otro', 'real-sandbox'), /administrado/);
});
