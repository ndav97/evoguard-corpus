// Persistencia de una tarea del pipeline (una versión de una familia).
// Público (constructor-agnóstico):  <dir>/events.jsonl, calls.jsonl, attempts/<id>/{generation.json,patch.diff}, summary.json
// Privado del evaluador:           <private>/evaluator.jsonl (informes de oráculo y arquitectura)
// - rehearsal:     .artifacts/rehearsals/<task>/ (fuera de Git; nunca referencia del corpus)
// - experimental:  runs/corpus-generation/F001/<V>/<task>/ y evaluator/runs/F001/<V>/<task>/
// Nunca se escriben variables de entorno, claves ni cabeceras. null = no observado, nunca cero.
import { mkdirSync, appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { schemaValidators, validateRecord } from '../validation/corpus.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const SECRET = /(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|x-api-key|authorization:\s*bearer|SYNTEROLINK_[A-Z_]*KEY\s*=)/i;

export function createTaskStore(root, { mode, familyId = 'F001', version, taskId = randomUUID() }) {
  // bench: banco de prueba de modelos locales (.artifacts/bench, fuera de Git; nunca referencia del corpus).
  if (!['rehearsal', 'experimental', 'bench'].includes(mode)) throw new Error('Modo de almacenamiento inválido');
  const dir = mode === 'experimental' ? join(root, 'runs/corpus-generation', familyId, version, taskId) : join(root, mode === 'bench' ? '.artifacts/bench' : '.artifacts/rehearsals', taskId);
  const privateDir = mode === 'experimental' ? join(root, 'evaluator/runs', familyId, version, taskId) : join(dir, 'evaluator');
  if (existsSync(dir)) throw new Error('La tarea ya existe; no se sobrescriben registros');
  mkdirSync(dir, { recursive: true });
  mkdirSync(privateDir, { recursive: true });
  const guard = text => { if (SECRET.test(text)) throw new Error('Registro con posible secreto; se detiene la tarea'); return text; };
  const append = (path, value) => appendFileSync(path, guard(JSON.stringify(value)) + '\n');
  let current = { provider: null, attempt: null, cycle: null };
  const calls = [];

  return {
    taskId, dir, privateDir,
    // Contexto del ciclo en curso, para asociar cada llamada al proveedor con su intento.
    track(context) { current = { provider: context.provider, attempt: context.attempt, cycle: context.cycle }; },
    event(event) { append(join(dir, 'events.jsonl'), event); },
    call(metadata) { const record = { ...current, ...metadata }; calls.push(record); append(join(dir, 'calls.jsonl'), record); },
    private(record) { append(join(privateDir, 'evaluator.jsonl'), { at: new Date().toISOString(), ...current, ...record }); },

    // Escribe un registro por intento conforme a schema/generation.schema.json y el resumen de la tarea.
    finalize(result, { packet, models, stackText, fixtureSha256 }) {
      const validators = schemaValidators(root);
      const promptSha = sha(JSON.stringify(packet));
      const stackSha = sha(stackText);
      const records = [];
      for (const [index, row] of result.attempts.entries()) {
        const id = `${String(index + 1).padStart(2, '0')}-${row.provider}-a${row.attempt}`;
        const attemptDir = join(dir, 'attempts', id);
        mkdirSync(attemptDir, { recursive: true });
        if (typeof row.snapshot === 'string') writeFileSync(join(attemptDir, 'patch.diff'), guard(row.snapshot));
        const own = calls.filter(call => call.provider === row.provider && call.attempt === row.attempt);
        const sum = key => own.length && own.every(call => Number.isFinite(call.tokens?.[key])) ? own.reduce((total, call) => total + call.tokens[key], 0) : null;
        const config = models?.[row.provider];
        const observed = [...new Set(own.map(call => call.observed_model).filter(Boolean))];
        const generation = {
          schema_version: '1.0.0', family_id: 'F001', version: packet.version, artifact_type: 'reference_candidate',
          generator: { provider: row.provider, model: observed.length ? observed.join('; ') : (models ? 'no-observado' : 'instrumental-script'), temperature: config?.temperature ?? null, seed: config?.seed ?? null },
          attempt: row.attempt, repair_count: row.attempt - 1,
          base_commit: row.base_commit, candidate_commit: row.candidate_commit ?? null,
          prompt_sha256: promptSha, fixture_sha256: fixtureSha256, stack_sha256: stackSha,
          started_at: row.started_at, finished_at: row.finished_at ?? null,
          tokens: { input: sum('input'), output: sum('output') }, cost_usd: null,
          cycles: row.cycles, duration_seconds: Number.isFinite(row.duration_ms) ? row.duration_ms / 1000 : null,
          validation: Object.fromEntries(['build', 'typecheck', 'development_tests', 'independent_oracle', 'architecture'].map(stage => [stage, row.validation[stage] ?? 'NOT_RUN'])),
          outcome: row.outcome === 'ACCEPTED' || row.outcome === 'SIMULATED_ACCEPTED' ? 'ACCEPTED' : row.outcome,
          failure_reason: row.reason ?? null,
          logs_path: relative(root, attemptDir).split('\\').join('/')
        };
        const errors = validateRecord(generation, 'generation', validators);
        if (errors.length) throw new Error(`Registro de intento inválido (${id}): ${errors.join('; ')}`);
        writeFileSync(join(attemptDir, 'generation.json'), JSON.stringify(generation, null, 2) + '\n', { flag: 'wx' });
        records.push({ id, ...generation });
      }
      const summary = {
        artifact_type: result.artifact_type, mode: result.mode, experimental: mode === 'experimental', task_id: taskId,
        family_id: 'F001', version: packet.version, status: result.status,
        attempts: records.map(r => ({ id: r.id, provider: r.generator.provider, attempt: r.attempt, outcome: r.outcome, failure_reason: r.failure_reason, validation: r.validation, candidate_commit: r.candidate_commit })),
        accepted: records.find(r => r.outcome === 'ACCEPTED')?.id ?? null
      };
      writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
      return { summary, records };
    }
  };
}

// Referencia validada tras ACCEPTED: parche respecto del commit base, TASK.json recibido y hashes.
// Corpus (experimental): families/F001-product-catalog/generation/<V>/. Ensayo: <tarea>/references/<V>/.
// El seed de la versión siguiente se reconstruye desde aquí (runner/sandbox/lineage.mjs).
export const CORPUS_REFERENCES = root => join(root, 'families/F001-product-catalog/generation');

export function saveReference(root, referencesDir, { version, record, patch, taskText, taskDir }) {
  if (record.outcome !== 'ACCEPTED' || !record.candidate_commit) throw new Error('Solo se guarda una referencia aceptada con commit');
  const dir = join(referencesDir, version);
  const target = join(dir, 'reference.json');
  if (existsSync(target)) throw new Error(`La referencia ${version} ya existe; no se sobrescribe`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'reference.patch'), patch, { flag: 'wx' });
  writeFileSync(join(dir, 'task.json'), taskText, { flag: 'wx' });
  const reference = {
    schema_version: '1.0.0', family_id: 'F001', version,
    base_commit: record.base_commit, candidate_commit: record.candidate_commit,
    patch_sha256: sha(patch), task_packet_sha256: sha(taskText),
    attempt: record.id, generator: record.generator, logs_path: relative(root, taskDir).split('\\').join('/'),
    accepted_at: record.finished_at
  };
  writeFileSync(target, JSON.stringify(reference, null, 2) + '\n', { flag: 'wx' });
  return reference;
}
