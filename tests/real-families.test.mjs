// Estrato semi-real: manifiestos, rotación, control de alcance y paquete sin material privado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { listRealFamilies, loadRealFamily, validateRealFamily, validateAllReal, makeRealPacket, scopeViolation, realVersions } from '../runner/real/families.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const families = listRealFamilies(root);
const reject = (id, mutate, pattern) => {
  const data = loadRealFamily(root, id); mutate(data);
  assert.match(validateRealFamily(data, root).join('\n'), pattern);
};

// Desde el 2026-10-17 el corpus semi-real tiene ids no consecutivos (las candidatas descartadas dejan huecos).
// S001–S010 deben seguir calibradas; las demás pueden estar en borrador (DRAFT) hasta calibrarlas en el PC.
test('estrato semi-real: ids Snnn únicos y ordenados; S001–S010 calibradas y las demás válidas o pendientes de calibrar', () => {
  assert.ok(families.length >= 10);
  const ids = families.map(f => f.id);
  for (const id of ids) assert.match(id, /^S\d{3}$/);
  assert.deepEqual(ids, [...new Set(ids)].sort());
  for (const n of Array.from({ length: 10 }, (_, i) => `S${String(i + 1).padStart(3, '0')}`)) assert.ok(ids.includes(n), `${n} falta`);
  for (const [id, errors] of Object.entries(validateAllReal(root))) {
    const draft = loadRealFamily(root, id).manifest.provenance.status === 'DRAFT';
    assert.ok(!draft || Number(id.slice(1)) > 10, `${id}: S001–S010 deben seguir calibradas`);
    assert.deepEqual(errors, draft ? ['Familia sin calibrar (provenance.status)'] : [], id);
  }
});

test('rotación por fila (V1–V3 en el piloto, V1–V5 en el corpus definitivo): reparto equilibrado, sin repetir dentro de una familia', () => {
  const counts = {};
  let total = 0;
  for (const { id } of families) {
    const manifest = loadRealFamily(root, id).manifest;
    const plan = Object.values(manifest.generation.plan);
    assert.equal(plan.length, manifest.turns.length, id);
    assert.equal(new Set(plan).size, plan.length, id);
    for (const provider of plan) counts[provider] = (counts[provider] ?? 0) + 1;
    total += plan.length;
  }
  // Con bloques de 5 familias consecutivas del mismo número de turnos, cada proveedor recibe total/5 versiones.
  if (families.length % 5 === 0) assert.deepEqual(counts, Object.fromEntries(['openai', 'anthropic', 'google', 'local_a', 'local_b'].map(p => [p, total / 5])));
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
    for (const [index, version] of realVersions(data.manifest).entries()) {
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
    assert.throws(() => makeRealPacket(data, 'V0'), /versión no admitida/);
    assert.throws(() => makeRealPacket(data, `V${data.turns.length + 1}`), /versión no admitida/);
  });
}
