import assert from 'node:assert/strict';
import { mkdirSync,appendFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runTask } from '../execution/engine.mjs';
import { openSandbox,execSandbox,closeSandbox } from '../sandbox/docker.mjs';
import { readContainerLock } from '../sandbox/lock.mjs';
import { loadCorpus,validateCorpus } from '../validation/corpus.mjs';
import { makePacket } from '../packet.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const scenarios=['repair','oracle-reassignment','exhaustion','tool-timeout'];
const wrapper=`import {spawnSync} from 'node:child_process';
const argv=JSON.parse(process.argv[1]);
const r=spawnSync(argv[0],argv.slice(1),{encoding:'utf8',timeout:Number(process.argv[2]),maxBuffer:1024*1024,shell:false});
console.log(JSON.stringify({status:r.error?.code==='ETIMEDOUT'?'TIMEOUT':r.error?'INFRA_ERROR':r.status===0?'PASS':'FAIL',output:((r.stdout??'')+(r.stderr??'')).slice(0,65536)}));`;
const snapshotCode=`const {execFileSync}=require('node:child_process');
execFileSync('git',['add','--all']);
process.stdout.write(execFileSync('git',['diff','--cached','--binary','--no-ext-diff','HEAD'],{maxBuffer:8*1024*1024}));`;

async function main() {
  if(process.argv.length>2) throw new Error('El ensayo usa únicamente escenarios internos, sin argumentos ni proveedores externos');
  const lock=readContainerLock(root), data=loadCorpus(root);
  assert.deepEqual(validateCorpus(data,root),[]);
  const id=randomUUID(), directory=join(root,'.artifacts/simulations',id);
  mkdirSync(directory,{recursive:true});
  const summary={artifact_type:'runner_simulation',experimental:false,id,image_id:lock.image_id,scenarios:[]};
  for(const scenario of scenarios) {
    console.log(`Ensayo simulado: ${scenario}`);
    let opened=0,closed=0;
    const workspaces={async open(){
      const session=openSandbox(root);opened++;
      return {
        async exec(argv,{timeout=60000}={}) {
          try {
            const output=execSandbox(session.name,session.image,['node','--input-type=module','-e',wrapper,JSON.stringify(argv),String(Math.max(1,timeout-1000))],{timeout});
            return JSON.parse(output);
          } catch(error) {
            if(error.clientAborted&&error.message.includes('ETIMEDOUT')) return {status:'TIMEOUT',output:''};
            throw error;
          }
        },
        async snapshot({timeout=60000}={}) {return execSandbox(session.name,session.image,['node','-e',snapshotCode],{timeout});},
        async close(){closeSandbox(session.name,session.image);closed++;}
      };
    }};
    const adapter={async next(context) {
      if(scenario==='tool-timeout') return {type:'tool',argv:['node','-e','setInterval(()=>{},1000)']};
      // Solo un marcador instrumental; nunca código del catálogo.
      if(context.cycle===1) return {type:'tool',argv:['node','-e',`const fs=require('node:fs');const p='simulation-marker.txt';const previous=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';if(${context.attempt}===1&&previous)throw Error('Inherited failed workspace');if(${context.attempt}>1&&!previous)throw Error('Lost repair workspace');fs.appendFileSync(p,${JSON.stringify(context.provider+':'+context.attempt+'\n')});console.log('simulation marker recorded');`]};
      return {type:'deliver'};
    }};
    let technicalCount=0,oracleCount=0;
    const evaluator={async check(stage,workspace,options) {
      let check={status:'PASS'};
      // build/typecheck se ejecutan realmente; los demás veredictos son simulados.
      if(stage==='typecheck'||stage==='build') {
        const command=stage==='typecheck'?['node','node_modules/typescript/bin/tsc','--noEmit']:['npm','run','build'];
        const outcome=await workspace.exec(command,options);
        check={status:outcome.status,feedback:outcome.output};
      }
      if(stage==='development_tests') {
        technicalCount++;
        if(scenario==='exhaustion'||(scenario==='repair'&&technicalCount===1)) check={status:'FAIL',feedback:'SIMULATED: development test failure; preserve previous work.'};
      }
      if(stage==='independent_oracle'&&scenario==='oracle-reassignment'&&++oracleCount===1) check={status:'FAIL',feedback:'PRIVATE_SIMULATED_ORACLE_DETAIL'};
      appendFileSync(join(directory,scenario+'.evaluator.jsonl'),JSON.stringify({simulated:true,stage,...check})+'\n');
      return check;
    }};
    const result=await runTask({mode:'simulation',packet:makePacket(data,'V0'),policy:data.policy,initialProvider:'openai',adapter,workspaces,evaluator,
      ...(scenario==='tool-timeout'?{simulationTimeoutMs:2500}:{}),
      emit:event=>appendFileSync(join(directory,scenario+'.events.jsonl'),JSON.stringify(event)+'\n')});
    writeFileSync(join(directory,scenario+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    assert.equal(result.status,['exhaustion','tool-timeout'].includes(scenario)?'SIMULATED_BLOCKED':'SIMULATED_ACCEPTED');
    assert.equal(opened,scenario==='repair'?1:scenario==='oracle-reassignment'?2:5);
    assert.equal(closed,opened);
    assert.equal(result.attempts.length,scenario==='exhaustion'?15:scenario==='tool-timeout'?5:2);
    if(scenario==='tool-timeout') assert.ok(result.attempts.every(a=>a.reason==='TIMEOUT'&&Object.keys(a.validation).length===0));
    else assert.ok(result.attempts.every(a=>typeof a.snapshot==='string'&&a.snapshot.includes('simulation-marker.txt')));
    assert.ok(result.events.filter(e=>e.type==='attempt_started').every(e=>!JSON.stringify(e).includes('PRIVATE_SIMULATED_ORACLE_DETAIL')));
    summary.scenarios.push({name:scenario,status:result.status,attempts:result.attempts.length,workspaces_opened:opened,workspaces_closed:closed});
  }
  summary.status='PASS';
  writeFileSync(join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  console.log(`PASS: simulaciones guardadas en ${directory}`);
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
