import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus, validateCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';

export const SCAFFOLD_FILES = ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','src/App.tsx','src/main.tsx'];
export const IMAGE_FILES = ['docker/base.json','docker/Dockerfile','docker/init.mjs','templates/react-vite/package.json','templates/react-vite/package-lock.json'];
export const VERIFICATION_FILES = [...new Set([...IMAGE_FILES,...SCAFFOLD_FILES.map(p=>`templates/react-vite/${p}`),
  'runner/sandbox/policy.mjs','runner/sandbox/docker.mjs','runner/sandbox/lock.mjs','runner/sandbox/build.mjs','runner/sandbox/verify.mjs','runner/sandbox/probe.mjs','runner/sandbox/cli.mjs','runner/sandbox/sessions.mjs','runner/packet.mjs','runner/validation/corpus.mjs',
  'prompts/common.md','prompts/generate-v0.md','families/F001-product-catalog/fixtures/products.json','families/F001-product-catalog/requirements/R001.yaml','families/F001-product-catalog/requirements/R002.yaml'])];
export function assertRelativePath(path) {
  if (typeof path !== 'string' || !path || /[\\:\x00-\x1f]/.test(path) || path.split('/').some(s=>!s || s==='.' || s==='..')) throw new Error('Ruta relativa inválida');
}
export function readContainedFile(root,path) {
  assertRelativePath(path);
  let at=root;
  if(lstatSync(at).isSymbolicLink()) throw new Error('No se admite enlace raíz');
  for(const part of path.split('/')) {
    at=join(at,part);
    if(lstatSync(at).isSymbolicLink()) throw new Error(`No se admite enlace: ${path}`);
  }
  if(!lstatSync(at).isFile()) throw new Error(`No es archivo: ${path}`);
  return readFileSync(at,'utf8');
}
export function seedFiles(root,version='V0') {
  if(version !== 'V0') throw new Error('Solo V0: falta exportador auditado de historia para una referencia validada');
  const data=loadCorpus(root), errors=validateCorpus(data,root);
  if(errors.length) throw new Error(errors.join('\n'));
  const files=Object.fromEntries(SCAFFOLD_FILES.map(p=>[p,readContainedFile(root,`templates/react-vite/${p}`)]));
  files['fixtures/products.json']=readContainedFile(root,'families/F001-product-catalog/fixtures/products.json');
  files['TASK.json']=JSON.stringify(makePacket(data,version),null,2)+'\n';
  files['.gitignore']='node_modules/\ndist/\ncoverage/\n';
  return files;
}
export function assertManagedName(name) {
  if(!/^evoguard-sandbox-[a-f0-9]{32}$/.test(name)) throw new Error('Nombre de contenedor no administrado por EvoGuard');
}
export function runArgs(image,name) {
  if(!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('La imagen debe ser un digest local inmutable');
  assertManagedName(name);
  return ['create',`--name=${name}`,'--label=org.evoguard.role=agent-sandbox','--pull=never','--platform=linux/amd64',
    '--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=1000:1000','--init',
    '--pids-limit=256','--memory=4g','--memory-swap=4g','--cpus=2','--shm-size=512m',
    '--tmpfs=/workspace:rw,exec,nosuid,nodev,size=1536m,uid=1000,gid=1000,mode=0700',
    '--tmpfs=/tmp:rw,exec,nosuid,nodev,size=1024m,mode=1777',
    '--tmpfs=/home/pwuser:rw,nosuid,nodev,size=64m,uid=1000,gid=1000,mode=0700',
    '--workdir=/workspace','--env=HOME=/home/pwuser','--env=TZ=UTC','--env=LANG=C.UTF-8','--env=LC_ALL=C.UTF-8',
    '--env=npm_config_cache=/tmp/npm-cache','--env=npm_config_offline=true','--env=npm_config_audit=false','--env=npm_config_fund=false',
    '--env=GIT_CONFIG_NOSYSTEM=1','--env=GIT_CONFIG_GLOBAL=/dev/null',
    ...['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','FTP_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','ftp_proxy'].map(k=>`--env=${k}=`),
    image,'sleep','infinity'];
}
