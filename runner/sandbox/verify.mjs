import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readContainerLock, hashText, verificationInputs } from './lock.mjs';
import { hashFile } from './build.mjs';
import { openSandbox, execSandbox, closeSandbox, docker } from './docker.mjs';

export async function verifyEnvironment(root) {
  const lock=readContainerLock(root,{allowCandidate:true});
  lock.status='BUILT';lock.verification=null;delete lock.verification_inputs;
  writeFileSync(join(root,'config/container.json'),JSON.stringify(lock,null,2)+'\n');
  const stack=JSON.parse(readFileSync(join(root,'config/stack.json'),'utf8'));
  stack.status='PREPARATION_ONLY';
  stack.experimental={os:'linux',image_digest:null,node:null,npm:null,browser:null};
  writeFileSync(join(root,'config/stack.json'),JSON.stringify(stack,null,2)+'\n');
  const inputs=verificationInputs(root);
  const archive=join(root,lock.archive.path);
  if(await hashFile(archive)!==lock.archive.sha256) throw new Error('Archivo de imagen alterado');
  console.log('Comprobando carga del archivo de imagen...');
  docker(['image','load','--input',archive],{timeout:300000});
  const reports=[];
  // Valor sintético: demuestra que Docker no hereda los secretos del coordinador.
  const previous=process.env.EVOGUARD_TEST_SECRET;
  process.env.EVOGUARD_TEST_SECRET='synthetic-test-value-not-a-credential';
  try {
    for(let n=0;n<2;n++) {
      const session=openSandbox(root,{allowCandidate:true});
      console.log(`Verificando contenedor limpio ${n+1}/2...`);
      try {
        const probe=readFileSync(join(root,'runner/sandbox/probe.mjs'),'utf8');
        const output=execSandbox(session.name,session.image,['node','--input-type=module'],{input:probe,timeout:180000});
        reports.push({initialization:session.initialization,...JSON.parse(output)});
      } finally {closeSandbox(session.name,session.image);}
    }
  } finally {if(previous===undefined) delete process.env.EVOGUARD_TEST_SECRET;else process.env.EVOGUARD_TEST_SECRET=previous;}
  if(reports[0].initialization.baseline_commit!==reports[1].initialization.baseline_commit) throw new Error('Scaffold Git no determinista');
  const cleanup={};
  for(const [kind,code,timeout] of [['timeout','setInterval(()=>{},1000)',300],['output_limit',"process.stdout.write('x'.repeat(20*1024*1024));setInterval(()=>{},1000)",10000]]) {
    const session=openSandbox(root,{allowCandidate:true});
    console.log(`Comprobando limpieza por ${kind}...`);
    try {
      assert.throws(()=>execSandbox(session.name,session.image,['node','-e',code],{timeout}),error=>error.clientAborted===true);
      assert.equal(docker(['container','ls','--all','--filter',`name=^/${session.name}$`,'--format','{{.Names}}']),'');
      cleanup[kind]=true;
    } finally {closeSandbox(session.name,session.image);}
  }
  if(JSON.stringify(inputs)!==JSON.stringify(verificationInputs(root))) throw new Error('Fuentes cambiaron durante verificación');
  const report={schema_version:'1.0.0',status:'PASS',image_id:lock.image_id,archive_sha256:lock.archive.sha256,verification_inputs:inputs,cleanup,clean_runs:reports};
  const text=JSON.stringify(report,null,2)+'\n';
  mkdirSync(join(root,'docs/verification'),{recursive:true});
  writeFileSync(join(root,'docs/verification/container.json'),text);
  lock.status='VERIFIED';lock.verification_inputs=inputs;lock.verification={path:'docs/verification/container.json',sha256:hashText(text)};
  writeFileSync(join(root,'config/container.json'),JSON.stringify(lock,null,2)+'\n');
  stack.status='RUNTIME_VERIFIED';
  stack.experimental={os:'linux',image_digest:lock.image_id,node:reports[0].runtime.node,npm:reports[0].runtime.npm,browser:`Chromium headless ${reports[0].runtime.chromium} / Playwright ${reports[0].runtime.playwright}`};
  writeFileSync(join(root,'config/stack.json'),JSON.stringify(stack,null,2)+'\n');
  console.log('PASS: dos contenedores limpios, build offline y Chromium localhost; barreras de aislamiento verificadas.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  verifyEnvironment(fileURLToPath(new URL('../../',import.meta.url))).catch(e=>{console.error(e.stack);process.exitCode=1;});
}
