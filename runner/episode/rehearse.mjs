// Ensayo del ejecutor de episodios con una familia real y un agente guionado (sin modelos), en Docker.
// Uso: npm run episode:rehearse -- S001
// Cuatro escenarios con resultado conocido, cada uno un episodio completo con el oráculo real:
//   ideal:        cada turno aplica su parche de referencia               → todos aprobados, episodio exitoso
//   sin_entrega:  el turno 2 aplica su cambio pero agota los ciclos sin entregar; el 3 continúa desde ese código
//                 → T2 falla «sin entrega» (sin regresión) y T3 aprueba: el encadenado conserva el trabajo no entregado
//   regresion:    el turno 2 deshace el cambio de T1 y entrega; el 3 rehace    → T2 falla por regresión
//   head_movido:  en cada turno el agente hace su propio git commit antes de entregar → todos aprobados y la
//                 historia se reproduce por hash (el parche se calcula respecto de la base del turno)
// Escribe docs/verification/episode-rehearsal.json, que el ejecutor exige antes de medir con modelos.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRealFamily, realVersions } from '../real/families.mjs';
import { readBases } from '../real/prepare.mjs';
import { docker } from '../sandbox/docker.mjs';
import { runEpisode, episodeFingerprint } from './run.mjs';

const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

// Acciones guionadas por turno (posición 1..n) para cada escenario.
export function scenarios(n) {
  const apply = (...turns) => ({ kind: 'apply', turns });
  const rest = from => Array.from({ length: Math.max(0, n - from + 1) }, (_, i) => apply(from + i));
  const nulls = Array(n).fill(null);
  return {
    ideal: {
      plan: Array.from({ length: n }, (_, i) => apply(i + 1)),
      expected: { passes: Array(n).fill(true), success: true, cpt: n, regression: false, failures: nulls }
    },
    sin_entrega: {
      plan: [apply(1), { kind: 'stall', turns: [2] }, ...rest(3)],
      expected: { passes: [true, false, ...Array(n - 2).fill(true)], success: false, cpt: 1, regression: false, failures: [null, 'not_delivered', ...Array(n - 2).fill(null)] }
    },
    regresion: {
      plan: [apply(1), { kind: 'revert', turns: [1] }, apply(1, 2, 3), ...rest(4)],
      expected: { passes: [true, false, ...Array(n - 2).fill(true)], success: false, cpt: 1, regression: true, failures: [null, 'regression', ...Array(n - 2).fill(null)] }
    },
    head_movido: {
      plan: Array.from({ length: n }, (_, i) => ({ kind: 'apply', turns: [i + 1], commit: true })),
      expected: { passes: Array(n).fill(true), success: true, cpt: n, regression: false, failures: nulls }
    }
  };
}

// Adaptador guionado: una acción `tool` por parche (git apply, o -R para deshacer), un commit propio si el
// escenario lo pide, y deliver. «stall» aplica sus parches y después lee la zona del cambio hasta agotar los
// 25 ciclos sin entregar.
export function scriptedAdapter(data, step) {
  const m = data.manifest;
  const dir = m.package_path === '.' ? '' : ` --directory='${m.package_path}'`;
  const patchOf = turn => data.turns[turn - 1].patchText.replace(/\n+$/, '');
  const tool = (turn, reverse) => ({ type: 'tool', argv: ['sh', '-c', `git apply${dir}${reverse ? ' -R' : ''} --whitespace=nowarn - <<'EVOGUARD_PATCH'\n${patchOf(turn)}\nEVOGUARD_PATCH`] });
  const commit = { type: 'tool', argv: ['sh', '-c', "git add -A && git -c user.name=agente -c user.email=agente@ejemplo.invalid -c core.hooksPath=/dev/null commit --no-verify -q -m 'cambio del agente'"] };
  const work = [...step.turns.map(t => tool(t, step.kind === 'revert')), ...(step.commit ? [commit] : [])];
  const actions = step.kind === 'stall' ? null : [...work, { type: 'deliver' }];
  return {
    async next(context) {
      if (!actions) return context.cycle <= work.length ? work[context.cycle - 1] : { type: 'read_file', path: m.focus };
      return actions[Math.min(context.cycle, actions.length) - 1];
    }
  };
}

export async function rehearseEpisodes(root, familyId, { only } = {}) {
  const data = loadRealFamily(root, familyId);
  const base = readBases(root).bases[familyId];
  if (!base || base.status !== 'VERIFIED') throw new Error(`${familyId}: imagen sin verificar (npm run real:prepare -- ${familyId})`);
  docker(['image', 'inspect', base.image_id]);
  const n = realVersions(data.manifest).length;
  const experiment = `ensayo-episodios-${Date.now()}`;
  const report = { artifact_type: 'episode_rehearsal', family_id: familyId, image_id: base.image_id, experiment, started_at: new Date().toISOString(), scenarios: {} };
  let repetition = 0;
  for (const [name, scenario] of Object.entries(scenarios(n))) {
    if (only && !only.includes(name)) continue;
    repetition++;
    log(`Escenario ${name}`);
    const result = await runEpisode({
      root, data, base, provider: 'openai', arm: 'B', experiment, phase: 'ensayo', repetition, rehearsal: true,
      adapterFor: ({ position }) => scriptedAdapter(data, scenario.plan[position - 1]), say: log
    });
    const s = result.summary;
    const observed = { status: result.status, passes: s.passes ?? null, success: s.success ?? null, cpt: s.cpt ?? null, regression: s.regression ?? null, failures: s.turns?.map(t => t.failure) ?? null };
    const expected = { status: 'COMPLETE', ...scenario.expected };
    // El turno sin entrega debe terminar por agotar los ciclos (no por tiempo ni infraestructura).
    const stall = scenario.plan.findIndex(p => p.kind === 'stall');
    const reasons = result.records.map(r => r.failure_reason);
    // En head_movido, el agente movió HEAD en cada turno y aun así la historia se reprodujo (todos aprobados).
    const moved = result.records.map(r => r.head_moved);
    const ok = JSON.stringify(observed) === JSON.stringify(expected) && (stall < 0 || reasons[stall] === 'CYCLE_LIMIT')
      && (name !== 'head_movido' || moved.every(Boolean)) && (name !== 'sin_entrega' || result.records[1].patch_bytes > 0);
    report.scenarios[name] = { ok, expected, observed, failure_reasons: reasons, head_moved: moved, dir: result.dir.slice(root.length) };
    log(`${name}: ${ok ? 'PASS' : `FALLA\n  esperado ${JSON.stringify(expected)}\n  obtenido ${JSON.stringify(observed)} (motivos ${JSON.stringify(reasons)})`}`);
  }
  report.status = Object.values(report.scenarios).every(s => s.ok) && Object.keys(report.scenarios).length === (only ? only.length : 4) ? 'PASS' : 'FAIL';
  report.finished_at = new Date().toISOString();
  report.sources_sha256 = episodeFingerprint(root);
  if (!only) writeFileSync(join(root, 'docs/verification/episode-rehearsal.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const [familyId, ...rest] = process.argv.slice(2);
  if (!/^S\d{3}$/.test(familyId ?? '')) { console.error('Uso: npm run episode:rehearse -- Sxxx [--only ideal,sin_entrega,regresion,head_movido]'); process.exit(2); }
  const only = rest[0] === '--only' ? rest[1]?.split(',') : undefined;
  rehearseEpisodes(root, familyId, { only })
    .then(report => { log(`${report.status}: ensayo del ejecutor de episodios con ${familyId}${only ? ' (parcial, sin evidencia)' : ' → docs/verification/episode-rehearsal.json'}`); process.exitCode = report.status === 'PASS' ? 0 : 1; })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}
