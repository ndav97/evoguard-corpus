// Uso: npm run corpus:validate [-- Fxxx]   (sin argumento: todas las familias y reglas entre familias)
import { fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus, validateAll } from './corpus.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const describe = data => {
  const records = Array.isArray(data.fixture) ? data.fixture.length : data.family.fixture.count;
  const cases = data.oracleCases.reduce((n, c) => n + c.cases.length, 0);
  return `${data.familyId}: especificación válida; ${data.requirements.length} requisitos, ${data.turns.length} turnos, ${records} registros de fixture, ${cases} casos declarativos. Estado ${data.family.status}; oráculo ${data.family.oracle.status}.`;
};
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !/^F\d{3}$/.test(args[0]))) throw new Error('Uso: npm run corpus:validate [-- Fxxx]');
  if (args[0]) {
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
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
