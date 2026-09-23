import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { runArgs, assertManagedName, seedFiles } from './policy.mjs';
import { readContainerLock } from './lock.mjs';

export function docker(args,{input,timeout=60000,stdio='pipe'}={}) {
  const r=spawnSync('docker',args,{input,timeout,stdio,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true,shell:false});
  if(r.error || r.status!==0) {
    const error=new Error(`Docker ${args[0]} falló: ${r.error?.message??r.stderr??r.status}`);
    error.clientAborted=Boolean(r.error||r.signal);throw error;
  }
  return r.stdout?.trim()??'';
}
export function assertContainer(name,image) {
  assertManagedName(name);
  const c=JSON.parse(docker(['inspect',name]))[0], h=c.HostConfig;
  if(c.Config.Labels?.['org.evoguard.role']!=='agent-sandbox' || c.Image!==image || h.NetworkMode!=='none' || !h.ReadonlyRootfs || c.Config.User!=='1000:1000' || h.Privileged || c.Mounts.some(m=>m.Type!=='tmpfs') || Object.keys(h.PortBindings??{}).length || !h.CapDrop?.includes('ALL') || !h.SecurityOpt?.includes('no-new-privileges')) throw new Error('Configuración del contenedor no cumple aislamiento');
  return c;
}
export function closeSandbox(name,image) {
  assertManagedName(name);
  if(!docker(['container','ls','--all','--filter',`name=^/${name}$`,'--format','{{.Names}}'])) return;
  assertContainer(name,image);
  docker(['rm','--force',name]);
}
export function execSandbox(name,image,argv,{input,timeout=60000}={}) {
  assertContainer(name,image);
  if(!Array.isArray(argv)||!argv.length||argv.some(a=>typeof a!=='string'||a.includes('\0'))) throw new Error('Comando inválido');
  try {return docker(['exec','-i','--user=1000:1000','--workdir=/workspace/app',name,...argv],{input,timeout});}
  catch(error) {
    // Un timeout de docker exec no mata el proceso interior. Cerrar el contenedor propio.
    if(error.clientAborted) closeSandbox(name,image);
    throw error;
  }
}
export function openSandbox(root,{allowCandidate=false}={}) {
  const lock=readContainerLock(root,{allowCandidate});
  docker(['image','inspect',lock.image_id]);
  const files=seedFiles(root,'V0');
  const name='evoguard-sandbox-'+randomUUID().replaceAll('-','');
  let created=false;
  try {
    docker(runArgs(lock.image_id,name));created=true;
    docker(['start',name]);
    assertContainer(name,lock.image_id);
    const output=docker(['exec','-i','--user=1000:1000',name,'node','/opt/evoguard/init.mjs'],{input:JSON.stringify({files}),timeout:120000});
    return {name,image:lock.image_id,initialization:JSON.parse(output)};
  } catch(error) {
    if(created) closeSandbox(name,lock.image_id);
    throw error;
  }
}
