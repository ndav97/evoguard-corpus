import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProviderAdapter,createProviderPool} from '../runner/providers/adapter.mjs';
import {requestJson} from '../runner/providers/http.mjs';
import {createServer} from 'node:http';
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
  if(provider==='openai'){assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.reasoning.effort,'medium');}
  if(provider==='anthropic'){assert.equal(body.output_config.format.type,'json_schema');assert.equal(request.headers['anthropic-version'],'2023-06-01');}
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
  await assert.rejects(adapter.next({...context,provider:'local_a',packet:{request:'x'.repeat(20000)}}),/CONTEXT_LIMIT/);
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
