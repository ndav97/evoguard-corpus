import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus, validateCorpus } from './validation/corpus.mjs';
import { makePacket } from './packet.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const [family,version,...extra] = process.argv.slice(2);
  if (!/^F\d{3}$/.test(family ?? '') || !version || extra.length) throw new Error('Uso: npm run packet:preview -- Fxxx V0|V1|V2|V3');
  const data = loadCorpus(root, family); const errors = validateCorpus(data, root);
  if (errors.length) throw new Error(errors.join('\n'));
  const packet = makePacket(data,version);
  const dir = join(root,'runs/preflight'); mkdirSync(dir,{recursive:true});
  const target = join(dir,`${family}-${version}.json`);
  writeFileSync(target,JSON.stringify(packet,null,2)+'\n',{encoding:'utf8'});
  console.log(`Preview escrito: ${target}. No se ejecutó ningún agente.`);
} catch(error) { console.error(error.message); process.exitCode = 1; }
