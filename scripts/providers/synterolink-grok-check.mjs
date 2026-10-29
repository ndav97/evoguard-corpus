// Prueba de Grok por Synterolink (no cambia config/models.json ni ningún experimento).
// 1) Lista los modelos Grok de la clave. 2) Repite el diagnóstico del protocolo 1.1 (paquete V0 real y un historial
// corto, sin ejecutar acciones). Prueba primero la API Responses (la que usa GPT en el estudio) y, si la pasarela no
// la admite, Chat Completions (OpenAI-compatible, como en la configuración de OpenCode). Criterio: >= 9/10 válidas.
// Clave: SYNTEROLINK_GROK_API_KEY en .env (no se imprime).
// Uso: node --env-file=.env scripts/providers/synterolink-grok-check.mjs [modelo] [--rounds=5] [--mode=auto|responses|chat]
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createProviderAdapter,INSTRUCTION,RESPONSE_CONTRACT,ACTION_SCHEMA,completeActionFields} from '../../runner/providers/adapter.mjs';
import {parseAction} from '../../runner/protocol/actions.mjs';
import {loadCorpus} from '../../runner/validation/corpus.mjs';
import {makePacket} from '../../runner/packet.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const key=[process.env.SYNTEROLINK_GROK_API_KEY].find(v=>v&&v.trim()&&!v.includes('*'));
if(!key)throw Error('Falta SYNTEROLINK_GROK_API_KEY en .env');
const args=process.argv.slice(2);
const model=args.find(a=>!a.startsWith('--'))??'grok-4.5';
const rounds=Number(args.find(a=>/^--rounds=\d+$/.test(a))?.split('=')[1]??5);
let mode=args.find(a=>a.startsWith('--mode='))?.split('=')[1]??'auto';
const base='https://api.synterolink.com/v1';
const clip=t=>String(t).replaceAll(key,'[clave]').slice(0,400);
const report={created_at:new Date().toISOString(),access_provider:'synterolink',base_url:base,model,rounds,mode_requested:mode,mode_used:null,models_available:null,calls:[],summary:null};
// 1) Modelos disponibles
try{const r=await fetch(`${base}/models`,{headers:{authorization:`Bearer ${key}`},signal:AbortSignal.timeout(60000)});const t=await r.text();
  try{report.models_available=(JSON.parse(t).data??[]).map(m=>m.id);}catch{report.models_available={status:r.status,body:clip(t)};}
}catch(e){report.models_available={error:String(e)};}
const ids=Array.isArray(report.models_available)?report.models_available:[];
console.log('Modelos en la clave:',ids.length?ids.join(', '):JSON.stringify(report.models_available));
const SCENARIOS=[
  {name:'inicio',messages:[{role:'user',content:{source:'workspace',overview:{note:'Vista inicial',files:['src/App.tsx (120 B)','src/main.tsx (200 B)','TASK.json (9000 B)'],contents:{'src/App.tsx':'export default function App() {\n  return <main><h1>Scaffold base</h1></main>;\n}\n'}}}}]},
  {name:'tras_checks',messages:[{role:'assistant',content:{type:'run_checks'}},{role:'tool',content:{status:'FAIL',output:'== typecheck: FAIL\nsrc/App.tsx(3,7): error TS2322: Type string is not assignable to type number.'}}]}
];
const packet=makePacket(loadCorpus(root),'V0');
const record=c=>report.calls.push(c);
// Modo Responses: el mismo adaptador que usa GPT-5.6 Sol en el estudio.
const responses=createProviderAdapter({provider:'openai',config:{display_name:`Grok (${model})`,api_model_id:model,transport:'openai',access_provider:'synterolink',base_url:base,context:null,max_output_tokens:16384,reasoning:'medium',temperature:null,seed:null,digest:null},apiKey:key,
  onCall:c=>record({mode:'responses',status:c.status,error_code:c.error_code??null,error_detail:c.error_detail?clip(c.error_detail):null,observed_model:c.observed_model??null,duration_ms:c.duration_ms,tokens:c.tokens??null,finish_reason:c.finish_reason??null,action_type:c.action_type??null})});
// Modo Chat Completions (OpenAI-compatible), con el mismo contrato y el mismo validador de acciones.
async function chat(s,cycle){
  const started=Date.now(),row={mode:'chat',status:'ERROR',error_code:null,observed_model:null,finish_reason:null,action_type:null};
  try{
    const input=JSON.stringify({response_contract:RESPONSE_CONTRACT,packet,messages:s.messages,attempt:1,cycle});
    const r=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},signal:AbortSignal.timeout(300000),
      body:JSON.stringify({model,max_tokens:16384,messages:[{role:'system',content:INSTRUCTION},{role:'user',content:input}],response_format:{type:'json_schema',json_schema:{name:'runner_action',strict:true,schema:ACTION_SCHEMA}}})});
    const t=await r.text();if(!r.ok){row.error_code=`HTTP_${r.status}`;row.error_detail=clip(t);return row;}
    const j=JSON.parse(t);row.observed_model=j.model??null;row.finish_reason=j.choices?.[0]?.finish_reason??null;row.tokens={input:j.usage?.prompt_tokens??null,output:j.usage?.completion_tokens??null,reasoning:j.usage?.completion_tokens_details?.reasoning_tokens??null};
    if(row.finish_reason&&row.finish_reason!=='stop'){row.error_code='INCOMPLETE_RESPONSE';return row;}
    const text=completeActionFields(j.choices?.[0]?.message?.content??'').text;
    try{const p=parseAction(text);row.status='PASS';row.action_type=p.action.type;row.normalization=p.normalization;}catch(e){row.error_code=e.code??'INVALID_ACTION_JSON';row.rejected_output=clip(text);}
  }catch(e){row.error_code=e.name==='TimeoutError'?'REQUEST_ABORTED':'NETWORK_ERROR';row.error_detail=clip(e);}
  finally{row.duration_ms=Date.now()-started;}
  return row;
}
const show=c=>console.log(`  llamada ${report.calls.length} (${c.mode}): ${c.status}${c.error_code?' '+c.error_code:''}${c.action_type?' · '+c.action_type:''}${c.finish_reason?' · fin '+c.finish_reason:''} · ${Math.round((c.duration_ms??0)/1000)} s`);
async function one(m,s,cycle){if(m==='responses'){try{await responses.next({provider:'openai',attempt:1,cycle,packet,messages:s.messages},{timeout:300000});}catch{}const c=report.calls.at(-1);c.scenario=s.name;show(c);return c;}
  const c=await chat(s,cycle);c.scenario=s.name;record(c);show(c);return c;}
if(mode==='auto'){
  console.log('Probando la API Responses...');const c=await one('responses',SCENARIOS[0],1);
  if(c.status==='PASS'){mode='responses';}else{console.log(`Responses no funcionó (${c.error_code}); se prueba Chat Completions.`);mode='chat';report.calls=[];}
}
report.mode_used=mode;
for(let round=0;round<rounds;round++)for(const s of SCENARIOS){if(report.calls.length>=rounds*SCENARIOS.length)break;await one(mode,s,round+1);}
const ok=report.calls.filter(c=>c.status==='PASS');const errors={};for(const c of report.calls.filter(c=>c.status!=='PASS'))errors[c.error_code??'?']=(errors[c.error_code??'?']??0)+1;
const rate=report.calls.length?ok.length/report.calls.length:0;
report.summary={calls:report.calls.length,valid_actions:ok.length,valid_rate:+rate.toFixed(2),errors,status:rate>=0.9?'HEALTHY':rate>=0.5?'DEGRADED':'FAILING'};
console.log(`\nResultado (${model}, ${mode}): ${report.summary.status} — ${ok.length}/${report.calls.length} acciones válidas ${JSON.stringify(errors)}`);
const sample=report.calls.find(c=>c.error_detail||c.rejected_output);if(sample)console.log('Ejemplo de error:',sample.error_detail??sample.rejected_output);
mkdirSync(root+'.artifacts/providers',{recursive:true});
const path=`.artifacts/providers/synterolink-grok-${model}-${report.created_at.replace(/[:.]/g,'-')}.json`;
writeFileSync(root+path,JSON.stringify(report,null,2)+'\n');console.log('Informe:',path);
