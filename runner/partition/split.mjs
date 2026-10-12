// Partición entrenamiento+validación / prueba de las 60 familias (decisión del tesista, 2026-10-12).
// Se fija ANTES de ver resultados del piloto. Reglas:
// - La prueba (20 familias) sale solo de S021–S060: S001–S020 ya se usaron en el piloto, el banco de modelos y los
//   ajustes del adaptador, así que ninguna familia mirada durante el desarrollo puede quedar en prueba.
// - Sorteo reproducible: cada familia se ordena por SHA-256(SEMILLA + id) y se toma la mitad de cada estrato del
//   ejecutor de tests (jest/vitest), redondeando hacia arriba en el estrato mayor, hasta completar 20.
// - Cada familia es un repositorio distinto, así que no hay fuga de código entre particiones.
// Uso: node runner/partition/split.mjs          (muestra la partición)
//      node runner/partition/split.mjs --write  (escribe config/partition.json y las listas de config/experiment.json)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SEED = 'evoguard-ui/particion/2026-10-12';
export const TEST_SIZE = 20;

const key = id => createHash('sha256').update(`${SEED}:${id}`).digest('hex');

export function split(candidates, { size = TEST_SIZE } = {}) {
  const strata = {};
  for (const c of candidates) (strata[c.runner] ??= []).push(c.id);
  const names = Object.keys(strata).sort((a, b) => strata[b].length - strata[a].length || a.localeCompare(b));
  const quota = Object.fromEntries(names.map(n => [n, Math.floor(strata[n].length * size / candidates.length)]));
  for (let i = 0; Object.values(quota).reduce((a, b) => a + b, 0) < size; i++) quota[names[i % names.length]]++;
  const test = names.flatMap(n => [...strata[n]].sort((a, b) => key(a).localeCompare(key(b))).slice(0, quota[n])).sort();
  return { test, quota };
}

function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const meta = JSON.parse(readFileSync(`${root}.artifacts/meta-s021-s060.json`, 'utf8'));
  const candidates = Object.entries(meta).map(([id, m]) => ({ id, runner: m.runner, repo: m.repo }));
  if (candidates.length !== 40) throw new Error(`Se esperaban 40 candidatas (S021–S060), hay ${candidates.length}`);
  const { test, quota } = split(candidates);
  const all = Array.from({ length: 60 }, (_, i) => `S${String(i + 1).padStart(3, '0')}`);
  const trainval = all.filter(id => !test.includes(id));
  const partition = {
    schema_version: '1.0.0', decided_at: '2026-10-12', status: 'FROZEN',
    rule: 'Prueba = 20 familias de S021–S060 sorteadas con SHA-256(semilla:id), estratificadas por ejecutor de tests; S001–S020 (piloto, banco y ajustes) siempre en entrenamiento/validación. Fijada antes de ver resultados del piloto.',
    seed: SEED, strata_quota: quota,
    test, train_validation: trainval,
    candidates: Object.fromEntries(candidates.map(c => [c.id, { runner: c.runner, repo: c.repo }])),
    validation_split: 'Se define en OE3 dentro de train_validation; nunca con familias de prueba.'
  };
  console.log(`Prueba (${test.length}): ${test.join(' ')}\nCuotas: ${JSON.stringify(quota)}`);
  if (process.argv.includes('--write')) {
    writeFileSync(`${root}config/partition.json`, JSON.stringify(partition, null, 2) + '\n');
    console.log('Escrito config/partition.json (config/experiment.json lo referencia en las fases pi0 y final)');
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
