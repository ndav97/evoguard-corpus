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
