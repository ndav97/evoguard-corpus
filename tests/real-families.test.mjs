// Estrato semi-real: manifiestos, rotación, control de alcance y paquete sin material privado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { listRealFamilies, loadRealFamily, validateRealFamily, validateAllReal, makeRealPacket, scopeViolation, REAL_VERSIONS } from '../runner/real/families.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const families = listRealFamilies(root);
const reject = (id, mutate, pattern) => {
  const data = loadRealFamily(root, id); mutate(data);
  assert.match(validateRealFamily(data, root).join('\n'), pattern);
};

// Desde el 2026-10-02 el piloto tiene 20 familias semi-reales (config/strata.json). S001–S010 están calibradas;
// las nuevas pueden estar en borrador (provenance DRAFT) hasta calibrarlas en el PC: su único error admitido es ese.
test('estrato semi-real: familias S001–S0nn consecutivas; S001–S010 calibradas y las demás válidas o pendientes de calibrar', () => {
  assert.ok(families.length >= 10);
  assert.deepEqual(families.map(f => f.id), Array.from({ length: families.length }, (_, i) => `S${String(i + 1).padStart(3, '0')}`));
  for (const [id, errors] of Object.entries(validateAllReal(root))) {
    const draft = loadRealFamily(root, id).manifest.provenance.status === 'DRAFT';
    assert.ok(!draft || Number(id.slice(1)) > 10, `${id}: S001–S010 deben seguir calibradas`);
    assert.deepEqual(errors, draft ? ['Familia sin calibrar (provenance.status)'] : [], id);
  }
});

test('rotación por fila en V1–V3: reparto equilibrado entre los cinco proveedores, sin repetir dentro de una familia', () => {
  const counts = {};
  for (const { id } of families) {
    const plan = Object.values(loadRealFamily(root, id).manifest.generation.plan);
    assert.equal(new Set(plan).size, 3, id);
    for (const provider of plan) counts[provider] = (counts[provider] ?? 0) + 1;
  }
  const each = families.length * 3 / 5; // 10 familias → 6 por proveedor; 20 → 12
  if (families.length % 5 === 0) assert.deepEqual(counts, { openai: each, anthropic: each, google: each, local_a: each, local_b: each });
});

test('la validación detecta manifiestos incoherentes', () => {
  reject('S001', d => { d.manifest.generation.plan.V1 = 'openai'; }, /rotación/);
  reject('S001', d => { d.manifest.provenance.status = 'DRAFT'; }, /calibrar/);
  reject('S001', d => { d.turns[1].requestText = 'Implementa lo que piden los tests ocultos del oracle.'.repeat(3); }, /material privado/);
  reject('S001', d => { d.turns[0].requestText += '\nLuego haremos T002.'; }, /turno futuro/);
  reject('S003', d => { d.manifest.focus = 'src/components/PasswordMeter.tsx'; }, /focus/);
  reject('S001', d => { d.manifest.generation.references.V2 = 'a'.repeat(40); }, /no consecutivas|incompatible/);
  reject('S001', d => { d.manifest.extra = true; }, /real-family/);
});

test('control de alcance: dependencias, configuración y rutas peligrosas', () => {
  for (const path of ['package.json', 'pnpm-lock.yaml', 'yarn.lock', 'vite.config.ts', 'vitest.config.mts', 'jest.config.js', 'tsconfig.json', 'src/setupTests.ts', '.github/workflows/ci.yml', '../x.js', 'node_modules/a/index.js']) assert.ok(scopeViolation(path), path);
  for (const path of ['src/pages/Tasks.jsx', 'src/components/Foo.test.tsx', 'src/utils/format.ts']) assert.equal(scopeViolation(path), null, path);
});

for (const { id } of families) {
  test(`${id}: el paquete de cada turno solo contiene la petición y datos operativos`, () => {
    const data = loadRealFamily(root, id);
    for (const [index, version] of REAL_VERSIONS.entries()) {
      const packet = makeRealPacket(data, version);
      assert.deepEqual(Object.keys(packet), ['family_id', 'stratum', 'version', 'prompt', 'request', 'repository', 'checks']);
      assert.equal(packet.request, data.turns[index].requestText);
      // La petición es visible por diseño (puede citar literales que luego aparecen en tests o parches);
      // el resto del paquete no puede contener material privado.
      const text = JSON.stringify({ ...packet, request: null });
      assert.doesNotMatch(text, /oracle\/T00|reference\/T00|hidden_tests|evoguard|calibra|openai|anthropic|gemini|qwen|granite|local_a|local_b/i, `${id} ${version}`);
      for (const turn of data.turns) {
        // Ningún fragmento de los tests ocultos ni de los parches de referencia llega al constructor.
        const secretLines = [...turn.hiddenTestsText.split('\n'), ...turn.patchText.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'))].map(l => l.replace(/^\+/, '').trim()).filter(l => l.length > 40);
        for (const line of secretLines) assert.ok(!text.includes(line), `${id} ${version}: fuga de «${line.slice(0, 60)}»`);
      }
      for (const later of data.turns.slice(index + 1)) assert.ok(!text.includes(later.requestText.slice(0, 80)), `${id} ${version}: petición futura`);
    }
    assert.throws(() => makeRealPacket(data, 'V0'), /V1–V3/);
  });
}
