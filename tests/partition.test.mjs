import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { split, SEED } from '../runner/partition/split.mjs';

const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const partition = read('config/partition.json');
const experiment = read('config/experiment.json');
const pilot = experiment.phases.pilot.families;

test('partición congelada: 20 de prueba en S021–S060, disjunta y completa', () => {
  assert.equal(partition.status, 'FROZEN'); assert.equal(partition.seed, SEED);
  assert.equal(partition.test.length, 20); assert.equal(partition.train_validation.length, 40);
  const all = new Set([...partition.test, ...partition.train_validation]);
  assert.equal(all.size, 60);
  for (const id of partition.test) assert.ok(Number(id.slice(1)) >= 21, `${id} no puede ser de prueba`);
});
test('ninguna familia del piloto, el banco o los ajustes queda en prueba; las fases usan la partición', () => {
  for (const id of [...pilot, 'S001', 'S003', 'S005', 'S007']) assert.ok(!partition.test.includes(id), id);
  assert.deepEqual(experiment.phases.final.families, partition.test);
  assert.deepEqual(experiment.phases.pi0.families, partition.train_validation);
});
test('el sorteo es reproducible con la semilla y respeta los estratos', () => {
  const { test: again, quota } = split(Object.entries(partition.candidates).map(([id, m]) => ({ id, runner: m.runner, repo: m.repo })), partition.pilot_repos);
  assert.equal(new Set(Object.values(partition.candidates).map(c => c.repo)).size, 40, 'un repositorio por familia');
  assert.deepEqual(again, partition.test); assert.deepEqual(quota, partition.strata_quota);
});
test('familias de una misma organización quedan en la misma partición', () => {
  const org = r => r.split('/')[0].toLowerCase();
  const repos = { ...partition.pilot_repos, ...Object.fromEntries(Object.entries(partition.candidates).map(([id, c]) => [id, c.repo])) };
  const side = id => partition.test.includes(id) ? 'test' : 'train';
  const byOrg = {};
  for (const [id, r] of Object.entries(repos)) (byOrg[org(r)] ??= []).push(id);
  for (const ids of Object.values(byOrg)) assert.equal(new Set(ids.map(side)).size, 1, ids.join(','));
});
