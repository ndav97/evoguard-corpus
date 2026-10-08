// Registros de un episodio (runner/episode/run.mjs). Separados de la generación del corpus: un episodio mide a un
// modelo, nunca produce referencias.
//   Público:  runs/episodes/<experimento>/<brazo>/<proveedor>/<Sxxx>/e<episodio>-r<repetición>/
//             episode.json y, por turno, T00n/{events.jsonl, calls.jsonl, patch.diff, turn.json}
//   Privado:  evaluator/episodes/<misma ruta>/T00n.jsonl (informes del oráculo y del control de alcance)
//   Ensayo:   .artifacts/episodes/<misma ruta>/ (fuera de Git), con el privado en <dir>/evaluator/
// Como en runner/pipeline/store.mjs: nunca se escriben claves; una credencial del entorno detiene el episodio y
// los patrones con forma de secreto se redactan.
import { mkdirSync, appendFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const SECRET = /((?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{16,}|(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{20,}|x-api-key|authorization:\s*bearer|SYNTEROLINK_[A-Z_]*KEY\s*=)/i;
const SAFE = /^[A-Za-z0-9._-]+$/;

export function episodePath({ experiment, arm, provider, familyId, episode = 1, repetition = 1 }) {
  for (const [name, value] of Object.entries({ experiment, arm, provider, familyId })) if (!SAFE.test(String(value ?? ''))) throw new Error(`Episodio: ${name} inválido (${value})`);
  if (!Number.isInteger(episode) || episode < 1 || !Number.isInteger(repetition) || repetition < 1) throw new Error('Episodio: número de episodio o repetición inválido');
  return join(experiment, arm, provider, familyId, `e${episode}-r${repetition}`);
}

export function episodeDirs(root, spec) {
  const rel = episodePath(spec);
  return spec.rehearsal
    ? { dir: join(root, '.artifacts/episodes', rel), privateDir: join(root, '.artifacts/episodes', rel, 'evaluator') }
    : { dir: join(root, 'runs/episodes', rel), privateDir: join(root, 'evaluator/episodes', rel) };
}

export const episodeComplete = (root, spec) => existsSync(join(episodeDirs(root, spec).dir, 'episode.json'));

export function createEpisodeStore(root, spec, { env = process.env } = {}) {
  const { dir, privateDir } = episodeDirs(root, spec);
  if (existsSync(join(dir, 'episode.json'))) throw new Error(`El episodio ya está completo: ${dir}`);
  // Un episodio interrumpido se conserva aparte (evidencia) y se repite desde el primer turno.
  const stamp = Date.now();
  if (existsSync(dir)) renameSync(dir, `${dir}.incompleto-${stamp}`);
  if (existsSync(privateDir) && !privateDir.startsWith(dir)) renameSync(privateDir, `${privateDir}.incompleto-${stamp}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(privateDir, { recursive: true });
  const envSecrets = Object.entries(env).filter(([key, value]) => /(KEY|TOKEN|SECRET|PASSWORD)$/i.test(key) && typeof value === 'string' && value.length >= 12).map(([, value]) => value);
  const leak = text => envSecrets.some(value => text.includes(value));
  const guard = text => {
    if (leak(text)) throw new Error('Registro con una credencial del entorno; se detiene el episodio');
    return text.replace(new RegExp(SECRET.source, 'gi'), '[REDACTED]');
  };
  const append = (path, value) => appendFileSync(path, guard(JSON.stringify(value)) + '\n');

  return {
    dir, privateDir,
    turn(turnId) {
      if (!/^T\d{3}$/.test(turnId)) throw new Error('Turno inválido');
      const turnDir = join(dir, turnId);
      mkdirSync(turnDir, { recursive: true });
      let current = { provider: null, attempt: null, cycle: null };
      const calls = [];
      const events = [];
      const retries = [];
      return {
        dir: turnDir, calls, events, retries,
        // Reintentos de transporte (429, 5xx, red): su espera consume el tiempo del modelo y se registra aparte.
        retry(info) { retries.push(info); append(join(turnDir, 'events.jsonl'), { type: 'transport_retry', ...info }); },
        track(context) { current = { provider: context.provider, attempt: context.attempt, cycle: context.cycle }; },
        event(event) { events.push(event); append(join(turnDir, 'events.jsonl'), event); },
        call(metadata) { const record = { ...current, ...metadata }; calls.push(record); append(join(turnDir, 'calls.jsonl'), record); },
        private(record) { append(join(privateDir, `${turnId}.jsonl`), { at: new Date().toISOString(), ...record }); },
        patch(text) {
          if (leak(text)) throw new Error('Parche con una credencial del entorno; se detiene el episodio');
          writeFileSync(join(turnDir, 'patch.diff'), text, { flag: 'wx' });
        },
        finish(record) { writeFileSync(join(turnDir, 'turn.json'), guard(JSON.stringify(record, null, 2)) + '\n', { flag: 'wx' }); }
      };
    },
    finish(summary) { writeFileSync(join(dir, 'episode.json'), guard(JSON.stringify(summary, null, 2)) + '\n', { flag: 'wx' }); }
  };
}
