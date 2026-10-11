// Sondeo de VNAIPro (pasarela New API) para Gemini: lista los modelos disponibles y prueba una llamada mínima en los
// formatos nativo de Gemini y compatible con OpenAI. No imprime la clave; guarda el resultado en .artifacts/providers.
// Uso: node --env-file=.env scripts/providers/vnaipro-check.mjs
import {writeFileSync,mkdirSync} from 'node:fs';
const key=process.env.VNAIPRO_API_KEY;if(!key)throw Error('Falta VNAIPRO_API_KEY en .env');
const base='https://apikey.vnaipro.app',out={created_at:new Date().toISOString()};
const clip=t=>t.replaceAll(key,'[clave]').slice(0,600);
async function call(name,url,init){try{const r=await fetch(url,{...init,signal:AbortSignal.timeout(120000)});out[name]={status:r.status,body:clip(await r.text())};}catch(e){out[name]={error:String(e)};}console.log(name,out[name].status??out[name].error);}
await call('models',`${base}/v1/models`,{headers:{authorization:`Bearer ${key}`}});
{const r=await fetch(`${base}/v1/models`,{headers:{authorization:`Bearer ${key}`}}).catch(()=>null);if(r?.ok){const j=await r.json();out.model_ids=(j.data??[]).map(m=>m.id);out.models.body='(lista completa en model_ids)';}}
const model=process.argv[2]??'gemini-3.8-flash';out.model=model;
await call('gemini_native',`${base}/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Responde solo: hola'}]}],generationConfig:{maxOutputTokens:2048}})});
await call('openai_chat',`${base}/v1/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'user',content:'Responde solo: hola'}],max_tokens:2048})});
mkdirSync('.artifacts/providers',{recursive:true});
const path=`.artifacts/providers/vnaipro-check-${out.created_at.replace(/[:.]/g,'-')}.json`;writeFileSync(path,JSON.stringify(out,null,2));
console.log('modelos gemini:',(out.model_ids??[]).filter(i=>/gemini/i.test(i)).join(', ')||'(ninguno o sin lista)');console.log('Informe:',path);
