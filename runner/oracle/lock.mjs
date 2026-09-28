// Regenera runner/oracle/families/<Fxxx>/spec-lock.json desde oracle/<Fxxx>/*.cases.yaml.
// Uso: npm run oracle:lock -- F002 [--check]
// Solo debe ejecutarse tras revisar que cada plan (index.mjs) traduce fielmente el texto de su caso:
// el lock declara esa revisión. --check solo informa diferencias.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { specHash } from './spec.mjs';

const root = new URL('../../', import.meta.url);
const [family, flag] = process.argv.slice(2);
if (!/^F\d{3}$/.test(family ?? '') || (flag && flag !== '--check')) { console.error('Uso: npm run oracle:lock -- Fxxx [--check]'); process.exit(1); }
const cases = {};
for (const requirement of ['R001', 'R002', 'R003', 'R004', 'R005']) {
  const file = JSON.parse(readFileSync(new URL(`oracle/${family}/${requirement}.cases.yaml`, root), 'utf8'));
  for (const spec of file.cases) cases[spec.id] = specHash(spec);
}
const target = new URL(`runner/oracle/families/${family}/spec-lock.json`, root);
let previous = { cases: {} };
try { previous = JSON.parse(readFileSync(target, 'utf8')); } catch { /* lock nuevo */ }
const changed = Object.keys({ ...cases, ...previous.cases }).filter(id => cases[id] !== previous.cases?.[id]);
if (flag === '--check') {
  console.log(changed.length ? `Diferencias: ${changed.join(', ')}` : 'spec-lock al día');
  process.exitCode = changed.length ? 1 : 0;
} else {
  const lock = { note: `Hash sha256 de {id,steps,expected} de cada caso canónico en oracle/${family}. Regenerar solo al revisar el plan correspondiente.`, source: `oracle/${family}/R001-R005.cases.yaml`, cases };
  writeFileSync(target, JSON.stringify(lock, null, 2) + '\n');
  console.log(`${fileURLToPath(target)}: ${Object.keys(cases).length} casos${changed.length ? `; actualizados: ${changed.join(', ')}` : ''}`);
}
