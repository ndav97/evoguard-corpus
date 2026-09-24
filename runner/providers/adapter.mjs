import {requestJson,providerError} from './http.mjs';
export const ACTION_SCHEMA={type:'object',properties:{type:{type:'string',enum:['tool','deliver','technical_failure']},argv:{type:'array',items:{type:'string'}}},required:['type','argv'],additionalProperties:false};
const INSTRUCTION='Return exactly one JSON action matching the supplied schema. type=tool executes argv in the isolated Linux workspace; use argv ["sh","-lc","command"] when a shell is needed. type=deliver submits the work. type=technical_failure gives up. argv must be empty for non-tool actions. Do not execute tools yourself. Use only the current packet and visible history. No Internet or new dependencies.';
const TRANSPORT={openai:'openai',anthropic:'anthropic',google:'google',local_a:'ollama',local_b:'ollama'};
const number=value=>Number.isFinite(value)&&value>=0?value:null;
function parseAction(text) {
  let action;try {action=JSON.parse(text);}catch {throw providerError('INVALID_ACTION_JSON');}
  if(!action||Object.keys(action).sort().join()!=='argv,type'||!['tool','deliver','technical_failure'].includes(action.type)||!Array.isArray(action.argv)||action.argv.length>128||action.argv.some(v=>typeof v!=='string'||v.includes('\0')||v.length>16384)||(action.type==='tool'?action.argv.length===0:action.argv.length!==0))throw providerError('INVALID_ACTION');
  return action.type==='tool'?action:{type:action.type};
}
export function createProviderAdapter({provider,config,apiKey,fetchImpl=fetch,onCall=()=>{}}) {
  if(TRANSPORT[provider]!==config?.transport||!config?.api_model_id||!Number.isInteger(config.max_output_tokens)||config.max_output_tokens<1)throw providerError('INVALID_MODEL_CONFIG');
  config=structuredClone(config);
  if(config.transport==='ollama'&&(config.context!==8192||!/^[a-f0-9]{64}$/.test(config.digest??'')))throw providerError('INVALID_LOCAL_CONFIG');
  return {provider,exactModel:config.api_model_id,async next(context,{signal,timeout=provider.startsWith('local_')?3600000:1800000}={}) {
    if(context.provider!==provider)throw providerError('PROVIDER_MISMATCH');
    if(!Number.isInteger(timeout)||timeout<1)throw providerError('INVALID_TIMEOUT');
    signal?.throwIfAborted();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    const started=Date.now();
    const metadata={provider,display_name:config.display_name,requested_model:config.api_model_id,observed_model:null,started_at:new Date(started).toISOString(),parameters:{context:config.context,max_output_tokens:config.max_output_tokens,reasoning:config.reasoning,temperature:config.temperature,seed:config.seed},digest:config.digest,tokens:{input:null,output:null,reasoning:null},cost_usd:null,status:'ERROR',error_code:null};
    const request=(url,body,headers)=>requestJson(url,{body,headers,signal:combined,fetchImpl});
    const verifyLocal=async()=>{
      const tags=await request('http://127.0.0.1:11434/api/tags');
      if(!tags.models?.some(m=>m.name===config.api_model_id&&m.digest===config.digest))throw providerError('MODEL_DIGEST_MISMATCH');
    };
    try {
      if(config.transport!=='ollama'&&(!apiKey||typeof apiKey!=='string'))throw providerError('CREDENTIAL_MISSING');
      // Allowlist outer context: never serialize the coordinator or its private fields.
      const input=JSON.stringify({packet:context.packet,messages:context.messages,attempt:context.attempt,cycle:context.cycle});
      if(Buffer.byteLength(input)>1048576)throw providerError('INPUT_TOO_LARGE');
      if(config.transport==='ollama'&&Buffer.byteLength(input+INSTRUCTION+JSON.stringify(ACTION_SCHEMA))>config.context-config.max_output_tokens-512)throw providerError('CONTEXT_LIMIT');
      let raw,text;
      if(config.transport==='openai') {
        raw=await request('https://api.openai.com/v1/responses',{model:config.api_model_id,store:false,instructions:INSTRUCTION,input,reasoning:{effort:config.reasoning},max_output_tokens:config.max_output_tokens,text:{format:{type:'json_schema',name:'runner_action',strict:true,schema:ACTION_SCHEMA}}},{authorization:`Bearer ${apiKey}`});
        metadata.observed_model=raw.model;
        metadata.tokens={input:number(raw.usage?.input_tokens),output:number(raw.usage?.output_tokens),reasoning:number(raw.usage?.output_tokens_details?.reasoning_tokens)};
        if(raw.status!=='completed')throw providerError('INCOMPLETE_RESPONSE');
        const blocks=raw.output?.filter(o=>o.type==='message').flatMap(o=>o.content??[])??[];
        if(blocks.some(b=>b.type==='refusal'))throw providerError('MODEL_REFUSAL');
        text=blocks.filter(b=>b.type==='output_text').map(b=>b.text).join('');
      } else if(config.transport==='anthropic') {
        raw=await request('https://api.anthropic.com/v1/messages',{model:config.api_model_id,max_tokens:config.max_output_tokens,system:INSTRUCTION,messages:[{role:'user',content:input}],thinking:{type:'adaptive'},output_config:{effort:config.reasoning,format:{type:'json_schema',schema:ACTION_SCHEMA}}},{'x-api-key':apiKey,'anthropic-version':'2023-06-01'});
        metadata.observed_model=raw.model;
        metadata.tokens={input:number(raw.usage?.input_tokens),output:number(raw.usage?.output_tokens),reasoning:null};
        if(raw.stop_reason!=='end_turn')throw providerError('INCOMPLETE_RESPONSE');
        text=raw.content?.filter(b=>b.type==='text').map(b=>b.text).join('');
      } else if(config.transport==='google') {
        raw=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.api_model_id)}:generateContent`,{systemInstruction:{parts:[{text:INSTRUCTION}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{maxOutputTokens:config.max_output_tokens,thinkingConfig:{thinkingLevel:config.reasoning},responseMimeType:'application/json',responseJsonSchema:ACTION_SCHEMA}},{'x-goog-api-key':apiKey});
        metadata.observed_model=raw.modelVersion;
        metadata.tokens={input:number(raw.usageMetadata?.promptTokenCount),output:number(raw.usageMetadata?.candidatesTokenCount),reasoning:number(raw.usageMetadata?.thoughtsTokenCount)};
        if(raw.candidates?.length!==1||raw.candidates[0].finishReason!=='STOP')throw providerError('INCOMPLETE_RESPONSE');
        text=raw.candidates[0].content?.parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
      } else {
        await verifyLocal();
        raw=await request('http://127.0.0.1:11434/api/chat',{model:config.api_model_id,stream:false,keep_alive:0,format:ACTION_SCHEMA,messages:[{role:'system',content:INSTRUCTION},{role:'user',content:input}],options:{num_ctx:config.context,num_predict:config.max_output_tokens,temperature:config.temperature,seed:config.seed}});
        metadata.observed_model=raw.model;
        metadata.tokens={input:number(raw.prompt_eval_count),output:number(raw.eval_count),reasoning:null};
        if(raw.done!==true||raw.done_reason!=='stop')throw providerError('INCOMPLETE_RESPONSE');
        if(raw.model!==config.api_model_id)throw providerError('MODEL_MISMATCH');
        await verifyLocal();text=raw.message?.content;
      }
      if(typeof metadata.observed_model!=='string'||!metadata.observed_model)throw providerError('MODEL_METADATA_MISSING');
      const action=parseAction(text);metadata.status='PASS';return action;
    } catch(error) {
      metadata.error_code=combined.aborted?'REQUEST_ABORTED':(/^[A-Z_0-9]+$/.test(error.code??'')?error.code:'INVALID_RESPONSE');
      throw providerError(metadata.error_code);
    } finally {clearTimeout(timer);metadata.duration_ms=Date.now()-started;onCall(metadata);}
  }};
}
export function createProviderPool({models,credentials={},fetchImpl=fetch,onCall=()=>{}}) {
  const adapters=Object.fromEntries(Object.entries(models).map(([provider,config])=>[provider,createProviderAdapter({provider,config,apiKey:credentials[provider],fetchImpl,onCall})]));
  return {async next(context,options){if(!adapters[context.provider])throw providerError('UNKNOWN_PROVIDER');return adapters[context.provider].next(context,options);}};
}
