// Registro de módulos de oráculo por familia: runner/oracle/families/Fxxx/index.mjs (+ spec-lock.json).
// Se descubren por directorio para que añadir una familia no modifique código común.
// Interfaz de cada módulo (docs/family-authoring.md):
//   FAMILY_ID, FIXTURE (ruta del fixture dentro de la familia), FIXTURE_SCHEMA (esquema JSON o nombre de schema/),
//   checkFixture(fixture, family) -> errores, PLANS { 'Rxxx-Ayy': async (ui, check, ctx) => ... },
//   CONTROL { clave: {role, name} | {label} }, LISTS { clave: {name, id} } (adaptador genérico) o connect(page),
//   context(fixture) -> ctx (opcional).
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const base = new URL('./', import.meta.url);
export const FAMILY_ORACLES = {};
for (const name of readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory() && /^F\d{3}$/.test(e.name)).map(e => e.name).sort()) {
  const module = await import(new URL(`./${name}/index.mjs`, base));
  if (module.FAMILY_ID !== name) throw new Error(`Módulo de oráculo ${name} declara FAMILY_ID ${module.FAMILY_ID}`);
  const lockUrl = new URL(`./${name}/spec-lock.json`, base);
  FAMILY_ORACLES[name] = Object.freeze({ ...module, lock: existsSync(lockUrl) ? JSON.parse(readFileSync(lockUrl, 'utf8')) : { cases: {} } });
}

export function familyOracle(familyId) {
  const oracle = FAMILY_ORACLES[familyId];
  if (!oracle) throw new Error(`Familia sin módulo de oráculo: ${familyId}`);
  return oracle;
}
