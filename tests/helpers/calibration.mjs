// Calibración E2E del oráculo de una familia (F002+) sobre Chromium real con su página de calibración:
// tests/fixtures/calibration/<Fxxx>.html (?version=V0..V3 limita funcionalidades; ?mutant=<defecto> introduce un error)
// y tests/fixtures/calibration/<Fxxx>.json ({ mutants: { nombre: [casos que deben fallar] } }).
// Comprueba: fixture embebido idéntico; cada versión correcta pasa todos sus casos; la página de la versión anterior
// falla exactamente los casos del requisito nuevo; cada mutante es rechazado por sus casos; estabilidad 5/5 en V3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runSuiteOnPage, loadCases, casesFor, VERSIONS } from '../../runner/oracle/evaluate.mjs';
import { stabilityCheck } from '../../runner/oracle/bridge.mjs';
import { familyOracle } from '../../runner/oracle/families/index.mjs';

const ROOT = new URL('../../', import.meta.url);

export function calibrationSuite(family) {
  const page = (query = '') => {
    const url = new URL(`tests/fixtures/calibration/${family}.html`, ROOT);
    url.search = query;
    return url;
  };
  const config = JSON.parse(readFileSync(new URL(`tests/fixtures/calibration/${family}.json`, ROOT), 'utf8'));
  const run = (version, query) => runSuiteOnPage(version, page(query), { family, timeout: config.timeout ?? 3000 });
  const failing = report => report.results.filter(result => result.status !== 'PASS').map(result => result.id);
  const cases = loadCases(ROOT, family);

  test(`${family}: la página de calibración embebe exactamente el fixture de la familia`, () => {
    const dir = readdirSync(new URL('families/', ROOT)).find(name => name.startsWith(`${family}-`));
    const fixture = JSON.parse(readFileSync(new URL(`families/${dir}/${familyOracle(family).FIXTURE}`, ROOT), 'utf8'));
    const html = readFileSync(page(), 'utf8');
    const embedded = JSON.parse(html.match(/const FIXTURE = ([\s\S]*?);\n/)[1]);
    assert.deepEqual(embedded, fixture);
  });

  for (const version of VERSIONS) {
    test(`${family} ${version}: la implementación de calibración correcta pasa todos los casos aplicables`, async () => {
      const report = await run(version, `?version=${version}`);
      assert.equal(report.status, 'PASS', JSON.stringify(report.results.filter(r => r.status !== 'PASS'), null, 1));
      assert.equal(report.total, casesFor(version, cases).length);
    });
  }

  test(`${family}: la versión anterior falla exactamente los casos del requisito nuevo`, async () => {
    for (const [index, version] of VERSIONS.entries()) {
      if (!index) continue;
      const report = await run(version, `?version=${VERSIONS[index - 1]}`);
      const introduced = `R00${index + 2}`;
      assert.deepEqual(failing(report), cases.filter(spec => spec.requirement === introduced).map(spec => spec.id), `${VERSIONS[index - 1]} evaluada como ${version}`);
    }
  });

  test(`${family}: cada mutante es rechazado por los casos que le corresponden`, async () => {
    assert.ok(Object.keys(config.mutants).length >= 8, 'se esperan al menos 8 mutantes');
    const covered = new Set(Object.values(config.mutants).flat().map(id => id.slice(0, 4)));
    for (const requirement of ['R001', 'R002', 'R003', 'R004', 'R005']) assert.ok(covered.has(requirement), `ningún mutante para ${requirement}`);
    for (const [mutant, killers] of Object.entries(config.mutants)) {
      const report = await run('V3', `?version=V3&mutant=${mutant}`);
      assert.equal(report.status, 'FAIL', mutant);
      const failed = failing(report);
      for (const id of killers) assert.ok(failed.includes(id), `${mutant} debería fallar ${id}; fallaron ${failed.join(', ')}`);
    }
  });

  test(`${family}: estabilidad 5/5 del oráculo en V3 (policy.oracle_stability_runs)`, async () => {
    const result = await stabilityCheck('V3', version => run(version, `?version=${version}`));
    assert.equal(result.runs, 5);
    assert.equal(result.status, 'STABLE');
  });
}
