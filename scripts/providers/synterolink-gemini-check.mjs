// Prueba de Gemini por Synterolink (no cambia config/models.json ni ningún experimento).
// 1) Lista los modelos Gemini que ofrece Synterolink. 2) Repite el diagnóstico del protocolo 1.1 (paquete V0 real y
// un historial corto, sin ejecutar acciones) con la misma configuración que se usó el 2026-10-10: formato nativo,
// razonamiento high, 16 384 tokens de salida y safetySettings BLOCK_NONE. Criterio: >= 9/10 acciones válidas.
// Uso: node --env-file=.env scripts/providers/synterolink-gemini-check.mjs [modelo] [--rounds=5]
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createProviderAdapter} from '../../runner/providers/adapter.mjs';
import {loadCorpus} from '../../runner/validation/corpus.mjs';
import {makePacket} from '../../runner/packet.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const key=[process.env.SYNTEROLINK_GOOGLE_API_KEY,process.env.SYNTEROLINK_API_KEY].find(v=>v&&v.trim()&&!v.includes('*'));
if(!key)throw Error('Falta SYNTEROLINK_GOOGLE_API_KEY o SYNTEROLINK_API_KEY en .env');
const args=process.argv.slice(2);
const model=args.find(a=>!a.startsWith('--'))??'gemini-3.1-pro-preview';
const rounds=Number(args.find(a=>/^--rounds=\d+$/.test(a))?.split('=')[1]??5);
const base='https://api.synterolink.com/v1beta';
const report={created_at:new Date().toISOString(),access_provider:'synterolink',base_url:base,model,rounds,models_available:null,calls:[],summary:null};
// 1) Modelos disponibles
try{const r=await fetch(`${base}/models`,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(60000)});
  const t=await r.text();let ids=null;try{const j=JSON.parse(t);ids=(j.models??j.data??[]).map(m=>String(m.name??m.id).replace(/^models\//,''));}catch{}
  report.models_available=ids?ids.filter(i=>/gemini/i.test(i)):{status:r.status,body:t.replaceAll(key,'[clave]').slice(0,300)};
}catch(e){report.models_available={error:String(e)};}
console.log('Modelos Gemini en Synterolink:',Array.isArray(report.models_available)?(report.models_available.join(', ')||'(ninguno)'):JSON.stringify(report.models_available));
// 2) Diagnóstico del protocolo
const config={display_name:`Gemini (${model}) por Synterolink`,api_model_id:model,transport:'google',access_provider:'synterolink',base_url:base,context:null,max_output_tokens:16384,reasoning:'high',temperature:null,seed:null,digest:null};
const SCENARIOS=[
  {name:'inicio',messages:[{role:'user',content:{source:'workspace',overview:{note:'Vista inicial',files:['src/App.tsx (120 B)','src/main.tsx (200 B)','TASK.json (9000 B)'],contents:{'src/App.tsx':'export default function App() {\n  return <main><h1>Scaffold base</h1></main>;\n}\n'}}}}]},
  {name:'tras_checks',messages:[{role:'assistant',content:{type:'run_checks'}},{role:'tool',content:{status:'FAIL',output:'== typecheck: FAIL\nsrc/App.tsx(3,7): error TS2322: Type string is not assignable to type number.'}}]}
];
const packet=makePacket(loadCorpus(root),'V0');
const adapter=createProviderAdapter({provider:'google',config,apiKey:key,onCall:c=>report.calls.push({status:c.status,error_code:c.error_code??null,observed_model:c.observed_model??null,duration_ms:c.duration_ms,tokens:c.tokens??null,finish_reason:c.finish_reason??null,safety_categories:c.safety_categories??null,finish_detail:c.finish_detail??null,action_type:c.action_type??null})});
for(let round=0;round<rounds;round++)for(const s of SCENARIOS){
  try{await adapter.next({provider:'google',attempt:1,cycle:round+1,packet,messages:s.messages},{timeout:300000});}catch{}
  const c=report.calls.at(-1);if(c){c.scenario=s.name;console.log(`  llamada ${report.calls.length}: ${c.status}${c.error_code?' '+c.error_code:''}${c.finish_reason?' · fin '+c.finish_reason:''} · ${Math.round((c.duration_ms??0)/1000)} s`);}
}
const ok=report.calls.filter(c=>c.status==='PASS');const errors={};for(const c of report.calls.filter(c=>c.status!=='PASS'))errors[c.error_code??c.finish_reason??'?']=(errors[c.error_code??c.finish_reason??'?']??0)+1;
const rate=report.calls.length?ok.length/report.calls.length:0;
report.summary={calls:report.calls.length,valid_actions:ok.length,valid_rate:+rate.toFixed(2),errors,status:rate>=0.9?'HEALTHY':rate>=0.5?'DEGRADED':'FAILING'};
console.log(`\nResultado: ${report.summary.status} — ${ok.length}/${report.calls.length} acciones válidas ${JSON.stringify(errors)}`);
console.log('Criterio para volver a usarlo: HEALTHY (>= 9/10) en dos pruebas de días distintos.');
mkdirSync(root+'.artifacts/providers',{recursive:true});
const path=`.artifacts/providers/synterolink-gemini-${report.created_at.replace(/[:.]/g,'-')}.json`;
writeFileSync(root+path,JSON.stringify(report,null,2)+'\n');console.log('Informe:',path);
