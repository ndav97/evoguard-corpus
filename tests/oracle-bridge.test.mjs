// Integración instrumental del oráculo con el runner simulado (etapa independent_oracle).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runTask } from '../runner/execution/engine.mjs';
import { openCalibrationSession } from '../runner/oracle/evaluate.mjs';
import { createOracleStage, withOracle } from '../runner/oracle/bridge.mjs';

const policy = JSON.parse(readFileSync(new URL('../config/policy.json', import.meta.url)));
const calibration = query => {
  const url = new URL('./fixtures/catalog-complete.html', import.meta.url);
  url.search = query;
  return url;
};

// Cada proveedor "entrega" la página de calibración indicada en su workspace (instrumental, sin modelos).
function harness(pageFor) {
  const spaces = [];
  const seen = [];
  const privateReports = [];
  const oracle = createOracleStage({
    version: 'V0',
    openSession: workspace => openCalibrationSession(calibration(workspace.page)),
    onPrivateReport: report => privateReports.push(report)
  });
  const options = {
    mode: 'simulation', policy, initialProvider: 'openai',
    packet: { version: 'V0', requirements: [{ id: 'R001' }, { id: 'R002' }] },
    adapter: { async next(ctx) { seen.push(JSON.stringify(ctx)); return ctx.cycle === 1 ? { type: 'tool', argv: ['write'] } : { type: 'deliver' }; } },
    evaluator: withOracle({ async check() { return { status: 'PASS' }; } }, oracle),
    workspaces: {
      async open({ provider } = {}) {
        const w = { provider: null, page: null, closed: false, async exec() { return { status: 'PASS', output: 'ok' }; }, async snapshot() { return this.page; }, async close() { this.closed = true; } };
        spaces.push(w);
        w.page = pageFor(spaces.length - 1);
        return w;
      }
    }
  };
  return { options, spaces, seen, privateReports };
}

test('un candidato defectuoso se rechaza sin feedback y se reasigna; el correcto se acepta', async () => {
  const h = harness(index => (index === 0 ? '?version=V0&mutant=or' : '?version=V0'));
  const result = await runTask(h.options);
  assert.equal(result.status, 'SIMULATED_ACCEPTED');
  assert.deepEqual(result.attempts.map(a => [a.provider, a.validation.independent_oracle, a.outcome]), [['openai', 'FAIL', 'REASSIGN'], ['anthropic', 'PASS', 'SIMULATED_ACCEPTED']]);
  assert.ok(h.spaces.every(space => space.closed));
  // El detalle del oráculo solo existe en el informe privado; nunca en el contexto del constructor ni en eventos.
  assert.ok(h.privateReports[0].report.results.some(r => r.id === 'R001-A05' && r.status === 'FAIL'));
  const visible = h.seen.join('\n') + JSON.stringify(result.events);
  assert.doesNotMatch(visible, /R00\d-A\d\d|checks|observed/);
});

test('un fallo de infraestructura del oráculo se informa como INFRA_ERROR, no como FAIL del candidato', async () => {
  const stage = createOracleStage({ version: 'V0', openSession: async () => { throw new Error('navegador no disponible'); } });
  assert.deepEqual(await stage({}), { status: 'INFRA_ERROR' });
});

test('el resultado público del oráculo solo contiene el estado', async () => {
  const stage = createOracleStage({ version: 'V0', openSession: () => openCalibrationSession(calibration('?version=V0')) });
  assert.deepEqual(await stage({}), { status: 'PASS' });
});
