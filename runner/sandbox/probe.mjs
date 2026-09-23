// Evaluador de infraestructura. Nunca se copia a la imagen o workspace del agente.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { createHash } from 'node:crypto';
const results={};
const cmd=(name,args)=>execFileSync(name,args,{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024}).trim();
assert.equal(process.getuid(),1000); results.non_root=true;
for(const path of ['/var/run/docker.sock','/oracle','/sources','/host','/mnt/c/Users','/run/desktop/mnt/host']) assert.equal(existsSync(path),false,path);
results.no_host_mounts_or_oracle=true;
for(const key of ['EVOGUARD_TEST_SECRET','OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY']) assert.equal(process.env[key],undefined,key);
results.no_host_secrets=true;
assert.throws(()=>writeFileSync('/etc/evoguard-write-test','no'));
writeFileSync('/workspace/app/write-test','yes');unlinkSync('/workspace/app/write-test');
results.readonly_root_writable_workspace=true;
const packet=JSON.parse(readFileSync('TASK.json','utf8'));
assert.deepEqual(packet.requirements.map(r=>r.id),['R001','R002']);
assert.doesNotMatch(JSON.stringify(packet),/R003|R004|R005|T001|T002|T003|oracle|local_a/i);
results.no_future_in_packet=true;
assert.equal(cmd('git',['rev-list','--all','--count']),'1');
assert.equal(cmd('git',['remote','-v']),'');
assert.equal(cmd('git',['for-each-ref','--format=%(refname)']),'refs/heads/main');
results.git_scaffold_only=true;
const routeLines=readFileSync('/proc/net/route','utf8').trim().split('\n');
assert.equal(routeLines.length,1,'No rutas externas');
async function cannotConnect(host) {
  return new Promise((resolve,reject)=>{
    const s=createConnection({host,port:443});
    const timer=setTimeout(()=>{s.destroy();resolve(true);},2500);
    s.once('connect',()=>{clearTimeout(timer);s.destroy();reject(new Error(`Conexión externa permitida: ${host}`));});
    s.once('error',()=>{clearTimeout(timer);s.destroy();resolve(true);});
  });
}
await cannotConnect('1.1.1.1');await cannotConnect('host.docker.internal');
results.external_network_and_host_denied=true;
results.npm_ci_offline=cmd('npm',['ci','--offline','--no-audit','--no-fund']);
results.build=cmd('npm',['run','build']);
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let i=0;i<100;i++) {
    try {if((await fetch('http://127.0.0.1:5173')).ok) {ready=true;break;}} catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Servidor local listo');
  const {chromium}=await import('/workspace/app/node_modules/playwright/index.mjs');
  // La barrera es el contenedor sin red; Chromium solo recibe esta UI local neutra.
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5173');
  assert.equal(await page.locator('h1').textContent(),'Scaffold base');
  results.browser_localhost=true;
  results.chromium_version=browser.version();
} finally {if(browser)await browser.close();server.kill();}
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(cmd('git',['status','--porcelain']),'');
results.inputs_unchanged=true;
console.log(JSON.stringify({status:'PASS',runtime:{node:process.versions.node,npm:cmd('npm',['--version']),git:cmd('git',['--version']),os:cmd('uname',['-s']),architecture:process.arch,chromium:results.chromium_version,playwright:JSON.parse(readFileSync('node_modules/playwright/package.json')).version},fixture_sha256:hash('fixtures/products.json'),lockfile_sha256:hash('package-lock.json'),checks:results}));
