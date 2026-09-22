import { fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus } from './corpus.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
try {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== 'F001')) throw new Error('Solo se admite la familia F001 en esta fase.');
  const data = loadCorpus(root);
  const errors = validateCorpus(data, root);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`F001: especificación válida; ${data.requirements.length} requisitos, ${data.turns.length} turnos, ${data.products.length} productos, ${data.oracleCases.reduce((n,c)=>n+c.cases.length,0)} casos declarativos. Estado DRAFT; no es validación funcional.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
