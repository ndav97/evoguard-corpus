// ¿Está vigente el ensayo? Lo usa scripts\real\ensayar-familias.ps1 para retomar una ejecución interrumpida sin
// repetir lo que ya pasó con el código actual. Uso: node runner/real/rehearsal-status.mjs --mini | Sxxx
// Código de salida 0: vigente (PASS, misma huella del pipeline y, para una familia, misma imagen). 1: hay que ensayar.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBases } from './prepare.mjs';
import { realFingerprint } from './sources.mjs';

export function neutralChanges(root) {
  const path = join(root, 'config/neutral-changes.json');
  if (!existsSync(path)) return [];
  const config = JSON.parse(readFileSync(path, 'utf8'));
  const hex = /^[a-f0-9]{64}$/;
  if (config.schema_version !== '1.0.0' || !Array.isArray(config.changes) || !config.changes.every(c => c.file && hex.test(c.from_sha256) && hex.test(c.to_sha256) && c.why_neutral && c.evidence?.length)) throw new Error('config/neutral-changes.json inválido');
  return config.changes;
}

export function rehearsalCurrent(root, target) {
  const file = target === '--mini' ? 'real-pipeline-rehearsal.json' : `real-rehearsal-${target.toLowerCase()}.json`;
  const path = join(root, 'docs/verification', file);
  if (!existsSync(path)) return { current: false, reason: 'sin evidencia' };
  const evidence = JSON.parse(readFileSync(path, 'utf8'));
  if (evidence.status !== 'PASS' || evidence.experimental !== false) return { current: false, reason: `estado ${evidence.status}` };
  const current = realFingerprint(root);
  // Cambios neutros documentados (config/neutral-changes.json): solo para ensayos de familias y solo si el archivo
  // pasó exactamente del hash ensayado al hash actual. El ensayo general (--mini) nunca los admite.
  const neutral = target === '--mini' ? [] : neutralChanges(root);
  const accepted = p => neutral.some(c => c.file === p && c.from_sha256 === evidence.sources_sha256?.[p] && c.to_sha256 === current[p]);
  const changed = Object.keys(current).filter(p => evidence.sources_sha256?.[p] !== current[p] && !accepted(p));
  if (changed.length) return { current: false, reason: `código cambiado (${changed.join(', ')})` };
  if (target !== '--mini') {
    const base = readBases(root).bases[target];
    if (!base || evidence.image_id !== base.image_id) return { current: false, reason: 'otra imagen' };
  }
  return { current: true, reason: `PASS vigente (${evidence.started_at})` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = process.argv[2];
  if (!target || !(target === '--mini' || /^S\d{3}$/.test(target))) { console.error('Uso: node runner/real/rehearsal-status.mjs --mini | Sxxx'); process.exit(2); }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const { current, reason } = rehearsalCurrent(root, target);
  console.log(`${target === '--mini' ? 'S900' : target}: ${reason}`);
  process.exit(current ? 0 : 1);
}
