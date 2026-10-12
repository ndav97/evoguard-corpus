// Partición entrenamiento+validación / prueba de las 60 familias (decisión del tesista, 2026-10-12).
// Se fija ANTES de ver resultados del piloto. Reglas:
// - La prueba (20 familias) sale solo de S021–S060: S001–S020 ya se usaron en el piloto, el banco de modelos y los
//   ajustes del adaptador, así que ninguna familia mirada durante el desarrollo puede quedar en prueba.
// - Familias de una misma organización van a la misma partición (criterio de selección del corpus del 2026-10-05):
//   una familia de S021–S060 cuya organización también aparece en S001–S020 no puede ser de prueba, y dos familias de
//   la misma organización dentro de S021–S060 entran o quedan fuera juntas.
// - Sorteo reproducible: cada grupo de organización se ordena por SHA-256(SEMILLA + id menor del grupo) y se añade
//   mientras quepa en la cuota de su estrato de ejecutor de tests (jest/vitest), proporcional a las candidatas.
// Uso: node runner/partition/split.mjs          (muestra la partición)
//      node runner/partition/split.mjs --write  (escribe config/partition.json)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SEED = 'evoguard-ui/particion/2026-10-12';
export const TEST_SIZE = 20;

const key = id => createHash('sha256').update(`${SEED}:${id}`).digest('hex');
const org = repo => repo.split('/')[0].toLowerCase();

export function split(candidates, pilotRepos, { size = TEST_SIZE } = {}) {
  const pilotOrgs = new Set(Object.values(pilotRepos).map(org));
  const eligible = candidates.filter(c => !pilotOrgs.has(org(c.repo)));
  const strata = {};
  for (const c of eligible) (strata[c.runner] ??= []).push(c.id);
  const names = Object.keys(strata).sort((a, b) => strata[b].length - strata[a].length || a.localeCompare(b));
  const quota = Object.fromEntries(names.map(n => [n, Math.floor(strata[n].length * size / eligible.length)]));
  for (let i = 0; Object.values(quota).reduce((a, b) => a + b, 0) < size; i++) quota[names[i % names.length]]++;
  const groups = {};
  for (const c of eligible) (groups[org(c.repo)] ??= []).push(c);
  const ordered = Object.values(groups).sort((a, b) => key(a.map(c => c.id).sort().at(0)).localeCompare(key(b.map(c => c.id).sort().at(0))));
  const taken = Object.fromEntries(names.map(n => [n, 0])), test = [];
  for (const g of ordered) {
    const need = {}; for (const c of g) need[c.runner] = (need[c.runner] ?? 0) + 1;
    if (Object.entries(need).every(([r, n]) => taken[r] + n <= quota[r])) { for (const c of g) { test.push(c.id); taken[c.runner]++; } }
    if (test.length === size) break;
  }
  if (test.length !== size) throw new Error(`Solo ${test.length} familias de prueba con las cuotas ${JSON.stringify(quota)}`);
  return { test: test.sort(), quota, excluded: candidates.filter(c => pilotOrgs.has(org(c.repo))).map(c => c.id) };
}

function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const meta = JSON.parse(readFileSync(`${root}.artifacts/meta-s021-s060.json`, 'utf8'));
  const candidates = Object.entries(meta).map(([id, m]) => ({ id, runner: m.runner, repo: m.repo }));
  if (candidates.length !== 40) throw new Error(`Se esperaban 40 candidatas (S021–S060), hay ${candidates.length}`);
  const pilotRepos = {};
  for (const d of readdirSync(`${root}families-real`).filter(d => /^S0(0\d|1\d|20)-/.test(d)))
    pilotRepos[d.slice(0, 4)] = readFileSync(`${root}families-real/${d}/family.yaml`, 'utf8').match(/^repo:\s*(\S+)/m)[1];
  if (Object.keys(pilotRepos).length !== 20) throw new Error('Faltan familias del piloto');
  const { test, quota, excluded } = split(candidates, pilotRepos);
  const all = Array.from({ length: 60 }, (_, i) => `S${String(i + 1).padStart(3, '0')}`);
  const partition = {
    schema_version: '1.1.0', decided_at: '2026-10-12', status: 'FROZEN',
    rule: 'Prueba = 20 familias de S021–S060 sorteadas con SHA-256(semilla:id) por grupos de organización, estratificadas por ejecutor de tests. S001–S020 (piloto, banco y ajustes) y las familias de S021–S060 que comparten organización con ellas quedan siempre en entrenamiento/validación; familias de una misma organización van a la misma partición. Fijada antes de ver resultados del piloto.',
    revision: '1.1 (2026-10-12): la 1.0 del mismo día no agrupaba por organización y dejaba en prueba S053 (canonical, con S029) y S054 (Automattic, con S017 del piloto). Se corrigió antes de usar ninguna familia de prueba.',
    seed: SEED, strata_quota: quota, excluded_by_organization: excluded,
    test, train_validation: all.filter(id => !test.includes(id)),
    candidates: Object.fromEntries(candidates.map(c => [c.id, { runner: c.runner, repo: c.repo }])),
    pilot_repos: pilotRepos,
    validation_split: 'Se define en OE3 dentro de train_validation (30 de entrenamiento y 10 de validación); nunca con familias de prueba.'
  };
  console.log(`Prueba (${test.length}): ${test.join(' ')}\nCuotas: ${JSON.stringify(quota)} · fuera por organización: ${excluded.join(' ')}`);
  if (process.argv.includes('--write')) { writeFileSync(`${root}config/partition.json`, JSON.stringify(partition, null, 2) + '\n'); console.log('Escrito config/partition.json'); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
