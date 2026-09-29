import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProviderAdapter} from './adapter.mjs';
import {requestJson} from './http.mjs';
import {connectionFor,credentialsFromEnv} from './connection.mjs';
import {ollamaBase} from './ollama.mjs';
import {loadCorpus} from '../validation/corpus.mjs';
import {makePacket} from '../packet.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const models=JSON.parse(readFileSync(join(root,'config/models.json'),'utf8')).models;
const credentials=credentialsFromEnv(models,process.env);
// Diagnóstico del protocolo 1.1 con contexto realista (paquete V0 y un historial corto). No ejecuta ninguna acción.
async function diagnose(args) {
  const rounds=Number(args.find(a=>/^--rounds=\d+$/.test(a))?.split('=')[1]??5);
  const selected=args.filter(a=>!a.startsWith('--'));
  const providers=selected.length?selected:['openai','anthropic','google'];
  if(providers.some(p=>!models[p])||!Number.isInteger(rounds)||rounds<1||rounds>20)throw Error('Uso: providers diagnose [proveedor...] [--rounds=N]');
  const packet=makePacket(loadCorpus(root),'V0');
  const scenarios=[
    {name:'inicio',messages:[{role:'user',content:{source:'workspace',overview:{note:'Vista inicial',files:['src/App.tsx (120 B)','src/main.tsx (200 B)','TASK.json (9000 B)'],contents:{'src/App.tsx':'export default function App() {\n  return <main><h1>Scaffold base</h1></main>;\n}\n'}}}}]},
    {name:'tras_checks',messages:[{role:'assistant',content:{type:'run_checks'}},{role:'tool',content:{status:'FAIL',output:'== typecheck: FAIL\nsrc/App.tsx(3,7): error TS2322: Type string is not assignable to type number.'}}]}
  ];
  const report={artifact_type:'provider_protocol_diagnosis',experimental:false,created_at:new Date().toISOString(),protocol_version:'1.1',rounds,providers:{}};
  for(const provider of providers) {
    const config=models[provider];
    const row=report.providers[provider]={model:config.api_model_id,calls:[],summary:null};
    if(config.transport!=='ollama'&&!credentials[provider]){row.summary={status:'CREDENTIAL_MISSING'};console.log(`${provider}: sin credencial`);continue;}
    const adapter=createProviderAdapter({provider,config,apiKey:credentials[provider],onCall:call=>row.calls.push({status:call.status,error_code:call.error_code,observed_model:call.observed_model,duration_ms:call.duration_ms,tokens:call.tokens,normalization:call.normalization??null,discarded_chars:call.discarded_chars??null,action_type:call.action_type??null,rejected_output:call.rejected_output??null})});
    for(let round=0;round<rounds;round++) for(const scenario of scenarios) {
      try {await adapter.next({provider,attempt:1,cycle:round+1,packet,messages:scenario.messages},{timeout:300000});} catch { /* registrado en onCall */ }
      row.calls.at(-1).scenario=scenario.name;
    }
    const ok=row.calls.filter(c=>c.status==='PASS');
    const codes={};for(const c of row.calls.filter(c=>c.status!=='PASS'))codes[c.error_code]=(codes[c.error_code]??0)+1;
    row.summary={calls:row.calls.length,valid_actions:ok.length,valid_rate:+(ok.length/row.calls.length).toFixed(2),errors:codes,normalized_fence:ok.filter(c=>c.normalization==='markdown_fence').length,normalized_prose:ok.filter(c=>String(c.normalization).startsWith('prose_prefix')).length,actions:ok.map(c=>c.action_type),median_ms:row.calls.map(c=>c.duration_ms).sort((a,b)=>a-b)[Math.floor(row.calls.length/2)]};
    row.summary.status=row.summary.valid_rate>=0.9?'HEALTHY':row.summary.valid_rate>=0.5?'DEGRADED':'FAILING';
    console.log(`${provider}: ${row.summary.status} — ${ok.length}/${row.calls.length} acciones válidas ${JSON.stringify(codes)}`);
    const sample=row.calls.find(c=>c.rejected_output)?.rejected_output;
    if(sample)console.log(`  ejemplo rechazado (${sample.length} car.): ${JSON.stringify(sample.head.slice(0,300))}`);
  }
  const directory=join(root,'.artifacts/providers');mkdirSync(directory,{recursive:true});
  const path=join(directory,`diagnose-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(`Informe: ${path}`);
  if(Object.values(report.providers).some(p=>p.summary?.status!=='HEALTHY'))process.exitCode=1;
}

async function main() {
  const [mode,...selected]=process.argv.slice(2);
  if(mode==='diagnose') return diagnose(selected);
  if(!['inspect','smoke'].includes(mode)||selected.some(p=>!models[p])||(mode==='inspect'&&selected.length))throw Error('Uso: providers inspect | providers smoke <proveedor...> | providers diagnose [proveedor...] [--rounds=N]');
  if(mode==='smoke'&&!selected.length)throw Error('Indica proveedores explícitos; no se llama al pool completo por defecto');
  const report={artifact_type:'provider_connectivity',experimental:false,created_at:new Date().toISOString(),mode,models:[]};
  let tags,version;
  try {
    version=await requestJson(`${ollamaBase()}/api/version`,{signal:AbortSignal.timeout(5000)});
    tags=await requestJson(`${ollamaBase()}/api/tags`,{signal:AbortSignal.timeout(5000)});
  } catch { /* Se informa indisponibilidad sin inventar metadatos. */ }
  for(const provider of mode==='inspect'?Object.keys(models):selected) {
    const config=models[provider];
    const connection=connectionFor(provider,config);
    const row={provider,access_provider:connection.access_provider,base_url:connection.base_url,credential_env:connection.credential_env,display_name:config.display_name,api_model_id:config.api_model_id,status:'NOT_TESTED'};
    if(config.transport==='ollama') {
      const local=tags?.models?.find(m=>m.name===config.api_model_id);
      row.runtime=version?.version??null;
      row.local=local?{digest:local.digest,format:local.details?.format??null,parameter_size:local.details?.parameter_size??null,quantization:local.details?.quantization_level??null,configured_context:config.context}:null;
      row.status=!local?'LOCAL_UNAVAILABLE':local.digest!==config.digest?'DIGEST_MISMATCH':'LOCAL_PRESENT';
    } else row.status=credentials[provider]?'CREDENTIAL_PRESENT_NOT_TESTED':'CREDENTIAL_MISSING';
    if(mode==='smoke'&&['LOCAL_PRESENT','CREDENTIAL_PRESENT_NOT_TESTED'].includes(row.status)) {
      const adapter=createProviderAdapter({provider,config,apiKey:credentials[provider],onCall:call=>{row.call=call;}});
      try {
        const action=await adapter.next({provider,attempt:1,cycle:1,packet:{request:'Connectivity check only. No repository or coding task. Return type deliver with empty argv.'},messages:[]},{timeout:180000});
        row.status=action.type==='deliver'?'SMOKE_PASS':'UNEXPECTED_ACTION';
        // Nunca ejecutar argv de una prueba de conectividad.
      } catch(error) {row.status='SMOKE_FAILED';row.error_code=error.code??'UNKNOWN_ERROR';}
    }
    report.models.push(row);console.log(`${provider}: ${row.status}`);
  }
  const directory=join(root,'.artifacts/providers');mkdirSync(directory,{recursive:true});
  const path=join(directory,`${mode}-${randomUUID()}.json`);
  writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(`Informe: ${path}`);
  if(mode==='smoke'&&report.models.some(m=>m.status!=='SMOKE_PASS'))process.exitCode=1;
}
main().catch(error=>{console.error(`Diagnóstico no ejecutado: ${/^(Uso:|providers)/.test(error.message)?error.message:'argumentos o configuración inválidos'}`);process.exitCode=1;});
