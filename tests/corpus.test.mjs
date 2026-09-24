import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus } from '../runner/validation/corpus.mjs';
import { makePacket, makeRepairPrompt } from '../runner/packet.mjs';
import { generationBlockers } from '../runner/preflight.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = () => loadCorpus(root);
const reject = (mutate, pattern) => {
  const data = load(); mutate(data);
  assert.match(validateCorpus(data, root).join('\n'), pattern);
};

test('F001 cumple esquema e integridad', () => assert.deepEqual(validateCorpus(load(), root), []));
test('rechaza IDs de producto duplicados', () => reject(d => d.products[1].id = 'P001', /IDs de productos/));
test('rechaza fixture de menos de 30 productos', () => reject(d => d.products.pop(), /products|30/));
test('rechaza precios no positivos', () => reject(d => d.products[0].price = 0, /products/));
test('rechaza campos imprevistos', () => reject(d => d.requirements[0].future_hint = 'V3', /requirement/));
test('detecta hash de fixture falso', () => reject(d => d.family.fixture.sha256 = 'a'.repeat(64), /hash.*fixture/i));
test('detecta datos modificados aunque se mantenga hash declarado', () => reject(d => d.products[0].name = 'Altered', /contenido.*fixture/i));
test('rechaza eliminación de requisitos preservados', () => reject(d => d.turns[1].preserves = ['R001'], /preserves/));
test('rechaza transición de versión incoherente', () => reject(d => d.turns[0].from_version = 'V2', /transición/));
test('rechaza requisito futuro incorporado a V0', () => reject(d => d.family.pilot.initial_requirements.push('R005'), /V0/));
test('rechaza requisito introducido en turno equivocado', () => reject(d => d.requirements[4].introduced_at = 'T001', /introduced_at/));
test('rechaza criterio sin caso de oráculo', () => reject(d => d.oracleCases[0].cases.pop(), /cobertura/));
test('rechaza falsa procedencia', () => reject(d => d.provenance.references.V0 = 'a'.repeat(40), /referencias|procedencia/));
test('rechaza FROZEN sin referencias y evidencia', () => reject(d => d.family.status = 'FROZEN', /DRAFT|congel|referencias/));
test('rechaza cambios silenciosos a la política de intentos', () => reject(d => d.policy.max_attempts = 4, /policy/));
test('V0 contiene solo los dos requisitos vigentes', () => {
  const d = load(); const p = makePacket(d, 'V0');
  assert.deepEqual(p.requirements.map(r => r.id), ['R001', 'R002']);
  assert.equal(p.products.length, 30);
  assert.doesNotMatch(JSON.stringify(p), /R003|R004|R005|T001|T002|T003|oracle|cases|generation_plan|local_a|sha256/i);
});
test('V1 conoce R001–R003 y no T002/T003 ni sus requisitos', () => {
  const p = makePacket(load(), 'V1');
  assert.deepEqual(p.requirements.map(r => r.id), ['R001','R002','R003']);
  assert.doesNotMatch(JSON.stringify(p), /R004|R005|T002|T003|oracle|local_a/i);
});
test('V2 no contiene selección futura', () => {
  assert.doesNotMatch(JSON.stringify(makePacket(load(), 'V2')), /R005|T003|stable_product_selection/i);
});
test('versiones posteriores conservan parámetros operativos previamente introducidos', () => {
  const p = makePacket(load(), 'V3');
  const sort = JSON.stringify(p.requirements.find(r=>r.id==='R003'));
  const pagination = JSON.stringify(p.requirements.find(r=>r.id==='R004'));
  assert.match(sort, /ASCII/);
  assert.match(sort, /empates/);
  assert.match(pagination, /número de página/);
  assert.match(pagination, /fijo de 10/);
});
test('rechaza versiones y familias no admitidas', () => {
  assert.throws(() => makePacket(load(), 'V9'), /versión/);
});
test('reparación acepta solo feedback visible de desarrollo', () => {
  assert.throws(() => makeRepairPrompt(load(), {source:'oracle', text:'hidden'}, 2), /visible/);
  assert.throws(() => makeRepairPrompt(load(), {source:'build', text:'error'}, 4), /intento/);
  assert.match(makeRepairPrompt(load(), {source:'build', text:'TS error'}, 2), /TS error/);
});
test('preflight bloquea generación sin requisitos operativos', () => {
  const b = generationBlockers(root);
  assert.match(b.join('\n'), /modelo/i);
  assert.match(b.join('\n'), /oráculo/);
  assert.match(b.join('\n'), /adapters de proveedores/);
});
