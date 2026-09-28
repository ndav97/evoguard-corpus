// Evaluador real del pipeline para runTask (etapas en el orden del motor).
// - typecheck, build y development_tests: comandos fijos del pipeline dentro del contenedor del candidato
//   (no dependen de los scripts de package.json); su salida es el único feedback visible para reparar.
// - independent_oracle: el build estático (dist) se evalúa en un contenedor de oráculo nuevo y aislado.
// - architecture: análisis estático del árbol exportado.
// Los detalles del oráculo y de arquitectura van solo a privateSink; el motor recibe únicamente el estado.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runOracleInContainer } from '../oracle/container.mjs';
import { checkArchitecture } from './architecture.mjs';
import { PROTOCOL_CONFIG } from '../protocol/execute.mjs';
import { familyDir } from '../families.mjs';

// Mismos comandos que la acción run_checks del protocolo (config/protocol.json): una sola fuente de verdad.
export const VISIBLE_COMMANDS = PROTOCOL_CONFIG.check_commands;

export function architectureBaseline(root, familyId = 'F001') {
  const dir = familyDir(root, familyId);
  const family = JSON.parse(readFileSync(join(root, dir, 'family.yaml'), 'utf8'));
  return {
    packageJson: readFileSync(join(root, 'templates/react-vite/package.json'), 'utf8'),
    packageLock: readFileSync(join(root, 'templates/react-vite/package-lock.json'), 'utf8'),
    fixturePath: family.fixture.path,
    fixtureSha256: family.fixture.sha256,
    profile: family.structural_profile
  };
}

export function createPipelineEvaluator({ root, version, familyId = 'F001', privateSink = () => {}, oracle = runOracleInContainer, baseline = architectureBaseline(root, familyId) }) {
  return {
    async check(stage, workspace, { timeout = 600000 } = {}) {
      if (VISIBLE_COMMANDS[stage]) {
        const outcome = await workspace.exec(VISIBLE_COMMANDS[stage], { timeout });
        if (outcome.status === 'TIMEOUT') return { status: 'TIMEOUT' };
        if (outcome.status === 'INFRA_ERROR') return { status: 'INFRA_ERROR' };
        return { status: outcome.status, feedback: `$ ${VISIBLE_COMMANDS[stage].join(' ')}\n${outcome.output}` };
      }
      if (stage === 'independent_oracle') {
        let dist;
        try { dist = await workspace.exportTree('dist', { exclude: [], timeout: Math.min(timeout, 120000) }); }
        catch (error) {
          const candidate = /enlace no permitido|tipo no permitido|demasiados archivos|demasiado grande/.test(error.message);
          await privateSink({ stage, ...(candidate ? { status: 'FAIL', reason: error.message.slice(0, 1000) } : { infra_error: error.message.slice(0, 1000) }) });
          return { status: candidate ? 'FAIL' : 'INFRA_ERROR' };
        }
        // Sin build exportable el candidato no es evaluable: rechazo del candidato, no infraestructura.
        if (!dist || !dist['index.html']) { await privateSink({ stage, status: 'FAIL', reason: 'build sin dist/index.html' }); return { status: 'FAIL' }; }
        try {
          const report = oracle(root, version, dist, { timeout, familyId });
          await privateSink({ stage, status: report.status, report });
          return { status: report.status };
        } catch (error) {
          await privateSink({ stage, infra_error: error.message.slice(0, 4000) });
          return { status: 'INFRA_ERROR' };
        }
      }
      if (stage === 'architecture') {
        let files;
        try { files = await workspace.exportTree('.', { timeout: Math.min(timeout, 120000) }); }
        catch (error) {
          // Un árbol no exportable por enlaces, tipos o tamaño lo produce el candidato; lo demás es infraestructura.
          const candidate = /enlace no permitido|tipo no permitido|demasiados archivos|demasiado grande/.test(error.message);
          await privateSink({ stage, ...(candidate ? { status: 'FAIL', reason: error.message.slice(0, 1000) } : { infra_error: error.message.slice(0, 1000) }) });
          return { status: candidate ? 'FAIL' : 'INFRA_ERROR' };
        }
        const report = checkArchitecture(files ?? {}, baseline);
        await privateSink({ stage, status: report.status, report });
        return { status: report.status };
      }
      throw new Error(`Etapa desconocida: ${stage}`);
    }
  };
}
