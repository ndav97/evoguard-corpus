import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFiles, assertRelativePath, readContainedFile, runArgs, assertManagedName } from '../runner/sandbox/policy.mjs';
import { validateContainerLock, hashText } from '../runner/sandbox/lock.mjs';
import { saveSession,loadSession,forgetSession } from '../runner/sandbox/sessions.mjs';
import { syntheticArchived } from '../runner/strata.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('seed V0 lleva solo scaffold y requisitos actuales, sin historia ni datos privados',()=>{
  const files=seedFiles(root,'V0');
  assert.ok(files['src/App.tsx']); assert.ok(files['fixtures/products.json']);
  assert.equal(JSON.parse(files['TASK.json']).requirements.length,2);
  assert.doesNotMatch(JSON.stringify(files), /R003|R004|R005|T001|T002|T003|oracle\/F001|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  assert.ok(!Object.keys(files).some(x=>x.startsWith('.git/')));
});
test('rechaza evolución sin referencia validada exportada',()=>{
  for(const v of ['V1','V2','V3','../V0']) assert.throws(()=>seedFiles(root,v),/referencia|V0/);
});
test('rechaza traversal, rutas absolutas, backslash y segmentos ambiguos',()=>{
  for(const p of ['../secret','/etc/passwd','C:/secret','src/../../secret','src\\secret','src//App.tsx','./x','a/./b','a\u0000b']) assert.throws(()=>assertRelativePath(p));
  assert.doesNotThrow(()=>assertRelativePath('src/main.tsx'));
});
test('enlace de directorio no puede sacar archivos del staging',()=>{
  const d=mkdtempSync(join(tmpdir(),'evoguard-links-'));
  try {
    mkdirSync(join(d,'source'));mkdirSync(join(d,'outside'));
    writeFileSync(join(d,'outside','secret'),'private');
    symlinkSync(join(d,'outside'),join(d,'source','link'),'junction');
    assert.throws(()=>readContainedFile(join(d,'source'),'link/secret'),/enlace/);
  } finally {assert.ok(d.startsWith(join(tmpdir(),'evoguard-links-')));rmSync(d,{recursive:true,force:true});}
});

for(const [label,mutate,expected] of [
  ['política modificada',(d,l)=>writeFileSync(join(d,'runner/sandbox/policy.mjs'),'// changed'),/Verificación obsoleta/],
  ['imagen fuente modificada',(d,l)=>writeFileSync(join(d,'docker/Dockerfile'),'# changed'),/Imagen obsoleta/],
  ['evidencia alterada',(d,l)=>writeFileSync(join(d,'docs/verification/container.json'),'{}'),/inconsistente|Limpieza/],
  ['payload falso con hash de reporte actualizado',(d,l)=>{
    const p=join(d,l.verification.path), report=JSON.parse(readFileSync(p));
    report.clean_runs[0].fixture_sha256='0'.repeat(64);
    const text=JSON.stringify(report);writeFileSync(p,text);l.verification.sha256=hashText(text);
  },/Payload/],
  ['reverificación pendiente',(d,l)=>{l.status='BUILT';l.verification=null;},/sin verificación/]
]) test(`manifiesto bloquea ${label}`,{skip:syntheticArchived(root)&&'la evidencia del contenedor sintético quedó obsoleta al archivar el estrato sintético (config/strata.json); se restaura con npm run environment:verify si se reactiva'},()=>{
  const d=mkdtempSync(join(tmpdir(),'evoguard-lock-'));
  try {
    for(const folder of ['config','docker','runner','templates','archive','schema','prompts','docs/verification','runs','README.md','package.json','package-lock.json']) {
      cpSync(join(root,folder),join(d,folder),{recursive:true,filter:p=>!['node_modules','dist'].includes(basename(p))});
    }
    const lock=JSON.parse(readFileSync(join(d,'config/container.json')));
    assert.deepEqual(validateContainerLock(lock,d),[],'evidencia original válida');
    mutate(d,lock);
    assert.match(validateContainerLock(lock,d).join('\n'),expected);
  } finally {assert.ok(d.startsWith(join(tmpdir(),'evoguard-lock-')));rmSync(d,{recursive:true,force:true});}
});
test('runArgs fija aislamiento sin mounts, puertos ni secretos del host',()=>{
  const args=runArgs('sha256:'+'a'.repeat(64),'evoguard-sandbox-'+'b'.repeat(32));
  for(const required of ['--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=1000:1000','--init']) assert.ok(args.includes(required));
  assert.ok(!args.some(a=>/^--(mount|volume|publish|privileged|env-file|pid=host|ipc=host)/.test(a)));
  assert.ok(!args.some(a=>a.includes('OPENAI')||a.includes('docker.sock')));
});
test('rechaza imagen por tag y nombres Docker ajenos al runner',()=>{
  assert.throws(()=>runArgs('image:latest','evoguard-sandbox-'+'a'.repeat(32)),/digest/);
  for(const n of ['production','--privileged','evoguard-sandbox-../x']) assert.throws(()=>assertManagedName(n));
});
test('lock alterado no habilita el contenedor',()=>{
  assert.notDeepEqual(validateContainerLock({status:'VERIFIED',image_id:'latest'},root),[]);
});
test('sesión conserva identidad para cleanup sin depender del manifiesto vigente',()=>{
  const d=mkdtempSync(join(tmpdir(),'evoguard-session-'));
  const session={name:'evoguard-sandbox-'+'a'.repeat(32),image:'sha256:'+'b'.repeat(64)};
  try {
    saveSession(d,session);
    assert.deepEqual(loadSession(d,session.name),session);
    assert.throws(()=>loadSession(d,'../not-ours'));
    forgetSession(d,session.name);
    assert.throws(()=>loadSession(d,session.name));
  } finally {assert.ok(d.startsWith(join(tmpdir(),'evoguard-session-')));rmSync(d,{recursive:true,force:true});}
});
