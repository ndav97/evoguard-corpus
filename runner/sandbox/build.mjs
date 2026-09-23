import { mkdirSync, writeFileSync, readFileSync, createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { docker } from './docker.mjs';
import { imageInputs,hashText } from './lock.mjs';
import { readContainedFile,IMAGE_FILES } from './policy.mjs';

export async function hashFile(path) {
  const hash=createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function buildEnvironment(root) {
  const sources=Object.fromEntries(IMAGE_FILES.map(p=>[p,readContainedFile(root,p)]));
  const inputs=Object.fromEntries(Object.entries(sources).map(([p,text])=>[p,hashText(text)]));
  const source=JSON.parse(sources['docker/base.json']);
  if(!/^node@sha256:[a-f0-9]{64}$/.test(source.image)) throw new Error('Base debe fijarse por digest');
  const staging=join(root,'.artifacts','build-'+randomUUID());
  const mappings={'Dockerfile':'docker/Dockerfile','init.mjs':'docker/init.mjs','deps/package.json':'templates/react-vite/package.json','deps/package-lock.json':'templates/react-vite/package-lock.json'};
  for(const [target,sourcePath]of Object.entries(mappings)) {
    const destination=join(staging,target);mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,sources[sourcePath]);
  }
  const idfile=join(root,'.artifacts','image-'+randomUUID()+'.id');
  console.log('Construyendo imagen desde contexto mínimo...');
  docker(['build','--platform=linux/amd64','--build-arg',`BASE_IMAGE=${source.image}`,'--iidfile',idfile,staging],{timeout:1200000,stdio:'inherit'});
  const image=readFileSync(idfile,'utf8').trim();
  const archive='.artifacts/evoguard-runtime.tar';
  console.log('Guardando imagen inmutable para reproducción local...');
  docker(['image','save','--output',join(root,archive),image],{timeout:300000});
  if(JSON.stringify(inputs)!==JSON.stringify(imageInputs(root))) throw new Error('Fuentes cambiaron durante build; no se publica el manifiesto');
  const lock={schema_version:'1.0.0',status:'BUILT',platform:'linux/amd64',base_image:source.image,image_id:image,inputs,archive:{path:archive,sha256:await hashFile(join(root,archive))},verification:null};
  writeFileSync(join(root,'config/container.json'),JSON.stringify(lock,null,2)+'\n');
  console.log(`Imagen creada ${image}. Falta environment:verify.`);
  return lock;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  buildEnvironment(fileURLToPath(new URL('../../',import.meta.url))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
