// Puente entre el oráculo y el runner (etapa independent_oracle).
// - Recibe una fábrica explícita de sesiones: openSession(workspace) -> { openAdapter(), close() }.
//   La apertura del candidato aislado (transporte de navegador hacia el contenedor) es responsabilidad
//   de esa fábrica; este módulo nunca ejecuta código candidato en el host.
// - El resultado público solo contiene status (PASS | FAIL | INFRA_ERROR); sin feedback ni detalle.
//   El informe completo se entrega únicamente a onPrivateReport (registro del evaluador).
import { readFileSync } from 'node:fs';
import { runSuite, VERSIONS } from './evaluate.mjs';

const POLICY = JSON.parse(readFileSync(new URL('../../config/policy.json', import.meta.url), 'utf8'));

export function createOracleStage({ version, openSession, onPrivateReport = () => {} }) {
  if (!VERSIONS.includes(version)) throw new Error(`Versión desconocida: ${version}`);
  if (typeof openSession !== 'function') throw new Error('Se requiere una fábrica de sesiones del candidato');
  return async function check(workspace) {
    let session;
    try {
      session = await openSession(workspace);
      if (typeof session?.openAdapter !== 'function') throw new Error('Sesión de candidato inválida');
      const report = await runSuite(version, () => session.openAdapter());
      await onPrivateReport({ version, report });
      return { status: report.status };
    } catch (error) {
      await onPrivateReport({ version, infra_error: error.message });
      return { status: 'INFRA_ERROR' };
    } finally {
      try { await session?.close?.(); } catch { /* el cierre fallido se detecta en la limpieza del sandbox */ }
    }
  };
}

// Compone el evaluador del runner: delega independent_oracle al oráculo y el resto al evaluador visible.
export function withOracle(visibleEvaluator, oracleStage) {
  if (typeof visibleEvaluator?.check !== 'function' || typeof oracleStage !== 'function') throw new Error('Evaluadores inválidos');
  return {
    async check(stage, workspace, options) {
      return stage === 'independent_oracle' ? oracleStage(workspace, options) : visibleEvaluator.check(stage, workspace, options);
    }
  };
}

// Estabilidad exigida por la política: N ejecuciones completas con veredictos idénticos y todos PASS.
export async function stabilityCheck(version, runOnce, runs = POLICY.oracle_stability_runs) {
  if (!Number.isInteger(runs) || runs < 1) throw new Error('Número de ejecuciones inválido');
  const outcomes = [];
  for (let run = 0; run < runs; run++) {
    const report = await runOnce(version);
    outcomes.push(Object.fromEntries(report.results.map(result => [result.id, result.status])));
  }
  const first = JSON.stringify(outcomes[0]);
  const identical = outcomes.every(outcome => JSON.stringify(outcome) === first);
  const allPass = outcomes.every(outcome => Object.values(outcome).every(status => status === 'PASS'));
  return { version, runs, identical, status: identical && allPass ? 'STABLE' : 'UNSTABLE', outcomes };
}
