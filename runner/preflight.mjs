import { pathToFileURL, fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus } from './validation/corpus.mjs';
import { readContainerLock } from './sandbox/lock.mjs';
export function generationBlockers(root) {
  const data = loadCorpus(root);
  const blockers = validateCorpus(data,root);
  try {
    const lock=readContainerLock(root);
    if(data.stack.experimental.image_digest!==lock.image_id) blockers.push('Linux/Docker: stack e imagen verificada no coinciden.');
  } catch(error) {blockers.push(`Linux/Docker: ${error.message}`);}
  if (Object.values(data.provenance.models).some(m=>!m)) blockers.push('Versiones exactas de modelos sin seleccionar.');
  if (data.family.oracle.status === 'CASES_SPECIFIED_ADAPTER_PENDING') blockers.push('Falta implementar y verificar el adapter y oráculo E2E independiente.');
  blockers.push('Runner experimental/adapters de proveedores aún no implementados; generación deshabilitada. Evolución posterior a V0 requiere exportador auditado de historia de referencias.');
  return blockers;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const blockers = generationBlockers(fileURLToPath(new URL('../',import.meta.url)));
    console.error('Generación no autorizada por preflight:\n'+blockers.map(b=>`- ${b}`).join('\n'));
    process.exitCode = 1;
  } catch(error) { console.error(error.message); process.exitCode = 1; }
}
