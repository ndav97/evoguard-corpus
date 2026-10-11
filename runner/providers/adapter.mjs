import {requestJson,requestSse,providerError} from './http.mjs';
import {connectionFor} from './connection.mjs';
import {ollamaBase} from './ollama.mjs';
import {createHash} from 'node:crypto';
import {buildContextInput,loadContextPolicy} from '../context/policy.mjs';
import {ACTION_SCHEMA,INSTRUCTION,RESPONSE_CONTRACT,PROTOCOL_VERSION,parseAction,rejectedSample} from '../protocol/actions.mjs';
export {ACTION_SCHEMA,INSTRUCTION,RESPONSE_CONTRACT,PROTOCOL_VERSION};
// La ranura google admite Gemini (API) o un modelo abierto de Google servido por Ollama (Gemma, decisión 2026-10-11).
const TRANSPORT={openai:['openai'],anthropic:['anthropic'],google:['google','ollama'],local_a:['ollama'],local_b:['ollama']};
export const isOllamaConfig=config=>config?.transport==='ollama';
// Anthropic (Sonnet 5 vía Synterolink): transporte F de la sonda del 2026-10-09 (10/10 válidas). Herramienta nativa en
// modo estricto con razonamiento adaptativo: el intermediario no aplica output_config.format y la herramienta sí.
export const ANTHROPIC_TOOL={name:'runner_action',description:'Submit the next runner action (protocol 1.1). Call it exactly once per turn.',input_schema:ACTION_SCHEMA,strict:true};
// Caché de prompts de Anthropic: la entrada (el mismo JSON que reciben los demás modelos) se parte en bloques de texto
// (cabecera, un bloque por mensaje, cierre) con cache_control en el último mensaje. La concatenación es idéntica a la
// entrada; en la llamada siguiente el prefijo coincide en un límite de bloque y se lee de caché.
export function anthropicBlocks(context,input){
  const head=`{"response_contract":${JSON.stringify(RESPONSE_CONTRACT)},"packet":${JSON.stringify(context.packet)},"messages":[`;
  const messages=(context.messages??[]).map((m,i)=>(i?',':'')+JSON.stringify(m));
  const tail=`],"attempt":${JSON.stringify(context.attempt)},"cycle":${JSON.stringify(context.cycle)}}`;
  const blocks=messages.length?[head,...messages,tail]:[head+tail];
  if(blocks.join('')!==input)return [{type:'text',text:input}];
  const marked=messages.length?blocks.length-2:0;
  return blocks.map((text,i)=>i===marked?{type:'text',text,cache_control:{type:'ephemeral'}}:{type:'text',text});
}
const number=value=>Number.isFinite(value)&&value>=0?value:null;
// Gemini cerró respuestas con finishReason SAFETY al trabajar sobre código ordinario (diagnóstico 2026-10-11: 8 de 10).
// Los filtros de contenido configurables se desactivan para que un falso positivo no cuente como fallo del modelo; las
// categorías activadas se registran (safety_categories) para que cualquier bloqueo restante sea visible.
export const GEMINI_TOOL={name:'runner_action',description:'Submit the next runner action (protocol 1.1). Call it exactly once per turn.'};
export const GEMINI_SAFETY=['HARM_CATEGORY_HARASSMENT','HARM_CATEGORY_HATE_SPEECH','HARM_CATEGORY_SEXUALLY_EXPLICIT','HARM_CATEGORY_DANGEROUS_CONTENT'].map(category=>({category,threshold:'BLOCK_NONE'}));
// Campos vacíos omitidos (decisión 2026-10-10): el protocolo exige los seis campos de la acción, incluso vacíos, y el
// esquema estricto se pide a cada proveedor, pero Synterolink no lo hace cumplir. Si la respuesta es un objeto JSON con
// «type» y solo claves del protocolo, los campos ausentes se completan con su valor vacío ("" o []) antes de validar.
// Igual para todos los proveedores y registrado en la llamada (filled_fields). Una clave desconocida o mal escrita
// («action» en lugar de «type») no se completa: sigue siendo una acción inválida del modelo.
const ACTION_FIELDS={argv:[],content:'',find:'',path:'',replace:''};
export function completeActionFields(text){
  if(typeof text!=='string')return {text,filled:[]};
  const trimmed=text.trim(),fence=trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  let action;
  try{action=JSON.parse(fence?fence[1]:trimmed);}catch{return {text,filled:[]};}
  if(!action||typeof action!=='object'||Array.isArray(action)||typeof action.type!=='string')return {text,filled:[]};
  if(Object.keys(action).some(k=>k!=='type'&&!(k in ACTION_FIELDS)))return {text,filled:[]};
  const filled=Object.keys(ACTION_FIELDS).filter(k=>!(k in action));
  if(!filled.length)return {text,filled};
  for(const k of filled)action[k]=structuredClone(ACTION_FIELDS[k]);
  return {text:JSON.stringify(action),filled};
}
export function createProviderAdapter({provider,config,apiKey,fetchImpl=fetch,onCall=()=>{},contextPolicy=loadContextPolicy()}) {
  if(!TRANSPORT[provider]?.includes(config?.transport)||!config?.api_model_id||!Number.isInteger(config.max_output_tokens)||config.max_output_tokens<1)throw providerError('INVALID_MODEL_CONFIG');
  config=structuredClone(config);
  const connection=connectionFor(provider,config);
  if(config.transport==='ollama'&&(!Number.isInteger(config.context)||config.context<4096||config.context>262144||!/^[a-f0-9]{64}$/.test(config.digest??'')))throw providerError('INVALID_LOCAL_CONFIG');
  // Ventana limitada => contexto gestionado (config/context.json). Comerciales: contexto completo, sin cambios.
  const managed=contextPolicy.applies_to.includes(provider)&&config.transport==='ollama';
  if(managed!==(config.context!==null))throw providerError('CONTEXT_POLICY_MISMATCH');
  if(managed&&(contextPolicy.budget.context_tokens!==config.context||contextPolicy.budget.output_reserve_tokens!==config.max_output_tokens))throw providerError('CONTEXT_POLICY_MISMATCH');
  return {provider,exactModel:config.api_model_id,async next(context,{signal,timeout=config.transport==='ollama'?3600000:1800000}={}) {
    if(context.provider!==provider)throw providerError('PROVIDER_MISMATCH');
    if(!Number.isInteger(timeout)||timeout<1)throw providerError('INVALID_TIMEOUT');
    signal?.throwIfAborted();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    const started=Date.now();
    const metadata={provider,access_provider:connection.access_provider,base_url:connection.base_url,display_name:config.display_name,requested_model:config.api_model_id,observed_model:null,started_at:new Date(started).toISOString(),parameters:{context:config.context,max_output_tokens:config.max_output_tokens,reasoning:config.reasoning,temperature:config.temperature,seed:config.seed},digest:config.digest,tokens:{input:null,output:null,reasoning:null},cost_usd:null,status:'ERROR',error_code:null,protocol_version:PROTOCOL_VERSION};
    const request=(url,body,headers)=>requestJson(url,{body,headers,signal:combined,fetchImpl});
    const verifyLocal=async()=>{
      const tags=await request(`${ollamaBase()}/api/tags`);
      if(!tags.models?.some(m=>m.name===config.api_model_id&&m.digest===config.digest))throw providerError('MODEL_DIGEST_MISMATCH');
    };
    try {
      if(config.transport!=='ollama'&&(!apiKey||typeof apiKey!=='string'))throw providerError('CREDENTIAL_MISSING');
      // Allowlist outer context: never serialize the coordinator or its private fields.
      let input,trace;
      if(managed) {
        try {({input,trace}=buildContextInput({packet:context.packet,messages:context.messages,attempt:context.attempt,cycle:context.cycle},{policy:contextPolicy,responseContract:RESPONSE_CONTRACT,overhead:INSTRUCTION+JSON.stringify(ACTION_SCHEMA)}));}
        catch(error) {throw providerError(/^CONTEXT_/.test(error.code??'')?error.code:'CONTEXT_POLICY_ERROR');}
      } else {
        input=JSON.stringify({response_contract:RESPONSE_CONTRACT,packet:context.packet,messages:context.messages,attempt:context.attempt,cycle:context.cycle});
        trace={policy:'full_context',input_bytes:Buffer.byteLength(input),input_sha256:createHash('sha256').update(input).digest('hex')};
      }
      metadata.context=trace;
      if(Buffer.byteLength(input)>1048576)throw providerError('INPUT_TOO_LARGE');
      let raw,text;
      if(config.transport==='openai') {
        ({response:raw,streamed:metadata.streamed}=await requestSse(`${connection.base_url}/responses`,{body:{model:config.api_model_id,stream:true,store:false,instructions:INSTRUCTION,input,reasoning:{effort:config.reasoning},max_output_tokens:config.max_output_tokens,text:{format:{type:'json_schema',name:'runner_action',strict:true,schema:ACTION_SCHEMA}}},headers:{authorization:`Bearer ${apiKey}`},signal:combined,fetchImpl}));
        metadata.observed_model=raw.model;
        metadata.tokens={input:number(raw.usage?.input_tokens),output:number(raw.usage?.output_tokens),reasoning:number(raw.usage?.output_tokens_details?.reasoning_tokens),cached:number(raw.usage?.input_tokens_details?.cached_tokens),cache_write:null};
        metadata.finish_reason=raw.status==='completed'?'completed':`${raw.status}${raw.incomplete_details?.reason?':'+raw.incomplete_details.reason:''}`;
        if(raw.status!=='completed')throw providerError('INCOMPLETE_RESPONSE');
        const blocks=raw.output?.filter(o=>o.type==='message').flatMap(o=>o.content??[])??[];
        if(blocks.some(b=>b.type==='refusal'))throw providerError('MODEL_REFUSAL');
        text=blocks.filter(b=>b.type==='output_text').map(b=>b.text).join('');
      } else if(config.transport==='anthropic') {
        const content=managed?input:anthropicBlocks(context,input);
        raw=await request(`${connection.base_url}/messages`,{model:config.api_model_id,max_tokens:config.max_output_tokens,system:INSTRUCTION,messages:[{role:'user',content}],thinking:{type:'adaptive'},output_config:{effort:config.reasoning},tools:[ANTHROPIC_TOOL],tool_choice:{type:'auto'}},{'x-api-key':apiKey,'anthropic-version':'2023-06-01'});
        metadata.observed_model=raw.model;
        // Anthropic informa la lectura y la escritura de caché aparte de input_tokens: se suman para tener la entrada total.
        {const u=raw.usage??{},read=number(u.cache_read_input_tokens),write=number(u.cache_creation_input_tokens),plain=number(u.input_tokens);metadata.tokens={input:plain===null?null:plain+(read??0)+(write??0),output:number(u.output_tokens),reasoning:null,cached:read,cache_write:write};}
        // Una acción por respuesta: si propone varias llamadas a la herramienta, cuenta la primera (se registra cuántas).
        metadata.finish_reason=raw.stop_reason??null;
        const uses=raw.content?.filter(b=>b.type==='tool_use'&&b.name===ANTHROPIC_TOOL.name)??[];
        if(uses.length){
          if(raw.stop_reason!=='tool_use')throw providerError('INCOMPLETE_RESPONSE');
          metadata.tool_uses=uses.length;text=JSON.stringify(uses[0].input);
        } else {
          if(raw.stop_reason!=='end_turn')throw providerError('INCOMPLETE_RESPONSE');
          text=raw.content?.filter(b=>b.type==='text').map(b=>b.text).join('');
        }
      } else if(config.transport==='google') {
        // gemini_tool: la acción se pide como llamada a la función runner_action (modo ANY), igual que la herramienta de
        // Sonnet. Diagnóstico 2026-10-11: Gemini 3.8 Flash por VNAIPro devolvía MALFORMED_FUNCTION_CALL con JSON en texto.
        const generationConfig={maxOutputTokens:config.max_output_tokens,thinkingConfig:{thinkingLevel:config.reasoning},...(config.gemini_tool?{}:{responseMimeType:'application/json',...(config.json_schema===false?{}:{responseJsonSchema:ACTION_SCHEMA})})};
        const toolFields=config.gemini_tool?{tools:[{functionDeclarations:[{name:GEMINI_TOOL.name,description:GEMINI_TOOL.description,parametersJsonSchema:ACTION_SCHEMA}]}],toolConfig:{functionCallingConfig:{mode:'ANY',allowedFunctionNames:[GEMINI_TOOL.name]}}}:{};
        raw=await request(`${connection.base_url}/models/${encodeURIComponent(config.api_model_id)}:generateContent`,{systemInstruction:{parts:[{text:INSTRUCTION}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig,...toolFields,safetySettings:GEMINI_SAFETY},{'x-goog-api-key':apiKey});
        metadata.observed_model=raw.modelVersion;
        metadata.tokens={input:number(raw.usageMetadata?.promptTokenCount),output:number(raw.usageMetadata?.candidatesTokenCount),reasoning:number(raw.usageMetadata?.thoughtsTokenCount),cached:number(raw.usageMetadata?.cachedContentTokenCount),cache_write:null};
        // Motivo de cierre registrado (diagnóstico 2026-10-10: respuestas incompletas cortas de Gemini sin motivo conocido).
        {const c=raw.candidates?.[0];if(c&&c.finishReason!=='STOP')metadata.finish_detail={message:typeof c.finishMessage==='string'?c.finishMessage.slice(0,500):null,safety_ratings:c.safetyRatings??null,prompt_feedback:raw.promptFeedback??null,parts:(c.content?.parts??[]).map(p=>p.thought?'thought':typeof p.text==='string'?'text':Object.keys(p)[0]??'?')};}
        {const flagged=(raw.candidates?.[0]?.safetyRatings??[]).filter(r=>r.blocked||['MEDIUM','HIGH'].includes(r.probability)).map(r=>r.category);if(flagged.length)metadata.safety_categories=flagged;}
        metadata.finish_reason=raw.candidates?.length===1?(raw.candidates[0].finishReason??null):`candidates:${raw.candidates?.length??0}${raw.promptFeedback?.blockReason?':'+raw.promptFeedback.blockReason:''}`;
        if(raw.candidates?.length!==1||raw.candidates[0].finishReason!=='STOP')throw providerError('INCOMPLETE_RESPONSE');
        {const parts=raw.candidates[0].content?.parts??[],calls=parts.filter(p=>p.functionCall?.name===GEMINI_TOOL.name);
         if(calls.length){metadata.tool_uses=calls.length;text=JSON.stringify(calls[0].functionCall.args??{});}
         else text=parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');}
      } else {
        await verifyLocal();
        raw=await request(`${ollamaBase()}/api/chat`,{model:config.api_model_id,stream:false,keep_alive:config.keep_alive??'15m',format:ACTION_SCHEMA,messages:[{role:'system',content:INSTRUCTION},{role:'user',content:input}],options:{num_ctx:config.context,num_predict:config.max_output_tokens,temperature:config.temperature,seed:config.seed}});
        metadata.observed_model=raw.model;
        metadata.tokens={input:number(raw.prompt_eval_count),output:number(raw.eval_count),reasoning:null};
        if(raw.done!==true||raw.done_reason!=='stop')throw providerError('INCOMPLETE_RESPONSE');
        if(raw.model!==config.api_model_id)throw providerError('MODEL_MISMATCH');
        // Control posterior: los tokens reales (incluida la plantilla) deben respetar la estimación y la ventana.
        if(metadata.tokens.input===null||metadata.tokens.input>trace.estimated_tokens+contextPolicy.budget.template_reserve_tokens||metadata.tokens.input>config.context-config.max_output_tokens)throw providerError('CONTEXT_ESTIMATE_VIOLATION');
        await verifyLocal();text=raw.message?.content;
      }
      if(typeof metadata.observed_model!=='string'||!metadata.observed_model)throw providerError('MODEL_METADATA_MISSING');
      // Revendedor (VNAIPro): el modelo que responde debe ser el pedido (se admite un sufijo de versión).
      if(connection.access_provider==='vnaipro'&&!metadata.observed_model.startsWith(config.api_model_id))throw providerError('MODEL_MISMATCH');
      let parsed;
      const original=text,completed=completeActionFields(text);
      if(completed.filled.length){metadata.filled_fields=completed.filled;text=completed.text;}
      try {parsed=parseAction(text);}
      catch(error) {metadata.rejected_output=rejectedSample(original);throw error;}
      metadata.normalization=parsed.normalization;metadata.action_type=parsed.action.type;if(parsed.discarded_chars)metadata.discarded_chars=parsed.discarded_chars;
      metadata.status='PASS';return parsed.action;
    } catch(error) {
      if(typeof error.detail==='string'&&error.detail)metadata.error_detail=error.detail;
      metadata.error_code=combined.aborted?'REQUEST_ABORTED':(/^[A-Z_0-9]+$/.test(error.code??'')?error.code:'INVALID_RESPONSE');
      throw providerError(metadata.error_code);
    } finally {clearTimeout(timer);metadata.duration_ms=Date.now()-started;onCall(metadata);}
  }};
}
export function createProviderPool({models,credentials={},fetchImpl=fetch,onCall=()=>{}}) {
  const adapters=Object.fromEntries(Object.entries(models).map(([provider,config])=>[provider,createProviderAdapter({provider,config,apiKey:credentials[provider],fetchImpl,onCall})]));
  return {async next(context,options){if(!adapters[context.provider])throw providerError('UNKNOWN_PROVIDER');return adapters[context.provider].next(context,options);}};
}
