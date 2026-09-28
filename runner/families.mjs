// Registro de familias del corpus: se descubren por directorio (families/Fxxx-slug/family.yaml).
// Rotación de proveedores del piloto ("rotación por fila"): la familia número n (F00n) asigna a la versión Vv el
// proveedor provider_ring[(n - 1 + v) % 5]. Con 10 familias y 4 versiones, cada proveedor genera 8 de 40 artefactos.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const FAMILY_ID = /^F\d{3}$/;
export const VERSIONS = ['V0', 'V1', 'V2', 'V3'];

export function listFamilies(root) {
  const base = join(root, 'families');
  return readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^F\d{3}-[a-z0-9-]+$/.test(entry.name) && existsSync(join(base, entry.name, 'family.yaml')))
    .map(entry => ({ id: entry.name.slice(0, 4), dir: `families/${entry.name}` }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function familyDir(root, familyId = 'F001') {
  if (!FAMILY_ID.test(familyId)) throw new Error(`Identificador de familia inválido: ${familyId}`);
  const found = listFamilies(root).filter(family => family.id === familyId);
  if (found.length !== 1) throw new Error(`Familia ${familyId} ${found.length ? 'duplicada' : 'no encontrada'} en families/`);
  return found[0].dir;
}

export function expectedPlan(familyId, ring) {
  const offset = Number(familyId.slice(1)) - 1;
  return Object.fromEntries(VERSIONS.map((version, v) => [version, ring[(offset + v) % ring.length]]));
}
