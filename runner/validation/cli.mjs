// Uso: npm run corpus:validate [-- Fxxx|Sxxx]   (sin argumento: todas las familias; las Fxxx pertenecen al estrato
// sintético archivado en archive/sintetico/ y se validan solo para conservar su integridad)
import { fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus, validateAll } from './corpus.mjs';
import { validateAllReal, loadRealFamily, validateRealFamily } from '../real/families.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const describe = data => {
  const records = Array.isArray(data.fixture) ? data.fixture.length : data.family.fixture.count;
  const cases = data.oracleCases.reduce((n, c) => n + c.cases.length, 0);
  return `${data.familyId} (archivada): especificación válida; ${data.requirements.length} requisitos, ${data.turns.length} turnos, ${records} registros de fixture, ${cases} casos declarativos. Estado ${data.family.status}; oráculo ${data.family.oracle.status}.`;
};
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !/^[FS]\d{3}$/.test(args[0]))) throw new Error('Uso: npm run corpus:validate [-- Fxxx|Sxxx]');
  const describeReal = data => `${data.familyId}: familia semi-real válida; ${data.manifest.repo}@${data.manifest.v0.commit.slice(0, 12)} (${data.manifest.runner}), 3 turnos calibrados. Generación ${data.manifest.generation.status}.`;
  if (args[0]?.startsWith('S')) {
    const data = loadRealFamily(root, args[0]);
    const errors = validateRealFamily(data, root);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log(describeReal(data));
  } else if (args[0]) {
    const data = loadCorpus(root, args[0]);
    const errors = validateCorpus(data, root);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log(describe(data));
  } else {
    const results = validateAll(root);
    for (const [id, errors] of Object.entries(results)) {
      if (errors.length) { console.error(`${id}:\n  ${errors.join('\n  ')}`); process.exitCode = 1; }
      else if (id !== '*') console.log(describe(loadCorpus(root, id)));
    }
    for (const [id, errors] of Object.entries(validateAllReal(root))) {
      // Familia nueva en borrador: válida salvo que falta calibrarla en el PC (scripts\real\calibrar-familias-reales.cmd).
      if (errors.length === 1 && errors[0].startsWith('Familia sin calibrar')) console.log(`${id}: familia semi-real en borrador; pendiente de calibrar (scripts\\real\\calibrar-familias-reales.cmd -Familia ${id}).`);
      else if (errors.length) { console.error(`${id}:\n  ${errors.join('\n  ')}`); process.exitCode = 1; }
      else console.log(describeReal(loadRealFamily(root, id)));
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
