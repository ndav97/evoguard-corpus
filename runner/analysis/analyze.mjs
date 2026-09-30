// Análisis de la generación del corpus (tarea 8 de docs/progreso-tareas-sin-modelos.md).
// Uso: npm run analysis [-- --runs=<dir>] [--out=<dir>]
// Lee los registros públicos de runs/corpus-generation/<familia>/<versión>/<tarea>/ (summary.json, attempts/*/
// generation.json, calls.jsonl, events.jsonl) y produce en analysis/ (por defecto):
//   tasks.csv      una fila por tarea (familia, estrato, versión, estado, proveedor inicial y aceptado, intentos)
//   attempts.csv   una fila por intento (proveedor, modelo, asignación, reparación, resultado, etapa que falla,
//                  ciclos, duración, tokens, llamadas, salidas inválidas y normalizaciones)
//   calls.csv      una fila por llamada al modelo
//   summary.json   métricas por proveedor y estrato, con intervalos de Wilson al 95 %
//   summary.md     las mismas métricas en tablas legibles
//   report.html    informe autocontenido con gráficos (tasa e intervalo por modelo) y las tablas
// No lee registros privados del evaluador (evaluator/runs) ni necesita modelos.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGES = ['typecheck', 'build', 'development_tests', 'independent_oracle', 'architecture'];
const PROVIDERS = ['openai', 'anthropic', 'google', 'local_a', 'local_b'];
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const readJsonl = path => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : []);
const dirs = path => (existsSync(path) ? readdirSync(path).filter(name => statSync(join(path, name)).isDirectory()).sort() : []);
export const stratumOf = familyId => (familyId.startsWith('S') ? 'semi-real' : 'sintético');

// Intervalo de Wilson al 95 % para k éxitos en n ensayos.
export function wilson(k, n, z = 1.96) {
  if (!n) return { rate: null, low: null, high: null };
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return { rate: +p.toFixed(4), low: +Math.max(0, centre - margin).toFixed(4), high: +Math.min(1, centre + margin).toFixed(4) };
}

// Carga una tarea: resumen, intentos con su generation.json, llamadas y eventos.
export function loadTask(dir) {
  const summary = readJson(join(dir, 'summary.json'));
  const calls = readJsonl(join(dir, 'calls.jsonl'));
  const events = readJsonl(join(dir, 'events.jsonl'));
  const assignments = new Map();
  for (const event of events) if (event.type === 'assignment') assignments.set(event.sequence, event);
  const attempts = (summary.attempts ?? []).map((entry, index) => {
    const path = join(dir, 'attempts', entry.id, 'generation.json');
    const record = existsSync(path) ? readJson(path) : {};
    const finished = events.find(e => e.type === 'attempt_finished' && e.provider === entry.provider && e.attempt === entry.attempt && e.started_at === record.started_at) ?? null;
    return { ...entry, order: index + 1, record, assignment: finished?.assignment ?? null };
  });
  return { dir, summary, calls, events, attempts };
}

export function loadRuns(runsDir) {
  const tasks = [];
  for (const family of dirs(runsDir)) for (const version of dirs(join(runsDir, family))) for (const task of dirs(join(runsDir, family, version))) {
    const dir = join(runsDir, family, version, task);
    if (existsSync(join(dir, 'summary.json'))) tasks.push(loadTask(dir));
  }
  return tasks;
}

// Filas planas para los CSV.
export function rows(tasks) {
  const taskRows = [], attemptRows = [], callRows = [];
  for (const task of tasks) {
    const s = task.summary;
    const familyId = s.family_id, stratum = stratumOf(familyId);
    const accepted = task.attempts.find(a => a.outcome === 'ACCEPTED') ?? null;
    const initial = task.attempts[0]?.provider ?? null;
    taskRows.push({
      family_id: familyId, stratum, version: s.version, task_id: s.task_id, mode: s.mode, status: s.status,
      initial_provider: initial, accepted_provider: accepted?.provider ?? null, accepted_attempt: accepted?.id ?? null,
      attempts: task.attempts.length, providers_tried: new Set(task.attempts.map(a => a.provider)).size,
      first_try: Boolean(accepted && accepted.order === 1)
    });
    for (const attempt of task.attempts) {
      const r = attempt.record;
      const mine = task.calls.filter(c => c.provider === attempt.provider && c.attempt === attempt.attempt && (!r.started_at || c.started_at >= r.started_at) && (!r.finished_at || c.started_at <= r.finished_at));
      const count = predicate => mine.filter(predicate).length;
      const failedStage = STAGES.find(stage => attempt.validation?.[stage] === 'FAIL') ?? null;
      attemptRows.push({
        family_id: familyId, stratum, version: s.version, task_id: s.task_id, attempt_id: attempt.id, order: attempt.order,
        provider: attempt.provider, model: r.generator?.model ?? null, attempt: attempt.attempt, repair_count: r.repair_count ?? attempt.attempt - 1,
        outcome: attempt.outcome, failure_reason: attempt.failure_reason ?? null, failed_stage: failedStage,
        ...Object.fromEntries(STAGES.map(stage => [stage, attempt.validation?.[stage] ?? null])),
        cycles: r.cycles ?? null, duration_seconds: r.duration_seconds ?? null,
        // Tokens: suma de las llamadas del intento (algunos proveedores no los agregan en generation.json).
        input_tokens: mine.length ? sum(mine.map(c => c.tokens?.input)) : r.tokens?.input ?? null,
        output_tokens: mine.length ? sum(mine.map(c => c.tokens?.output)) : r.tokens?.output ?? null,
        reasoning_tokens: mine.length ? sum(mine.map(c => c.tokens?.reasoning)) : null,
        calls: mine.length, invalid_outputs: count(c => c.status !== 'PASS' && /^INVALID_ACTION/.test(c.error_code ?? '')),
        call_errors: count(c => c.status !== 'PASS'),
        normalized_fence: count(c => c.normalization === 'markdown_fence'),
        normalized_prose: count(c => String(c.normalization ?? '').startsWith('prose_prefix'))
      });
      for (const c of mine) callRows.push({
        family_id: familyId, stratum, version: s.version, task_id: s.task_id, attempt_id: attempt.id, provider: c.provider, cycle: c.cycle,
        observed_model: c.observed_model ?? null, status: c.status, error_code: c.error_code ?? null, normalization: c.normalization ?? null,
        action_type: c.action_type ?? null, duration_ms: c.duration_ms ?? null, input_tokens: c.tokens?.input ?? null, output_tokens: c.tokens?.output ?? null,
        reasoning_tokens: c.tokens?.reasoning ?? null
      });
    }
  }
  return { taskRows, attemptRows, callRows };
}

const median = values => {
  const v = values.filter(x => typeof x === 'number').sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};
const sum = values => values.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);

// Métricas por proveedor (y por estrato). Una «asignación» es la secuencia de intentos de un proveedor en una tarea
// (intento inicial y reparaciones) hasta que acepta o se reasigna.
export function metrics(taskRows, attemptRows, callRows) {
  const groups = {};
  const key = (provider, stratum) => `${provider}|${stratum}`;
  const strata = [...new Set(taskRows.map(t => t.stratum))];
  for (const stratum of strata.length > 1 ? ['todos', ...strata] : strata) for (const provider of PROVIDERS) {
    const attempts = attemptRows.filter(a => a.provider === provider && (stratum === 'todos' || a.stratum === stratum));
    const calls = callRows.filter(c => c.provider === provider && (stratum === 'todos' || c.stratum === stratum));
    const tasks = taskRows.filter(t => stratum === 'todos' || t.stratum === stratum);
    const assignments = new Map();
    for (const a of attempts) {
      const id = `${a.task_id}|${a.provider}`;
      const list = assignments.get(id) ?? [];
      list.push(a);
      assignments.set(id, list);
    }
    const assignmentList = [...assignments.values()];
    const acceptedAssignments = assignmentList.filter(list => list.some(a => a.outcome === 'ACCEPTED'));
    const initial = tasks.filter(t => t.initial_provider === provider);
    const reachedOracle = attempts.filter(a => a.independent_oracle && a.independent_oracle !== 'NOT_RUN');
    const failures = {};
    for (const a of attempts.filter(a => a.outcome !== 'ACCEPTED')) {
      const reason = a.failed_stage ?? a.failure_reason ?? 'desconocido';
      failures[reason] = (failures[reason] ?? 0) + 1;
    }
    const errors = {};
    for (const c of calls.filter(c => c.status !== 'PASS')) errors[c.error_code ?? 'desconocido'] = (errors[c.error_code ?? 'desconocido'] ?? 0) + 1;
    groups[key(provider, stratum)] = {
      provider, stratum,
      tasks_as_initial: initial.length,
      initial_accepted_first_try: wilson(initial.filter(t => t.first_try).length, initial.length),
      assignments: assignmentList.length,
      assignment_success: wilson(acceptedAssignments.length, assignmentList.length),
      accepted_without_repair: acceptedAssignments.filter(list => list.find(a => a.outcome === 'ACCEPTED').repair_count === 0).length,
      references_generated: tasks.filter(t => t.accepted_provider === provider).length,
      attempts: attempts.length,
      oracle_pass_given_reached: wilson(reachedOracle.filter(a => a.independent_oracle === 'PASS').length, reachedOracle.length),
      failure_by_stage: failures,
      median_cycles: median(attempts.map(a => a.cycles)),
      median_attempt_seconds: median(attempts.map(a => a.duration_seconds)),
      tokens: { input: sum(attempts.map(a => a.input_tokens)), output: sum(attempts.map(a => a.output_tokens)), reasoning: sum(attempts.map(a => a.reasoning_tokens)) },
      calls: calls.length,
      invalid_output_rate: wilson(calls.filter(c => c.status !== 'PASS' && /^INVALID_ACTION/.test(c.error_code ?? '')).length, calls.length),
      call_errors: errors,
      normalized: { markdown_fence: calls.filter(c => c.normalization === 'markdown_fence').length, prose_prefix: calls.filter(c => String(c.normalization ?? '').startsWith('prose_prefix')).length },
      median_call_ms: median(calls.map(c => c.duration_ms))
    };
  }
  const byStratum = {};
  for (const t of taskRows) {
    const s = byStratum[t.stratum] ??= { tasks: 0, accepted: 0, first_try: 0, attempts: 0 };
    s.tasks++; s.accepted += t.status === 'ACCEPTED' ? 1 : 0; s.first_try += t.first_try ? 1 : 0; s.attempts += t.attempts;
  }
  return { providers: Object.values(groups).filter(g => g.attempts > 0), strata: byStratum };
}

const csvCell = value => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const toCsv = list => (list.length ? [Object.keys(list[0]).join(','), ...list.map(row => Object.values(row).map(csvCell).join(','))].join('\n') + '\n' : '');

const pct = w => (w?.rate === null || w?.rate === undefined ? '—' : `${(w.rate * 100).toFixed(0)} % [${(w.low * 100).toFixed(0)}–${(w.high * 100).toFixed(0)}]`);
export function markdown(result, meta) {
  const lines = [`# Análisis de la generación del corpus`, '', `Generado ${meta.generated_at} a partir de ${meta.tasks} tareas en \`${meta.runs}\`. Intervalos de Wilson al 95 % entre corchetes.`, ''];
  lines.push('## Por estrato', '', '| Estrato | Tareas | Aceptadas | Aceptadas al primer intento | Intentos |', '|---|---|---|---|---|');
  for (const [name, s] of Object.entries(result.strata)) lines.push(`| ${name} | ${s.tasks} | ${s.accepted} | ${s.first_try} | ${s.attempts} |`);
  for (const stratum of [...new Set(result.providers.map(p => p.stratum))]) {
    lines.push('', `## Por modelo — ${stratum}`, '', '| Modelo | Tareas como inicial | Éxito al primer intento | Asignaciones con éxito | Referencias | Oráculo superado (si se alcanza) | Salidas inválidas | Mediana de ciclos | Mediana s/intento |', '|---|---|---|---|---|---|---|---|---|');
    for (const p of result.providers.filter(p => p.stratum === stratum)) lines.push(`| ${p.provider} | ${p.tasks_as_initial} | ${pct(p.initial_accepted_first_try)} | ${pct(p.assignment_success)} | ${p.references_generated} | ${pct(p.oracle_pass_given_reached)} | ${pct(p.invalid_output_rate)} | ${p.median_cycles ?? '—'} | ${p.median_attempt_seconds === null ? '—' : Math.round(p.median_attempt_seconds)} |`);
    lines.push('', '| Modelo | Fallos por etapa o motivo | Errores de llamada | Normalizadas (bloque / prosa) | Tokens entrada / salida |', '|---|---|---|---|---|');
    for (const p of result.providers.filter(p => p.stratum === stratum)) lines.push(`| ${p.provider} | ${Object.entries(p.failure_by_stage).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'} | ${Object.entries(p.call_errors).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'} | ${p.normalized.markdown_fence} / ${p.normalized.prose_prefix} | ${p.tokens.input} / ${p.tokens.output} |`);
  }
  lines.push('', 'Definiciones:', '- **Éxito al primer intento**: tareas en las que el modelo era el proveedor inicial del plan de rotación y la versión se aceptó en su primer intento, sin reparaciones ni reasignaciones.', '- **Asignación**: secuencia de intentos de un modelo en una tarea (inicial y reparaciones) hasta aceptar o reasignar. **Con éxito** si termina aceptada.', '- **Oráculo superado (si se alcanza)**: proporción de intentos que pasan el oráculo independiente entre los que llegaron a ejecutarlo.', '- **Salidas inválidas**: llamadas cuya respuesta no era una acción válida del protocolo (INVALID_ACTION*).');
  return lines.join('\n') + '\n';
}

// Informe HTML autocontenido: por estrato, dos gráficos de puntos con intervalo de Wilson (tasa de asignaciones con
// éxito y tasa de salidas inválidas por modelo) y la tabla de summary.md. Una sola serie por gráfico (color único).
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function dotChart(title, items) {
  const W = 560, rowH = 34, left = 96, right = 24, top = 30, bottom = 30;
  const H = top + bottom + rowH * items.length;
  const x = v => left + v * (W - left - right);
  const grid = [0, 0.25, 0.5, 0.75, 1].map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${top - 6}" y2="${H - bottom}" class="grid"/><text x="${x(v)}" y="${H - bottom + 18}" class="tick" text-anchor="middle">${v * 100} %</text>`).join('');
  const marks = items.map((item, i) => {
    const y = top + rowH * i + rowH / 2;
    const label = `<text x="${left - 10}" y="${y + 4}" class="label" text-anchor="end">${esc(item.name)}</text>`;
    if (item.w.rate === null) return `${label}<text x="${x(0) + 6}" y="${y + 4}" class="muted">sin datos</text>`;
    const tip = `${item.name}: ${(item.w.rate * 100).toFixed(1)} % (IC 95 %: ${(item.w.low * 100).toFixed(1)}–${(item.w.high * 100).toFixed(1)} %; ${item.k} de ${item.n})`;
    return `${label}<g class="mark" data-tip="${esc(tip)}"><rect x="${left}" y="${y - rowH / 2}" width="${W - left - right}" height="${rowH}" class="hit"/><line x1="${x(item.w.low)}" x2="${x(item.w.high)}" y1="${y}" y2="${y}" class="ci"/><circle cx="${x(item.w.rate)}" cy="${y}" r="5" class="dot"/></g>`;
  }).join('');
  return `<figure><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${grid}${marks}</svg></figure>`;
}
export function html(result, meta, table) {
  const sections = [...new Set(result.providers.map(p => p.stratum))].map(stratum => {
    const list = result.providers.filter(p => p.stratum === stratum);
    const success = list.map(p => ({ name: p.provider, w: p.assignment_success, k: Math.round((p.assignment_success.rate ?? 0) * p.assignments), n: p.assignments }));
    const invalid = list.map(p => ({ name: p.provider, w: p.invalid_output_rate, k: Math.round((p.invalid_output_rate.rate ?? 0) * p.calls), n: p.calls }));
    return `<section><h2>${esc(stratum)}</h2><div class="charts">${dotChart('Asignaciones con éxito (aceptadas tras inicial y reparaciones)', success)}${dotChart('Llamadas con salida inválida', invalid)}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Análisis del corpus</title>
<style>
:root{--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e4e3df;--series:#2a78d6}
@media (prefers-color-scheme:dark){:root{--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--grid:#383835;--series:#3987e5}}
body{margin:0;padding:24px 16px;background:var(--surface);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto}h1{font-size:22px}h2{font-size:18px;margin-top:32px}p.meta{color:var(--ink2)}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}figure{margin:0}figcaption{font-weight:600;margin-bottom:6px}
svg{width:100%;height:auto;overflow:visible}.grid{stroke:var(--grid);stroke-width:1}.tick,.muted{fill:var(--ink2);font-size:11px}.label{fill:var(--ink);font-size:12px}
.ci{stroke:var(--series);stroke-width:2;stroke-linecap:round}.dot{fill:var(--series);stroke:var(--surface);stroke-width:2}.hit{fill:transparent}.mark:hover .dot{r:7}
#tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--surface);padding:6px 8px;border-radius:6px;font-size:12px;display:none;max-width:320px}
.table{overflow-x:auto;margin-top:32px}table{border-collapse:collapse;font-size:13px;margin-bottom:20px}td,th{border-bottom:1px solid var(--grid);padding:4px 8px;text-align:left}
</style></head><body><main><h1>Análisis de la generación del corpus</h1><p class="meta">${esc(meta.tasks)} tareas · ${esc(meta.attempts)} intentos · ${esc(meta.calls)} llamadas · generado ${esc(meta.generated_at)}. Punto: tasa observada; línea: intervalo de Wilson al 95 %.</p>
${sections}<div class="table">${table}</div></main><div id="tip" role="tooltip"></div>
<script>const tip=document.getElementById('tip');document.querySelectorAll('.mark').forEach(m=>{m.addEventListener('mousemove',e=>{tip.textContent=m.dataset.tip;tip.style.display='block';tip.style.left=Math.min(e.clientX+12,innerWidth-330)+'px';tip.style.top=(e.clientY+12)+'px'});m.addEventListener('mouseleave',()=>{tip.style.display='none'})});</script></body></html>
`;
}
// Tablas de markdown a HTML (solo el subconjunto que produce markdown()).
function tablesHtml(md) {
  const out = [];
  let rowsBuffer = [];
  const flush = () => { if (rowsBuffer.length) { const [head, , ...body] = rowsBuffer; const cells = line => line.split('|').slice(1, -1).map(c => c.trim()); out.push(`<table><thead><tr>${cells(head).map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${cells(r).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); rowsBuffer = []; } };
  for (const line of md.split('\n')) {
    if (line.startsWith('|')) { rowsBuffer.push(line); continue; }
    flush();
    if (line.startsWith('## ')) out.push(`<h2>${esc(line.slice(3))}</h2>`);
    else if (line.startsWith('- ')) out.push(`<p>${esc(line.slice(2).replace(/\*\*/g, ''))}</p>`);
  }
  flush();
  return out.join('');
}

export function analyze({ runsDir, outDir, now = new Date().toISOString() }) {
  const tasks = loadRuns(runsDir);
  const { taskRows, attemptRows, callRows } = rows(tasks);
  const result = metrics(taskRows, attemptRows, callRows);
  const meta = { generated_at: now, runs: runsDir, tasks: taskRows.length, attempts: attemptRows.length, calls: callRows.length };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'tasks.csv'), toCsv(taskRows));
  writeFileSync(join(outDir, 'attempts.csv'), toCsv(attemptRows));
  writeFileSync(join(outDir, 'calls.csv'), toCsv(callRows));
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ ...meta, ...result }, null, 2) + '\n');
  const md = markdown(result, meta);
  writeFileSync(join(outDir, 'summary.md'), md);
  writeFileSync(join(outDir, 'report.html'), html(result, meta, tablesHtml(md)));
  return { meta, result };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
  const runsDir = arg('runs') ?? join(root, 'runs/corpus-generation');
  const outDir = arg('out') ?? join(root, 'analysis');
  const { meta } = analyze({ runsDir, outDir });
  console.log(`${meta.tasks} tareas, ${meta.attempts} intentos y ${meta.calls} llamadas → ${outDir}`);
}
