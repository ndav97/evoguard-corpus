// Preflight de generación de una familia semi-real: cada bloqueo es una condición comprobable.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { docker } from '../sandbox/docker.mjs';
import { modelBlockers } from '../preflight-models.mjs';
import { loadRealFamily, validateRealFamily } from './families.mjs';
import { readBases } from './prepare.mjs';
import { realFingerprint } from './sources.mjs';

export function realBlockers(root, familyId, { checkImage = true } = {}) {
  const data = loadRealFamily(root, familyId);
  const blockers = validateRealFamily(data, root);
  const base = readBases(root).bases[familyId];
  if (!base) blockers.push(`Imagen: ${familyId} sin preparar; ejecutar scripts\\real\\preparar-imagenes.cmd -Familias ${familyId} (npm run real:prepare -- ${familyId}).`);
  else {
    if (base.status !== 'VERIFIED') blockers.push(`Imagen: ${familyId} no verificada (${Object.entries(base.checks ?? {}).filter(([, ok]) => !ok).map(([k]) => k).join(', ')}).`);
    if (base.v0_commit !== data.manifest.v0.commit) blockers.push('Imagen: construida para otro commit V0; repetir real:prepare.');
    if (base.development_source) blockers.push('Imagen: construida desde una carpeta local (solo pruebas).');
    if (checkImage) {
      try { docker(['image', 'inspect', base.image_id]); } catch { blockers.push(`Imagen: ${base.image_id.slice(0, 19)} no existe en este Docker; repetir real:prepare.`); }
    }
  }
  blockers.push(...modelBlockers(root, data.policy.provider_ring));
  const current = realFingerprint(root);
  const pipeline = join(root, 'docs/verification/real-pipeline-rehearsal.json');
  if (!existsSync(pipeline)) blockers.push('Pipeline semi-real: falta ensayo; ejecutar npm run real:rehearse -- --mini.');
  else {
    const evidence = JSON.parse(readFileSync(pipeline, 'utf8'));
    const changed = Object.keys(current).filter(path => evidence.sources_sha256?.[path] !== current[path]);
    if (evidence.status !== 'PASS' || evidence.experimental !== false) blockers.push('Pipeline semi-real: el último ensayo no pasó.');
    if (changed.length) blockers.push(`Pipeline semi-real: cambió código ensayado (${changed.join(', ')}); repetir npm run real:rehearse -- --mini.`);
  }
  const own = join(root, `docs/verification/real-rehearsal-${familyId.toLowerCase()}.json`);
  if (!existsSync(own)) blockers.push(`${familyId}: falta el ensayo de la familia con su imagen; ejecutar scripts\\real\\ensayar-familias.cmd -Familias ${familyId} (npm run real:rehearse -- ${familyId}).`);
  else {
    const evidence = JSON.parse(readFileSync(own, 'utf8'));
    if (evidence.status !== 'PASS') blockers.push(`${familyId}: el ensayo de la familia no pasó.`);
    if (base && evidence.image_id !== base.image_id) blockers.push(`${familyId}: el ensayo usó otra imagen; repetirlo.`);
    const changed = Object.keys(current).filter(path => evidence.sources_sha256?.[path] !== current[path]);
    if (changed.length) blockers.push(`${familyId}: cambió código ensayado desde el ensayo de la familia; repetirlo.`);
  }
  if (data.manifest.generation.status === 'FROZEN') blockers.push(`${familyId} está FROZEN: no se regenera; abrir nueva revisión.`);
  return blockers;
}
