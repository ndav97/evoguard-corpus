export const providerError=code=>Object.assign(new Error(code),{code});
export async function requestJson(url,{body,headers={},signal,fetchImpl=fetch}={}) {
  signal?.throwIfAborted();
  try {
    const response=await fetchImpl(url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal});
    if(!response.ok) {await response.body?.cancel();throw providerError(`HTTP_${response.status}`);}
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
