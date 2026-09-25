// Contrato de interfaz observable: el constructor lo recibe por requisito y el adaptador del oráculo lo usa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../runner/validation/corpus.mjs';
import { makePacket } from '../runner/packet.mjs';
import { CONTROL } from '../runner/oracle/ui-adapter.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = loadCorpus(root);
const named = requirements => requirements.flatMap(r => r.ui_contract.elements.filter(e => e.name).map(e => ({ requirement: r.id, role: e.role, name: e.name })));

test('cada control del adaptador está definido con el mismo rol y nombre en el ui_contract', () => {
  const contract = named(data.requirements);
  for (const [key, { role, name }] of Object.entries(CONTROL)) {
    assert.ok(contract.some(e => e.role === role && e.name === name), `${key}: ${role} «${name}» no está en el contrato`);
  }
  assert.equal(contract.length, Object.keys(CONTROL).length, 'el contrato define controles con nombre que el adaptador no usa');
});

test('el contrato fija los valores de opciones que usa el oráculo', () => {
  const rule = id => data.requirements.find(r => r.id === id).ui_contract.elements.map(e => e.rule).join(' ');
  for (const value of ['All', 'Electronics', 'Home', 'Sports', 'Books']) assert.match(rule('R002'), new RegExp(value));
  for (const value of ['name-asc', 'name-desc', 'price-asc', 'price-desc']) assert.match(rule('R003'), new RegExp(value));
  assert.match(rule('R005'), /role="status"/);
  assert.match(rule('R005'), /aria-pressed/);
});

test('cada versión recibe solo el contrato de sus requisitos activos', () => {
  const expected = {
    V0: ['Buscar', 'Categoría'],
    V1: ['Buscar', 'Categoría', 'Orden'],
    V2: ['Buscar', 'Categoría', 'Orden', 'Anterior', 'Siguiente'],
    V3: ['Buscar', 'Categoría', 'Orden', 'Anterior', 'Siguiente']
  };
  for (const [version, names] of Object.entries(expected)) {
    const packet = makePacket(data, version);
    assert.ok(packet.requirements.every(r => r.ui_contract?.elements?.length), version);
    assert.deepEqual(named(packet.requirements).map(e => e.name), names, version);
  }
  const v0 = JSON.stringify(makePacket(data, 'V0'));
  // Ningún elemento del contrato de R003–R005 (ni su texto) aparece en el paquete V0.
  const future = data.requirements.filter(r => ['R003', 'R004', 'R005'].includes(r.id)).flatMap(r => [r.ui_contract.initial_state, ...r.ui_contract.elements.flatMap(e => [e.name, e.rule])]).filter(Boolean);
  for (const text of future) assert.ok(!v0.includes(JSON.stringify(text).slice(1, -1)), `fuga en V0: ${text}`);
  assert.doesNotMatch(v0, /«Orden»|«Anterior»|«Siguiente»|role=\\"status\\"|aria-pressed|name-asc|price-asc/);
  assert.match(makePacket(data, 'V3').requirements.at(-1).ui_contract.elements.map(e => e.rule).join(' '), /role="status"/);
});

test('los prompts exigen respetar el ui_contract', () => {
  assert.match(data.prompts.common, /ui_contract/);
  assert.match(data.prompts['generate-v0'], /ui_contract/);
  assert.match(data.prompts['evolve-turn'], /ui_contract/);
});
