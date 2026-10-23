export const providerError=code=>Object.assign(new Error(code),{code});
export async function requestJson(url,{body,headers={},signal,fetchImpl=fetch}={}) {
  signal?.throwIfAborted();
  try {
    const response=await fetchImpl(url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal});
    if(!response.ok) {const detail=await (async()=>String(await response.text()).slice(0,1000))().catch(()=>null);throw Object.assign(providerError(`HTTP_${response.status}`),{detail});}
    if(Number(response.headers.get('content-length'))>2097152) {await response.body?.cancel();throw providerError('RESPONSE_TOO_LARGE');}
    const reader=response.body?.getReader();if(!reader)throw providerError('EMPTY_RESPONSE');
    const chunks=[];let length=0;
    try {
      for(;;) {
        const {done,value}=await reader.read();if(done)break;
        length+=value.byteLength;if(length>2097152)throw providerError('RESPONSE_TOO_LARGE');
        chunks.push(value);
      }
    } finally {await reader.cancel();}
    try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch {throw providerError('INVALID_JSON_RESPONSE');}
  } catch(error) {
    if(signal?.aborted)throw providerError('REQUEST_ABORTED');
    if(/^HTTP_\d+$|^(RESPONSE_TOO_LARGE|EMPTY_RESPONSE|INVALID_JSON_RESPONSE)$/.test(error.code??''))throw error;
    throw providerError('NETWORK_ERROR');
  }
}

// Respuestas en flujo (SSE) de la API Responses de OpenAI (decisión 2026-10-10): Synterolink corta con HTTP 524 las
// conexiones sin datos durante ~2 minutos, algo frecuente cuando GPT razona mucho. En flujo llegan eventos mientras el
// modelo trabaja; se devuelve el objeto `response` del evento terminal (completed, incomplete o failed), idéntico al de
// la respuesta sin flujo ({response, streamed}). Si el intermediario responde JSON en lugar de eventos, se interpreta como respuesta normal.
const SSE_LIMIT=16777216;
export async function requestSse(url,{body,headers={},signal,fetchImpl=fetch}={}) {
  signal?.throwIfAborted();
  try {
    const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream',...headers},body:JSON.stringify(body),redirect:'error',signal});
    if(!response.ok) {await response.body?.cancel();throw providerError(`HTTP_${response.status}`);}
    const reader=response.body?.getReader();if(!reader)throw providerError('EMPTY_RESPONSE');
    const streaming=/text\/event-stream/i.test(response.headers.get('content-type')??'');
    const decoder=new TextDecoder();let buffer='',length=0,terminal=null,whole='';
    const consume=block=>{
      const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).replace(/^ /,'')).join('\n');
      if(!data||data==='[DONE]')return;
      let event;try {event=JSON.parse(data);}catch {throw providerError('INVALID_JSON_RESPONSE');}
      if(['response.completed','response.incomplete','response.failed'].includes(event?.type)&&event.response)terminal=event.response;
      else if(event?.type==='error')throw providerError('STREAM_ERROR');
    };
    try {
      for(;;) {
        const {done,value}=await reader.read();if(done)break;
        length+=value.byteLength;if(length>SSE_LIMIT)throw providerError('RESPONSE_TOO_LARGE');
        const text=decoder.decode(value,{stream:true});
        if(!streaming) {whole+=text;continue;}
        buffer+=text;
        let index;while((index=buffer.search(/\r?\n\r?\n/))>=0) {const block=buffer.slice(0,index);buffer=buffer.slice(index).replace(/^\r?\n\r?\n/,'');consume(block);}
      }
      if(streaming&&buffer.trim())consume(buffer);
    } finally {await reader.cancel();}
    if(!streaming) {try {return {response:JSON.parse(whole),streamed:false};}catch {throw providerError('INVALID_JSON_RESPONSE');}}
    if(!terminal)throw providerError('EMPTY_RESPONSE');
    return {response:terminal,streamed:true};
  } catch(error) {
    if(signal?.aborted)throw providerError('REQUEST_ABORTED');
    if(/^HTTP_\d+$|^(RESPONSE_TOO_LARGE|EMPTY_RESPONSE|INVALID_JSON_RESPONSE|STREAM_ERROR)$/.test(error.code??''))throw error;
    throw providerError('NETWORK_ERROR');
  }
}

// Respuestas en flujo (SSE) de la API Messages de Anthropic (decisión 2026-10-23): igual que con OpenAI, Synterolink
// corta con HTTP 524 las conexiones sin datos durante ~2 minutos. En π0, 70 de 1 605 llamadas de Sonnet terminaron así y
// S017 no pudo completarse. Se reconstruye el mensaje final a partir de los eventos (message_start, content_block_*,
// message_delta) con la misma forma que la respuesta sin flujo; si el intermediario responde JSON, se usa tal cual.
export async function requestAnthropicSse(url,{body,headers={},signal,fetchImpl=fetch}={}) {
  signal?.throwIfAborted();
  try {
    const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream',...headers},body:JSON.stringify({...body,stream:true}),redirect:'error',signal});
    if(!response.ok) {const detail=await (async()=>String(await response.text()).slice(0,1000))().catch(()=>null);throw Object.assign(providerError(`HTTP_${response.status}`),{detail});}
    const reader=response.body?.getReader();if(!reader)throw providerError('EMPTY_RESPONSE');
    const streaming=/text\/event-stream/i.test(response.headers.get('content-type')??'');
    const decoder=new TextDecoder();let buffer='',length=0,whole='',message=null,stopped=false;
    const partial=new Map();
    const consume=block=>{
      const data=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).replace(/^ /,'')).join('\n');
      if(!data)return;
      let event;try {event=JSON.parse(data);}catch {throw providerError('INVALID_JSON_RESPONSE');}
      switch(event?.type) {
        case 'message_start': message={...event.message,content:[]};break;
        case 'content_block_start': if(!message)throw providerError('STREAM_ERROR');message.content[event.index]={...event.content_block};if(event.content_block?.type==='tool_use')partial.set(event.index,'');break;
        case 'content_block_delta': {
          const b=message?.content[event.index],d=event.delta??{};if(!b)throw providerError('STREAM_ERROR');
          if(d.type==='text_delta')b.text=(b.text??'')+d.text;
          else if(d.type==='thinking_delta')b.thinking=(b.thinking??'')+d.thinking;
          else if(d.type==='signature_delta')b.signature=(b.signature??'')+d.signature;
          else if(d.type==='input_json_delta')partial.set(event.index,(partial.get(event.index)??'')+d.partial_json);
          break;
        }
        case 'content_block_stop': if(partial.has(event.index)){const raw=partial.get(event.index);try {message.content[event.index].input=raw?JSON.parse(raw):{};}catch {throw providerError('INVALID_JSON_RESPONSE');}partial.delete(event.index);}break;
        case 'message_delta': if(!message)throw providerError('STREAM_ERROR');Object.assign(message,event.delta??{});message.usage={...message.usage,...event.usage};break;
        case 'message_stop': stopped=true;break;
        case 'error': throw providerError('STREAM_ERROR');
      }
    };
    try {
      for(;;) {
        const {done,value}=await reader.read();if(done)break;
        length+=value.byteLength;if(length>SSE_LIMIT)throw providerError('RESPONSE_TOO_LARGE');
        const text=decoder.decode(value,{stream:true});
        if(!streaming) {whole+=text;continue;}
        buffer+=text;
        let index;while((index=buffer.search(/\r?\n\r?\n/))>=0) {const block=buffer.slice(0,index);buffer=buffer.slice(index).replace(/^\r?\n\r?\n/,'');consume(block);}
      }
      if(streaming&&buffer.trim())consume(buffer);
    } finally {await reader.cancel();}
    if(!streaming) {try {return {response:JSON.parse(whole),streamed:false};}catch {throw providerError('INVALID_JSON_RESPONSE');}}
    if(!message||!stopped)throw providerError('EMPTY_RESPONSE');
    message.content=message.content.filter(Boolean);
    return {response:message,streamed:true};
  } catch(error) {
    if(signal?.aborted)throw providerError('REQUEST_ABORTED');
    if(/^HTTP_\d+$|^(RESPONSE_TOO_LARGE|EMPTY_RESPONSE|INVALID_JSON_RESPONSE|STREAM_ERROR)$/.test(error.code??''))throw error;
    throw providerError('NETWORK_ERROR');
  }
}
