import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProviderAdapter,createProviderPool,completeActionFields} from '../runner/providers/adapter.mjs';
import {requestJson} from '../runner/providers/http.mjs';
import {createServer} from 'node:http';
import {connectionFor,credentialsFromEnv} from '../runner/providers/connection.mjs';
const models=JSON.parse(readFileSync(new URL('../config/models.json',import.meta.url))).models;
const action=JSON.stringify({type:'tool',argv:['node','--version']});
const fixtures={
  openai:{id:'r1',model:'gpt-5.6-sol',status:'completed',output:[{type:'message',content:[{type:'output_text',text:action}]}],usage:{input_tokens:7,output_tokens:3}},
  anthropic:{id:'a1',model:'claude-sonnet-5',stop_reason:'end_turn',content:[{type:'text',text:action}],usage:{input_tokens:7,output_tokens:3}},
  google:{modelVersion:'gemini-3.1-pro-preview',candidates:[{finishReason:'STOP',content:{parts:[{text:action}]}}],usageMetadata:{promptTokenCount:7,candidatesTokenCount:3}},
  ollama:{model:'qwen2.5-coder:7b',done:true,done_reason:'stop',message:{content:action},prompt_eval_count:7,eval_count:3}
};
const context={provider:'openai',attempt:1,cycle:1,packet:{request:'test'},messages:[],oracle:'PRIVATE_CANARY'};
for(const provider of Object.keys(models)) test(`${provider}: petición propia, acción validada y métricas observadas`,async()=>{
  let request,observation;
  const config=models[provider];
  const response=structuredClone(fixtures[config.transport]);if(config.transport==='ollama')response.model=config.api_model_id;
  const adapter=createProviderAdapter({provider,config,apiKey:'FAKE_TEST_KEY',onCall:r=>observation=r,fetchImpl:async(url,options)=>{
    if(url.endsWith('/api/tags'))return Response.json({models:[{name:config.api_model_id,digest:config.digest}]});
    request={url,...options};return Response.json(response);
  }});
  assert.deepEqual(await adapter.next({...context,provider}),{type:'tool',argv:['node','--version']});
  assert.equal(request.redirect,'error');assert.ok(!request.body.includes('PRIVATE_CANARY'));
  assert.ok((provider==='google'?request.url:request.body).includes(config.api_model_id));assert.equal(observation.tokens.input,7);
  assert.equal(observation.cost_usd,null);assert.ok(!JSON.stringify(observation).includes('FAKE_TEST_KEY'));
  const body=JSON.parse(request.body);
  const last=body.messages?.at(-1)?.content;
  const visible=JSON.parse(provider==='openai'?body.input:provider==='google'?body.contents[0].parts[0].text:Array.isArray(last)?last.map(b=>b.text).join(''):last);
  assert.equal(visible.response_contract.schema.additionalProperties,false);
  assert.deepEqual(visible.response_contract.schema.required,['type','path','content','find','replace','argv']);
  assert.match(visible.response_contract.instruction,/No Markdown/);
  if(provider==='openai'){assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.reasoning.effort,'medium');}
  if(provider==='anthropic'){assert.equal(body.output_config.format,undefined);assert.equal(body.tools[0].strict,true);assert.equal(body.tool_choice.type,'auto');assert.equal(request.headers['anthropic-version'],'2023-06-01');}
  if(provider==='google'){assert.ok(request.url.endsWith(':generateContent'));assert.equal(request.headers['x-goog-api-key'],'FAKE_TEST_KEY');}
  if(config.transport==='ollama'){assert.equal(body.options.num_ctx,8192);assert.equal(body.stream,false);}
});
test('rechaza truncamiento, rechazo y JSON con campos extra antes de ejecutar herramientas',async()=>{
  for(const patch of [{status:'incomplete'},{output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]},{output:[{type:'message',content:[{type:'output_text',text:'{"type":"deliver","argv":[],"secret":"x"}'}]}]}]) {
    const adapter=createProviderAdapter({provider:'openai',config:models.openai,apiKey:'fake',fetchImpl:async()=>Response.json({...fixtures.openai,...patch})});
    await assert.rejects(adapter.next(context));
  }
});
test('no hace red sin credenciales ni filtra cuerpos de error',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return new Response('SECRET_TOKEN_FROM_SERVER',{status:401});};
  await assert.rejects(createProviderAdapter({provider:'openai',config:models.openai,fetchImpl}).next(context),/CREDENTIAL_MISSING/);
  assert.equal(calls,0);
  await assert.rejects(createProviderAdapter({provider:'openai',config:models.openai,apiKey:'fake',fetchImpl}).next(context),e=>e.code==='HTTP_401'&&!e.message.includes('SECRET'));
});
test('digest local distinto y contexto excesivo bloquean inferencia',async()=>{
  let calls=0;
  const adapter=createProviderAdapter({provider:'local_a',config:models.local_a,fetchImpl:async()=>{calls++;return Response.json({models:[{name:'qwen2.5-coder:7b',digest:'wrong'}]});}});
  await assert.rejects(adapter.next({...context,provider:'local_a'}),/MODEL_DIGEST/);
  await assert.rejects(adapter.next({...context,provider:'local_a',packet:{request:'x'.repeat(40000)}}),/CONTEXT_CORE_TOO_LARGE/);
  assert.equal(calls,1);
});
test('señal cancelada evita iniciar solicitudes',async()=>{
  let calls=0;const controller=new AbortController();controller.abort();
  const adapter=createProviderAdapter({provider:'openai',config:models.openai,apiKey:'fake',fetchImpl:async()=>{calls++;return Response.json(fixtures.openai);}});
  await assert.rejects(adapter.next(context,{signal:controller.signal}));assert.equal(calls,0);
});
test('transporte real corta espera, limita bytes y no sigue redirecciones',async t=>{
  let targetCalls=0;
  const server=createServer((req,res)=>{
    if(req.url==='/hang'){res.writeHead(200,{'content-type':'application/json'});res.flushHeaders();return;}
    if(req.url==='/redirect'){res.writeHead(302,{location:'/target'});res.end();return;}
    if(req.url==='/big'){res.writeHead(200);res.end('x'.repeat(2097153));return;}
    targetCalls++;res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  await assert.rejects(requestJson(base+'/hang',{signal:AbortSignal.timeout(50)}),/REQUEST_ABORTED/);
  await assert.rejects(requestJson(base+'/redirect'),/NETWORK_ERROR/);assert.equal(targetCalls,0);
  await assert.rejects(requestJson(base+'/big'),/RESPONSE_TOO_LARGE/);
});
test('pool dirige cada etiqueta al transporte elegido y no inventa tokens ausentes',async()=>{
  const calls=[];
  const pool=createProviderPool({models:{openai:models.openai},credentials:{openai:'fake'},onCall:r=>calls.push(r),fetchImpl:async()=>Response.json({...fixtures.openai,usage:undefined})});
  assert.equal((await pool.next(context)).type,'tool');assert.equal(calls[0].tokens.input,null);
  await assert.rejects(pool.next({...context,provider:'other'}),/UNKNOWN_PROVIDER/);
});
test('proveedores rechazan respuestas truncadas aunque contengan JSON válido',async()=>{
  for(const [provider,patch] of [['anthropic',{stop_reason:'max_tokens'}],['google',{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:action}]}}]}],['local_a',{done_reason:'length'}]]) {
    const config=models[provider];
    const adapter=createProviderAdapter({provider,config,apiKey:'fake',fetchImpl:async url=>url.endsWith('/api/tags')?Response.json({models:[{name:config.api_model_id,digest:config.digest}]}):Response.json({...fixtures[config.transport],...patch})});
    await assert.rejects(adapter.next({...context,provider}),/INCOMPLETE_RESPONSE/);
  }
});
test('conserva uso observado en respuestas incompletas de los cuatro transportes',async()=>{
  for(const [provider,patch] of [['openai',{status:'incomplete'}],['anthropic',{stop_reason:'max_tokens'}],['google',{candidates:[]}],['local_a',{done_reason:'length'}]]) {
    const config=models[provider];let record;
    const adapter=createProviderAdapter({provider,config,apiKey:'fake',onCall:r=>record=r,fetchImpl:async url=>url.endsWith('/api/tags')?Response.json({models:[{name:config.api_model_id,digest:config.digest}]}):Response.json({...fixtures[config.transport],...patch})});
    await assert.rejects(adapter.next({...context,provider}));
    assert.equal(record.tokens.input,7);assert.equal(record.tokens.output,3);assert.equal(record.observed_model,config.api_model_id);
  }
});
test('Synterolink usa su endpoint y registra intermediario sin enviar clave directa',async()=>{
  const config={...models.openai,access_provider:'synterolink',base_url:'https://api.synterolink.com/v1'};
  const keys=credentialsFromEnv({openai:config},{OPENAI_API_KEY:'DIRECT_ONLY',SYNTEROLINK_API_KEY:'GATEWAY_ONLY'});
  let url,record;
  const adapter=createProviderAdapter({provider:'openai',config,apiKey:keys.openai,onCall:r=>record=r,fetchImpl:async(endpoint,options)=>{
    url=endpoint;assert.equal(options.headers.authorization,'Bearer GATEWAY_ONLY');
    assert.equal(JSON.parse(options.body).store,false);
    return Response.json(fixtures.openai);
  }});
  await adapter.next(context);
  assert.equal(url,'https://api.synterolink.com/v1/responses');
  assert.equal(record.access_provider,'synterolink');
  assert.equal(record.base_url,'https://api.synterolink.com/v1');
  assert.equal(credentialsFromEnv({openai:config},{OPENAI_API_KEY:'DIRECT_ONLY'}).openai,undefined);
});
test('rechaza destinos no autorizados y rutas Synterolink no confirmadas',()=>{
  for(const base_url of ['http://api.synterolink.com/v1','https://api.synterolink.com.evil.test/v1','https://user:secret@api.synterolink.com/v1','https://api.synterolink.com/v1?key=secret']) {
    assert.throws(()=>connectionFor('openai',{...models.openai,access_provider:'synterolink',base_url}),/CONNECTION/);
  }
  assert.throws(()=>connectionFor('google',{...models.google,access_provider:'synterolink',base_url:'https://api.synterolink.com/v1'}),/CONNECTION/);
});
test('Gemini via Synterolink usa v1beta y clave específica antes de la común',async()=>{
  const config={...models.google,access_provider:'synterolink',base_url:'https://api.synterolink.com/v1beta'};
  const keys=credentialsFromEnv({google:config},{SYNTEROLINK_GOOGLE_API_KEY:'SPECIFIC',SYNTEROLINK_API_KEY:'COMMON',GEMINI_API_KEY:'DIRECT_ONLY'});
  const adapter=createProviderAdapter({provider:'google',config,apiKey:keys.google,fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.synterolink.com/v1beta/models/gemini-3.1-pro-preview:generateContent');
    assert.equal(options.headers['x-goog-api-key'],'SPECIFIC');return Response.json(fixtures.google);
  }});
  assert.equal((await adapter.next({...context,provider:'google'})).type,'tool');
  assert.equal(credentialsFromEnv({google:config},{GEMINI_API_KEY:'DIRECT_ONLY'}).google,undefined);
});
test('Sonnet via Synterolink conserva Messages y autenticación Anthropic',async()=>{
  const config={...models.anthropic,access_provider:'synterolink',base_url:'https://api.synterolink.com/v1'};
  let record;
  const keys=credentialsFromEnv({anthropic:config},{ANTHROPIC_API_KEY:'DIRECT_ONLY',SYNTEROLINK_API_KEY:'GATEWAY_ONLY'});
  const adapter=createProviderAdapter({provider:'anthropic',config,apiKey:keys.anthropic,onCall:r=>record=r,fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.synterolink.com/v1/messages');
    assert.equal(options.headers['x-api-key'],'GATEWAY_ONLY');
    assert.equal(options.headers['anthropic-version'],'2023-06-01');
    assert.equal(JSON.parse(options.body).model,'claude-sonnet-5');
    return Response.json(fixtures.anthropic);
  }});
  await adapter.next({...context,provider:'anthropic'});
  assert.equal(record.access_provider,'synterolink');
  assert.equal(credentialsFromEnv({anthropic:config},{ANTHROPIC_API_KEY:'DIRECT_ONLY'}).anthropic,undefined);
});

test('anthropic: transporte con herramienta nativa (primera acción), caché por bloques idénticos a la entrada',async()=>{
  const config=models.anthropic;let body,observation;
  const ctx={provider:'anthropic',attempt:1,cycle:3,packet:{request:'x'},messages:[{role:'user',content:{source:'workspace'}},{role:'assistant',content:{type:'list_files',path:''}},{role:'tool',content:{status:'PASS',output:'a'}}]};
  const second={type:'deliver',path:'',content:'',find:'',replace:'',argv:[]};
  const adapter=createProviderAdapter({provider:'anthropic',config,apiKey:'FAKE_TEST_KEY',onCall:r=>observation=r,fetchImpl:async(url,options)=>{body=JSON.parse(options.body);return Response.json({model:'claude-sonnet-5',stop_reason:'tool_use',content:[{type:'thinking',thinking:'…'},{type:'tool_use',name:'runner_action',input:{type:'read_file',path:'src/a.ts',content:'',find:'',replace:'',argv:[]}},{type:'tool_use',name:'runner_action',input:second}],usage:{input_tokens:100,cache_read_input_tokens:900,cache_creation_input_tokens:50,output_tokens:20}});}});
  assert.deepEqual(await adapter.next(ctx),{type:'read_file',path:'src/a.ts'});
  assert.equal(observation.tool_uses,2);
  assert.deepEqual(observation.tokens,{input:1050,output:20,reasoning:null,cached:900,cache_write:50});
  const blocks=body.messages[0].content;
  const expected=JSON.stringify({response_contract:JSON.parse(blocks.map(b=>b.text).join('')).response_contract,packet:ctx.packet,messages:ctx.messages,attempt:1,cycle:3});
  assert.equal(blocks.map(b=>b.text).join(''),expected,'el modelo recibe exactamente la misma entrada');
  assert.equal(blocks.length,5);
  assert.deepEqual(blocks.map(b=>Boolean(b.cache_control)),[false,false,false,true,false],'marca de caché en el último mensaje');
});

test('completa campos vacíos omitidos, igual para todos los proveedores; no corrige claves desconocidas',async()=>{
  const edit={type:'edit_file',path:'src/a.ts',find:'x',replace:'y'};
  const r=completeActionFields(JSON.stringify(edit));
  assert.deepEqual(r.filled,['argv','content']);
  assert.deepEqual(JSON.parse(r.text),{...edit,argv:[],content:''});
  assert.deepEqual(completeActionFields('```json\n'+JSON.stringify({type:'read_file',path:'a.ts'})+'\n```').filled,['argv','content','find','replace']);
  const complete=JSON.stringify({type:'list_files',path:'',argv:[],content:'',find:'',replace:''});
  assert.deepEqual(completeActionFields(complete),{text:complete,filled:[]});
  for(const bad of [JSON.stringify({action:'write_file',path:'a',content:'b'}),JSON.stringify({type:'write_file',path:'a',content:'b',extra:1}),'no json','[1]'])
    assert.deepEqual(completeActionFields(bad),{text:bad,filled:[]});
  for(const provider of ['openai','anthropic','google']){
    const config=models[provider],text=JSON.stringify(edit);
    const response=structuredClone(fixtures[config.transport]);
    if(config.transport==='openai')response.output[0].content[0].text=text;
    else if(config.transport==='anthropic')response.content[0].text=text;
    else response.candidates[0].content.parts[0].text=text;
    let observation;
    const adapter=createProviderAdapter({provider,config,apiKey:'K',onCall:o=>observation=o,fetchImpl:async()=>Response.json(response)});
    assert.deepEqual(await adapter.next({...context,provider}),{type:'edit_file',path:'src/a.ts',find:'x',replace:'y'});
    assert.deepEqual(observation.filled_fields,['argv','content']);
    const wrong=structuredClone(response),bad=JSON.stringify({action:'edit_file',path:'src/a.ts',find:'x',replace:'y'});
    if(config.transport==='openai')wrong.output[0].content[0].text=bad;else if(config.transport==='anthropic')wrong.content[0].text=bad;else wrong.candidates[0].content.parts[0].text=bad;
    const a2=createProviderAdapter({provider,config,apiKey:'K',onCall:o=>observation=o,fetchImpl:async()=>Response.json(wrong)});
    await assert.rejects(a2.next({...context,provider}),e=>e.code==='INVALID_ACTION');
    assert.equal(observation.filled_fields,undefined);
  }
});
test('comerciales con 16384 tokens de salida (el razonamiento se descuenta del mismo límite)',()=>{
  for(const p of ['openai','anthropic','google'])assert.equal(models[p].max_output_tokens,16384,p);
});
test('openai en flujo (SSE): toma la respuesta del evento terminal y registra el motivo de cierre',async()=>{
  const final={...fixtures.openai,usage:{input_tokens:11,output_tokens:5,output_tokens_details:{reasoning_tokens:2}}};
  const events=[{type:'response.created',response:{status:'in_progress'}},{type:'response.output_text.delta',delta:'{"ty'},{type:'response.completed',response:final}];
  const sse=events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  let request,observation;
  const chunks=[sse.slice(0,37),sse.slice(37,120),sse.slice(120)];
  const adapter=createProviderAdapter({provider:'openai',config:models.openai,apiKey:'K',onCall:o=>observation=o,fetchImpl:async(url,options)=>{request=options;
    return new Response(new ReadableStream({start(c){for(const x of chunks)c.enqueue(new TextEncoder().encode(x));c.close();}}),{headers:{'content-type':'text/event-stream'}});}});
  assert.deepEqual(await adapter.next(context),{type:'tool',argv:['node','--version']});
  const body=JSON.parse(request.body);assert.equal(body.stream,true);assert.equal(request.headers.accept,'text/event-stream');
  assert.equal(observation.tokens.input,11);assert.equal(observation.finish_reason,'completed');assert.equal(observation.streamed,true);
  const incomplete=`data: ${JSON.stringify({type:'response.incomplete',response:{...fixtures.openai,status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}})}\n\n`;
  const a2=createProviderAdapter({provider:'openai',config:models.openai,apiKey:'K',onCall:o=>observation=o,fetchImpl:async()=>new Response(incomplete,{headers:{'content-type':'text/event-stream'}})});
  await assert.rejects(a2.next(context),e=>e.code==='INCOMPLETE_RESPONSE');
  assert.equal(observation.finish_reason,'incomplete:max_output_tokens');
  const a3=createProviderAdapter({provider:'openai',config:models.openai,apiKey:'K',onCall:o=>observation=o,fetchImpl:async()=>new Response('event: x\ndata: {"type":"response.created"}\n\n',{headers:{'content-type':'text/event-stream'}})});
  await assert.rejects(a3.next(context),e=>e.code==='EMPTY_RESPONSE');
});
test('gemini y anthropic registran el motivo de cierre',async()=>{
  let observation;
  const g=structuredClone(fixtures.google);g.candidates[0].finishReason='MALFORMED_FUNCTION_CALL';
  const a=createProviderAdapter({provider:'google',config:models.google,apiKey:'K',onCall:o=>observation=o,fetchImpl:async()=>Response.json(g)});
  await assert.rejects(a.next({...context,provider:'google'}),e=>e.code==='INCOMPLETE_RESPONSE');
  assert.equal(observation.finish_reason,'MALFORMED_FUNCTION_CALL');
  const b=createProviderAdapter({provider:'anthropic',config:models.anthropic,apiKey:'K',onCall:o=>observation=o,fetchImpl:async()=>Response.json(fixtures.anthropic)});
  await b.next({...context,provider:'anthropic'});assert.equal(observation.finish_reason,'end_turn');
});
