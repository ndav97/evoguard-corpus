import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runTask } from '../runner/execution/engine.mjs';
const policy=JSON.parse(readFileSync(new URL('../config/policy.json',import.meta.url)));
function harness(next,check=async()=>({status:'PASS'})) {
  const spaces=[];
  return {spaces, options:{mode:'simulation',packet:{version:'V0',requirements:[{id:'R001'},{id:'R002'}]},policy,initialProvider:'openai',adapter:{next},evaluator:{check},workspaces:{async open(){
    const w={text:'',closed:false,async exec(argv){this.text+=argv.join(' ');return {status:'PASS',output:this.text};},async snapshot(){return this.text;},async close(){this.closed=true;}};
    spaces.push(w);return w;
  }}}};
}
test('reparación conserva parche propio y solo feedback técnico',async()=>{
  const h=harness(async ctx=>ctx.cycle===1?{type:'tool',argv:['write',String(ctx.attempt)]}:{type:'deliver'},async(stage,w)=>stage==='build'&&!w.text.includes('2')?{status:'FAIL',feedback:'build visible'}:{status:'PASS'});
  const r=await runTask(h.options);
  assert.equal(r.status,'SIMULATED_ACCEPTED');assert.equal(h.spaces.length,1);
  assert.equal(h.spaces[0].text,'write 1write 2');assert.ok(h.spaces[0].closed);
  assert.deepEqual(r.attempts.map(a=>a.outcome),['REPAIR','SIMULATED_ACCEPTED']);
});
test('oracle fallido cambia proveedor con workspace limpio y sin feedback privado',async()=>{
  const seen=[];
  const h=harness(async ctx=>{seen.push(JSON.stringify(ctx));return ctx.cycle===1?{type:'tool',argv:[ctx.provider]}:{type:'deliver'};},async(stage,w)=>stage==='independent_oracle'&&w.text==='openai'?{status:'FAIL',feedback:'PRIVATE_ORACLE_CANARY'}:{status:'PASS'});
  const r=await runTask(h.options);
  assert.equal(r.status,'SIMULATED_ACCEPTED');assert.equal(h.spaces.length,2);
  assert.equal(h.spaces[1].text,'anthropic');assert.ok(h.spaces.every(s=>s.closed));
  assert.ok(seen.every(s=>!s.includes('PRIVATE_ORACLE_CANARY')));
  assert.deepEqual(r.attempts.map(a=>a.attempt),[1,1]);
});
test('fallo técnico agota tres entregas por proveedor y cinco proveedores sin repetir',async()=>{
  const h=harness(async()=>({type:'deliver'}),async()=>({status:'FAIL',feedback:'visible'}));
  h.options.initialProvider='google';
  const r=await runTask(h.options);
  assert.equal(r.status,'SIMULATED_BLOCKED');assert.equal(r.attempts.length,15);assert.equal(h.spaces.length,5);
  assert.deepEqual(r.attempts.filter(a=>a.attempt===1).map(a=>a.provider),['google','local_a','local_b','openai','anthropic']);
  assert.ok(h.spaces.every(s=>s.closed));
});
test('no ejecuta el ciclo 26 y reasigna al agotar ciclos',async()=>{
  const h=harness(async()=>({type:'tool',argv:['x']}));
  const r=await runTask(h.options);
  assert.equal(r.status,'SIMULATED_BLOCKED');assert.equal(r.attempts.length,5);
  assert.ok(h.spaces.every(s=>s.text.length===25&&s.closed));
});
test('infraestructura del evaluador no se convierte en fallo funcional ni fallback',async()=>{
  const h=harness(async()=>({type:'deliver'}),async()=>({status:'INFRA_ERROR'}));
  const r=await runTask(h.options);
  assert.equal(r.status,'INFRA_ERROR');assert.equal(h.spaces.length,1);assert.ok(h.spaces[0].closed);
});
test('respuesta y evaluación desconocidas no aceptan candidato',async()=>{
  for(const options of [harness(async()=>({type:'bogus'})),harness(async()=>({type:'deliver'}),async()=>({status:'UNKNOWN'}))]) {
    const r=await runTask(options.options);assert.equal(r.status,'INFRA_ERROR');assert.ok(options.spaces[0].closed);
  }
});
test('rechaza ejecución real y políticas relajadas antes de crear workspace',async()=>{
  const h=harness(async()=>({type:'deliver'}));
  await assert.rejects(runTask({...h.options,mode:'real'}));
  await assert.rejects(runTask({...h.options,policy:{...policy,max_attempts:4}}));
  assert.equal(h.spaces.length,0);
});
test('timeout aborta adaptador y cierra cada asignación sin reparación',async()=>{
  let aborted=0;
  const h=harness((ctx,{signal})=>new Promise(()=>signal.addEventListener('abort',()=>aborted++,{once:true})));
  const r=await runTask({...h.options,simulationTimeoutMs:10});
  assert.equal(r.status,'SIMULATED_BLOCKED');assert.equal(aborted,5);
  assert.equal(r.attempts.length,5);assert.ok(h.spaces.every(s=>s.closed));
});
test('excepción del adaptador se registra como infraestructura y limpia recursos',async()=>{
  const h=harness(async()=>{throw Error('transport down');});
  const r=await runTask(h.options);assert.equal(r.status,'INFRA_ERROR');assert.ok(h.spaces[0].closed);
});
test('timeout de herramienta reasigna y nunca se presenta como fallo funcional',async()=>{
  const h=harness(async()=>({type:'tool',argv:['wait']}));
  h.options.workspaces.open=async()=>({async exec(){return {status:'TIMEOUT',output:''};},async snapshot(){return '';},async close(){}});
  const r=await runTask(h.options);
  assert.equal(r.status,'SIMULATED_BLOCKED');assert.equal(r.attempts.length,5);
  assert.ok(r.attempts.every(a=>a.reason==='TIMEOUT'&&Object.keys(a.validation).length===0));
});
test('fallo de snapshot o cierre nunca deja una aceptación simulada',async()=>{
  for(const method of ['snapshot','close']) {
    const h=harness(async()=>({type:'deliver'}));
    const original=h.options.workspaces.open;
    h.options.workspaces.open=async()=>{const w=await original();w[method]=async()=>{throw Error('storage');};return w;};
    const r=await runTask(h.options);assert.equal(r.status,'INFRA_ERROR');assert.equal(h.spaces.length,1);
  }
});
test('fallo al registrar detiene ejecución y cierra workspace',async()=>{
  const h=harness(async()=>({type:'deliver'}));
  await assert.rejects(runTask({...h.options,emit(){throw Error('disk full');}}));
  assert.ok(h.spaces[0].closed);
});
test('resultado técnico FAIL impide llamar al oráculo en ese intento',async()=>{
  const h=harness(async()=>({type:'deliver'}),async stage=>stage==='development_tests'?{status:'FAIL',feedback:'visible'}:stage==='independent_oracle'?{status:'INFRA_ERROR'}:{status:'PASS'});
  const r=await runTask(h.options);assert.equal(r.status,'SIMULATED_BLOCKED');
  assert.ok(r.attempts.every(a=>!('independent_oracle' in a.validation)));
});
test('timeout al preservar candidato no acepta resultado sin evidencia',async()=>{
  const h=harness(async()=>({type:'deliver'}));
  const original=h.options.workspaces.open;
  h.options.workspaces.open=async()=>{const w=await original();w.snapshot=()=>new Promise(()=>{});return w;};
  const r=await runTask({...h.options,simulationTimeoutMs:10});
  assert.equal(r.status,'SIMULATED_BLOCKED');assert.equal(r.attempts.length,5);
  assert.ok(r.attempts.every(a=>a.outcome==='REASSIGN'&&a.reason==='TIMEOUT'));
});
