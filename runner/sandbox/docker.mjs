import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runArgs, assertManagedName, seedFiles } from './policy.mjs';
import { readContainerLock } from './lock.mjs';

export function docker(args,{input,timeout=60000,stdio='pipe',raw=false}={}) {
  const r=spawnSync('docker',args,{input,timeout,stdio,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true,shell:false});
  if(r.error || r.status!==0) {
    const error=new Error(`Docker ${args[0]} falló: ${r.error?.message??r.stderr??r.status}`);
    error.clientAborted=Boolean(r.error||r.signal);throw error;
  }
  return raw?(r.stdout??''):(r.stdout?.trim()??'');
}
export function assertContainer(name,image,role='agent-sandbox') {
  assertManagedName(name,role);
  const c=JSON.parse(docker(['inspect',name]))[0], h=c.HostConfig;
  if(c.Config.Labels?.['org.evoguard.role']!==role || c.Image!==image || h.NetworkMode!=='none' || !h.ReadonlyRootfs || c.Config.User!=='1000:1000' || h.Privileged || c.Mounts.some(m=>m.Type!=='tmpfs') || Object.keys(h.PortBindings??{}).length || !h.CapDrop?.includes('ALL') || !h.SecurityOpt?.includes('no-new-privileges')) throw new Error('Configuración del contenedor no cumple aislamiento');
  return c;
}
export function closeSandbox(name,image,role='agent-sandbox') {
  assertManagedName(name,role);
  if(!docker(['container','ls','--all','--filter',`name=^/${name}$`,'--format','{{.Names}}'])) return;
  assertContainer(name,image,role);
  docker(['rm','--force',name]);
}
export function execSandbox(name,image,argv,{input,timeout=60000,role='agent-sandbox',raw=false}={}) {
  assertContainer(name,image,role);
  if(!Array.isArray(argv)||!argv.length||argv.some(a=>typeof a!=='string'||a.includes('\0'))) throw new Error('Comando inválido');
  const workdir=role==='oracle-evaluator'?'/workspace':'/workspace/app';
  try {return docker(['exec','-i','--user=1000:1000',`--workdir=${workdir}`,name,...argv],{input,timeout,raw});}
  catch(error) {
    // Un timeout de docker exec no mata el proceso interior. Cerrar el contenedor propio.
    if(error.clientAborted) closeSandbox(name,image,role);
    throw error;
  }
}
// seed: {files, steps} de runner/sandbox/lineage.mjs para V1–V3; por defecto, el scaffold V0.
export function openSandbox(root,{allowCandidate=false,seed}={}) {
  const lock=readContainerLock(root,{allowCandidate});
  docker(['image','inspect',lock.image_id]);
  const payload=seed??{files:seedFiles(root,'V0'),steps:[]};
  const initializer=readFileSync(join(root,'runner/sandbox/seed-init.mjs'),'utf8');
  const name='evoguard-sandbox-'+randomUUID().replaceAll('-','');
  let created=false;
  try {
    docker(runArgs(lock.image_id,name));created=true;
    docker(['start',name]);
    assertContainer(name,lock.image_id);
    docker(['exec','-i','--user=1000:1000',name,'node','-e',"require('node:fs').writeFileSync('/tmp/evoguard-seed.json',require('node:fs').readFileSync(0),{mode:0o600})"],{input:JSON.stringify(payload),timeout:60000});
    const output=docker(['exec','-i','--user=1000:1000',name,'node','--input-type=module'],{input:initializer,timeout:180000});
    return {name,image:lock.image_id,initialization:JSON.parse(output)};
  } catch(error) {
    if(created) closeSandbox(name,lock.image_id);
    throw error;
  }
}

// Contenedor nuevo para el oráculo: mismo aislamiento, sin inicializar workspace del agente.
export function openEvaluator(root) {
  const lock=readContainerLock(root);
  docker(['image','inspect',lock.image_id]);
  const name='evoguard-oracle-'+randomUUID().replaceAll('-','');
  let created=false;
  try {
    docker(runArgs(lock.image_id,name,'oracle-evaluator'));created=true;
    docker(['start',name]);
    assertContainer(name,lock.image_id,'oracle-evaluator');
    return {name,image:lock.image_id,role:'oracle-evaluator'};
  } catch(error) {
    if(created) closeSandbox(name,lock.image_id,'oracle-evaluator');
    throw error;
  }
}
