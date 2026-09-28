// Piloto de 10 familias: validación conjunta, rotación de proveedores, paquetes sin fugas y perfiles diversos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus, validateAll } from '../runner/validation/corpus.mjs';
import { listFamilies } from '../runner/families.mjs';
import { makePacket } from '../runner/packet.mjs';
import { seedFiles } from '../runner/sandbox/policy.mjs';
import { architectureRules } from '../runner/pipeline/architecture.mjs';
import { familyOracle } from '../runner/oracle/families/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const families = listFamilies(root);
const corpora = Object.fromEntries(families.map(f => [f.id, loadCorpus(root, f.id)]));
const LEAK = /(spec-lock|plans\.mjs|runner\/oracle|oracle|evaluator\/runs|PRIVATE_|SYNTEROLINK|openai|anthropic|gemini|qwen|granite|local_a|local_b)/i;
const FUTURE = { V0: /R00[345]|T00[123]/, V1: /R00[45]|T00[23]/, V2: /R005|T003/ };

test('el piloto tiene 10 familias F001–F010 y todas validan (incluidas las reglas entre familias)', () => {
  assert.deepEqual(families.map(f => f.id), Array.from({ length: 10 }, (_, i) => `F${String(i + 1).padStart(3, '0')}`));
  const results = validateAll(root);
  for (const [id, errors] of Object.entries(results)) assert.deepEqual(errors, [], id);
});

test('rotación por fila: cada proveedor genera 8 de los 40 artefactos y nunca dos versiones seguidas de una familia', () => {
  const counts = {};
  for (const data of Object.values(corpora)) {
    const plan = Object.values(data.family.generation_plan);
    for (const provider of plan) counts[provider] = (counts[provider] ?? 0) + 1;
    assert.equal(new Set(plan).size, 4, data.familyId);
  }
  assert.deepEqual(counts, { openai: 8, anthropic: 8, google: 8, local_a: 8, local_b: 8 });
});

for (const [id, data] of Object.entries(corpora)) {
  test(`${id}: cada versión recibe solo sus requisitos, el fixture completo y ninguna fuga`, () => {
    for (const [index, version] of ['V0', 'V1', 'V2', 'V3'].entries()) {
      const packet = makePacket(data, version);
      assert.deepEqual(packet.requirements.map(r => r.id), ['R001', 'R002', 'R003', 'R004', 'R005'].slice(0, index + 2), version);
      assert.equal(packet.family_id, id);
      const text = JSON.stringify(packet);
      assert.doesNotMatch(text, LEAK, `${id} ${version}`);
      if (FUTURE[version]) assert.doesNotMatch(text, FUTURE[version], `${id} ${version}: requisito o turno futuro`);
      assert.ok(packet.prompt.includes(data.prompts.architecture.trim()), 'arquitectura de la familia en el prompt');
      if (id === 'F001') assert.equal(packet.products.length, 30);
      else {
        assert.equal(packet.fixture_path, data.family.fixture.path);
        assert.deepEqual(packet.fixture, JSON.parse(readFileSync(join(root, data.familyDir, data.family.fixture.path), 'utf8')));
      }
    }
  });

  test(`${id}: el seed V0 lleva scaffold, un único fixture de la familia y el paquete V0`, () => {
    const files = seedFiles(root, 'V0', id);
    const fixtures = Object.keys(files).filter(path => path.startsWith('fixtures/'));
    assert.deepEqual(fixtures, [data.family.fixture.path]);
    assert.equal(files[data.family.fixture.path], readFileSync(join(root, data.familyDir, data.family.fixture.path), 'utf8'));
    assert.equal(JSON.parse(files['TASK.json']).version, 'V0');
    assert.doesNotMatch(files['TASK.json'] + files[data.family.fixture.path], FUTURE.V0);
  });

  test(`${id}: prompts de la familia sin funcionalidades futuras ni términos internos`, () => {
    for (const prompt of ['architecture', 'generate-v0']) {
      assert.doesNotMatch(data.prompts[prompt], LEAK, prompt);
      assert.doesNotMatch(data.prompts[prompt], FUTURE.V0, prompt);
    }
    assert.match(data.prompts['generate-v0'], /ui_contract/);
  });
}

test('las familias cubren la diversidad arquitectónica del protocolo', () => {
  const profiles = Object.fromEntries(Object.entries(corpora).map(([id, d]) => [id, d.family.structural_profile]));
  const has = predicate => Object.entries(profiles).filter(([, p]) => predicate(p)).map(([id]) => id);
  assert.ok(has(p => p.state_strategy === 'useState' && p.topology === 'centralized').length >= 1, 'useState centralizado');
  assert.ok(has(p => p.reducer === true).length >= 1, 'useReducer');
  assert.ok(has(p => p.topology === 'distributed').length >= 1, 'estado distribuido');
  assert.ok(has(p => p.memoization === true).length >= 1, 'estado derivado memoizado');
  assert.ok(has(p => p.effects === true).length >= 1, 'useEffect');
  assert.ok(has(p => p.persistence === 'localStorage').length >= 2, 'localStorage');
  assert.ok(has(p => p.context === true).length >= 1, 'Context API');
  assert.ok(has(p => p.custom_hooks === true).length >= 1, 'hooks propios');
  assert.ok(has(p => p.controlled_inputs === true).length >= 1, 'formularios controlados');
  // Ningún par de familias comparte a la vez perfil completo y prefijo de IDs.
  const signatures = Object.values(profiles).map(p => JSON.stringify(p));
  assert.ok(new Set(signatures).size >= 8, 'al menos 8 perfiles estructurales distintos');
});

test('las reglas de arquitectura se derivan del perfil de cada familia', () => {
  const names = id => {
    const rules = architectureRules(corpora[id].family.structural_profile);
    return { forbid: rules.forbid.map(([name]) => name), require: rules.require.map(([label]) => label).join(' | ') };
  };
  assert.ok(names('F001').forbid.includes('useReducer') && names('F001').forbid.includes('useEffect') && names('F001').forbid.includes('localStorage'));
  assert.match(names('F002').require, /useReducer/);
  assert.ok(names('F002').forbid.includes('useEffect'));
  assert.ok(names('F003').forbid.includes('createContext'));
  assert.match(names('F003').require, /distribuido/);
  assert.ok(names('F004').forbid.some(n => /defaultValue/.test(n)));
  assert.match(names('F005').require, /useEffect/);
  assert.match(names('F005').require, /localStorage/);
  assert.match(names('F006').require, /useMemo/);
  assert.match(names('F008').require, /Context API/);
  assert.match(names('F010').require, /hooks propios/);
  assert.ok(!names('F010').forbid.includes('useEffect'));
  for (const id of Object.keys(corpora)) assert.ok(names(id).forbid.includes('sessionStorage') && names(id).forbid.includes('fetch'), id);
});

test('prefijos de IDs distintos y sin colisión con requisitos o turnos', () => {
  const prefixes = Object.keys(corpora).map(id => familyOracle(id).ID_PREFIX ?? (id === 'F001' ? 'P' : null)).filter(Boolean);
  assert.equal(new Set(prefixes).size, prefixes.length);
  assert.ok(!prefixes.some(p => ['R', 'T'].includes(p)));
});
