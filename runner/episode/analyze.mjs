// Análisis de episodios: tabla por modelo al estilo de EvoGenUI-Bench (tabla 2) y comparación emparejada de cada
// brazo frente a B. Lee runs/episodes/<experimento>/**/turn.json (o .artifacts/episodes con --ensayo).
// Uso: npm run episode:analyze -- --experiment linea-base-piloto [--ensayo]
// Salida: runs/episodes/<experimento>/analisis/{resumen.md, modelos.csv, episodios.csv, comparaciones.csv}
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeEpisodes } from './metrics.mjs';

const pct = x => (x === null || x === undefined ? '—' : `${(100 * x).toFixed(1)} %`);
const ci = r => (r?.rate === null || r?.rate === undefined ? '—' : `${pct(r.rate)} [${pct(r.low)}–${pct(r.high)}]`);
const boot = b => (b?.mean === null || b?.mean === undefined ? '—' : `${pct(b.mean)} [${pct(b.low)}–${pct(b.high)}]`);
const pp = b => (b?.mean === null || b?.mean === undefined ? '—' : `${b.mean >= 0 ? '+' : ''}${(100 * b.mean).toFixed(1)} pp [${(100 * b.low).toFixed(1)}; ${(100 * b.high).toFixed(1)}]`);

// Registros de turno de un experimento; se ignoran los episodios interrumpidos (*.incompleto-*).
export function loadTurnRecords(dir) {
  const records = [];
  const walk = path => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (/\.incompleto-\d+$/.test(name) || name === 'analisis' || name === 'evaluator') continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'turn.json') records.push(JSON.parse(readFileSync(full, 'utf8')));
    }
  };
  if (existsSync(dir)) walk(dir);
  return records;
}

export function report(records, { names = {}, resamples = 10000, seed = 20261008, experiment = '' } = {}) {
  const { episodes, rows, comparisons } = analyzeEpisodes(records, { resamples, seed });
  const name = p => names[p] ?? p;
  const lines = [`# Episodios: ${experiment}`, '', `${records.length} turnos · ${episodes.filter(e => e.valid).length} episodios válidos · ${episodes.filter(e => !e.valid).length} incompletos o inválidos (excluidos)`, ''];
  // Registros producidos con distinto código o distintos modelos no son comparables sin declararlo.
  for (const [field, what] of [['code_sha256', 'versiones del código del ejecutor'], ['models_sha256', 'configuraciones de modelos']]) {
    const distinct = new Set(records.map(r => r[field]).filter(Boolean));
    if (distinct.size > 1) lines.push(`> **Aviso:** los registros mezclan ${distinct.size} ${what} (${field}). Revisar antes de usar los resultados.`, '');
  }
  for (const arm of [...new Set(rows.map(r => r.arm))]) {
    const list = rows.filter(r => r.arm === arm);
    const n = Math.max(...list.map(r => r.by_position.length));
    lines.push(`## Brazo ${arm}`, '', `| Modelo | Episodios (familias) | TP | **TP@${n} (episodios exitosos)** | TEE por familia | CPT | APR | TER (episodios con regresión) | Fallos de transición por regresión |`, '|---|---|---|---|---|---|---|---|---|');
    for (const r of [...list].sort((a, b) => (b.tp_at_n.rate ?? -1) - (a.tp_at_n.rate ?? -1))) {
      const ft = r.failed_transitions;
      lines.push(`| ${name(r.provider)} | ${r.episodes} (${r.families}) | ${ci(r.tp)} | **${ci(r.tp_at_n)}** | ${boot(r.tee_by_family)} | ${r.cpt ?? '—'} | ${ci(r.apr)} | ${ci(r.ter)} | ${ft.n ? `${ft.regression}/${ft.n} (${pct(ft.regression / ft.n)})` : '—'} |`);
    }
    lines.push('', `Aprobación por posición del turno y estimación independiente (producto de las tasas por posición):`, '', `| Modelo | ${Array.from({ length: n }, (_, i) => `T${i + 1}`).join(' | ')} | Independiente | Observado |`, `|---|${'---|'.repeat(n + 2)}`);
    for (const r of list) lines.push(`| ${name(r.provider)} | ${r.by_position.map(p => pct(p.rate)).join(' | ')} | ${pct(r.independence_estimate)} | ${pct(r.tp_at_n.rate)} |`);
    lines.push('', 'Turnos no aprobados por causa:', '', '| Modelo | No aprobados | Regresión | Requisito nuevo | Sin entrega | Otra (alcance, tipos) | Satisfacción nueva | Retención |', '|---|---|---|---|---|---|---|---|');
    for (const r of list) { const f = r.failed_turns; lines.push(`| ${name(r.provider)} | ${f.n} | ${f.regression} | ${f.new_requirement} | ${f.not_delivered} | ${f.other} | ${ci(r.new_requirement)} | ${pct(r.retention)} |`); }
    // Turnos sin entrega por motivo, y turnos medidos como fallo total por el código del agente.
    const armRecords = records.filter(x => x.arm === arm && !x.infra_error);
    const reasons = [...new Set(armRecords.filter(x => !x.delivered).map(x => x.failure_reason ?? 'desconocido'))].sort();
    const causes = [...new Set(armRecords.map(x => x.oracle?.cause).filter(Boolean))].sort();
    if (reasons.length || causes.length) {
      lines.push('', 'Turnos sin entrega por motivo y turnos que no se pudieron medir por el código del agente:', '', `| Modelo | ${[...reasons, ...causes].join(' | ')} | Con reintentos de transporte | Con HEAD movido |`, `|---|${'---|'.repeat(reasons.length + causes.length + 2)}`);
      for (const r of list) {
        const own = armRecords.filter(x => x.provider === r.provider);
        lines.push(`| ${name(r.provider)} | ${[...reasons.map(k => own.filter(x => !x.delivered && (x.failure_reason ?? 'desconocido') === k).length), ...causes.map(k => own.filter(x => x.oracle?.cause === k).length)].join(' | ')} | ${own.filter(x => x.transport_retries > 0).length} | ${own.filter(x => x.head_moved).length} |`);
      }
    }
    lines.push('');
  }
  // Costo por modelo y brazo (comerciales: tokens × precios; locales: horas de GPU).
  const costRows = rows.map(r => {
    const own = records.filter(x => x.arm === r.arm && x.provider === r.provider);
    const usd = own.reduce((t, x) => t + (Number.isFinite(x.cost_usd) ? x.cost_usd : 0), 0);
    const hours = own.reduce((t, x) => { const h = (Date.parse(x.finished_at) - Date.parse(x.started_at)) / 3600000; return t + (h > 0 ? h : 0); }, 0);
    const cached = own.reduce((t, x) => t + (x.tokens?.cached ?? 0), 0), input = own.reduce((t, x) => t + (x.tokens?.input ?? 0), 0);
    return { arm: r.arm, provider: r.provider, turns: own.length, usd, hours, cached_share: input ? cached / input : null, unknown: own.reduce((t, x) => t + (x.cost_unknown_calls ?? 0), 0) };
  });
  if (costRows.length) {
    lines.push('## Costo y tiempo', '', '| Brazo | Modelo | Turnos | Costo (USD) | USD por turno | Horas | Min por turno | Entrada cacheada | Llamadas sin tokens |', '|---|---|---|---|---|---|---|---|---|');
    for (const c of costRows) lines.push(`| ${c.arm} | ${name(c.provider)} | ${c.turns} | ${c.usd.toFixed(2)} | ${c.turns ? (c.usd / c.turns).toFixed(3) : '—'} | ${c.hours.toFixed(1)} | ${c.turns ? ((60 * c.hours) / c.turns).toFixed(1) : '—'} | ${pct(c.cached_share)} | ${c.unknown} |`);
    lines.push('', 'Los modelos locales no tienen costo por token: su costo es el de la GPU durante sus horas (npm run episode:budget).', '');
  }
  if (comparisons.length) {
    lines.push('## Comparación emparejada por familia (frente a B)', '', '| Brazo | Modelo | Familias | Δ TEE = TEE(brazo) − TEE(B) | ΔR = TER(B) − TER(brazo) |', '|---|---|---|---|---|');
    for (const c of comparisons) lines.push(`| ${c.arm} | ${name(c.provider)} | ${c.families}${c.missing.length ? ` (faltan ${c.missing.join(', ')})` : ''} | ${pp(c.delta_tee)} | ${pp(c.delta_ter)} |`);
    lines.push('');
  }
  lines.push('Definiciones: docs/diseno-linea-base-episodios.md. Intervalos: Wilson al 95 % (agregados) y bootstrap de familias completas (TEE por familia y Δ).', '');
  const csv = list => (list.length ? [Object.keys(list[0]).join(','), ...list.map(row => Object.values(row).map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v ?? '')).map(v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','))].join('\n') + '\n' : '');
  const flat = rows.map(r => ({
    experiment: r.experiment, phase: r.phase, arm: r.arm, provider: r.provider, model: name(r.provider), episodes: r.episodes, families: r.families, turns: r.turns,
    tp: r.tp.rate, tp_low: r.tp.low, tp_high: r.tp.high, tp_at_n: r.tp_at_n.rate, tp_at_n_low: r.tp_at_n.low, tp_at_n_high: r.tp_at_n.high,
    tee_family: r.tee_by_family.mean, tee_family_low: r.tee_by_family.low, tee_family_high: r.tee_by_family.high,
    cpt: r.cpt, apr: r.apr.rate, apr_low: r.apr.low, apr_high: r.apr.high, ter: r.ter.rate, ter_low: r.ter.low, ter_high: r.ter.high,
    failed_transitions: r.failed_transitions.n, failed_transitions_regression: r.failed_transitions.regression,
    new_requirement: r.new_requirement.rate, retention: r.retention, independence_estimate: r.independence_estimate
  }));
  const episodeRows = episodes.map(e => ({ arm: e.arm, provider: e.provider, family_id: e.family_id, episode: e.episode, repetition: e.repetition, valid: e.valid, passes: e.passes ? e.passes.map(p => (p ? 1 : 0)).join('') : '', success: e.success ?? '', cpt: e.cpt ?? '', regression: e.regression ?? '', problems: e.problems.join('; ') }));
  const comparisonRows = comparisons.map(c => ({ arm: c.arm, provider: c.provider, families: c.families, delta_tee: c.delta_tee.mean, delta_tee_low: c.delta_tee.low, delta_tee_high: c.delta_tee.high, delta_ter: c.delta_ter.mean, delta_ter_low: c.delta_ter.low, delta_ter_high: c.delta_ter.high, missing: c.missing.join(' ') }));
  return { markdown: lines.join('\n'), files: { 'modelos.csv': csv(flat), 'episodios.csv': csv(episodeRows), 'comparaciones.csv': csv(comparisonRows) } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const experiment = args[args.indexOf('--experiment') + 1];
  if (!args.includes('--experiment') || !/^[A-Za-z0-9._-]+$/.test(experiment ?? '')) { console.error('Uso: npm run episode:analyze -- --experiment <nombre> [--ensayo]'); process.exit(2); }
  const dir = join(root, args.includes('--ensayo') ? '.artifacts/episodes' : 'runs/episodes', experiment);
  const config = JSON.parse(readFileSync(join(root, 'config/experiment.json'), 'utf8')).analysis;
  const models = JSON.parse(readFileSync(join(root, 'config/models.json'), 'utf8')).models;
  const names = Object.fromEntries(Object.entries(models).map(([p, c]) => [p, c.display_name]));
  const records = loadTurnRecords(dir);
  if (!records.length) { console.error(`Sin registros de turno en ${dir}`); process.exit(1); }
  const { markdown, files } = report(records, { names, resamples: config.bootstrap_resamples, seed: config.seed, experiment });
  const out = join(dir, 'analisis');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'resumen.md'), markdown);
  for (const [file, text] of Object.entries(files)) writeFileSync(join(out, file), text);
  console.log(markdown);
  console.log(`→ ${out}`);
}
