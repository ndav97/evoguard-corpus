import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createProviderAdapter} from './adapter.mjs';
import {requestJson} from './http.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const models=JSON.parse(readFileSync(join(root,'config/models.json'),'utf8')).models;
const credentials={openai:process.env.OPENAI_API_KEY,anthropic:process.env.ANTHROPIC_API_KEY,google:process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY};
async function main() {
  const [mode,...selected]=process.argv.slice(2);
  if(!['inspect','smoke'].includes(mode)||selected.some(p=>!models[p])||(mode==='inspect'&&selected.length))throw Error('Uso: providers inspect | providers smoke <proveedor...>');
  if(mode==='smoke'&&!selected.length)throw Error('Indica proveedores explícitos; no se llama al pool completo por defecto');
  const report={artifact_type:'provider_connectivity',experimental:false,created_at:new Date().toISOString(),mode,models:[]};
  let tags,version;
  try {
    version=await requestJson('http://127.0.0.1:11434/api/version',{signal:AbortSignal.timeout(5000)});
    tags=await requestJson('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(5000)});
  } catch { /* Se informa indisponibilidad sin inventar metadatos. */ }
  for(const provider of mode==='inspect'?Object.keys(models):selected) {
    const config=models[provider];
    const row={provider,display_name:config.display_name,api_model_id:config.api_model_id,status:'NOT_TESTED'};
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
main().catch(()=>{console.error('Diagnóstico no ejecutado: argumentos o configuración inválidos');process.exitCode=1;});
