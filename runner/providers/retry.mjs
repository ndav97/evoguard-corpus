// Reintentos de errores transitorios del transporte (no del modelo): HTTP 408/409/425/429/5xx, red, respuesta
// vacía o no JSON. Una salida inválida del modelo NO se reintenta aquí: la gestiona el motor (consume un ciclo).
// Incluye conexiones HTTP reutilizadas que el servidor o el túnel SSH ya cerraron.
export const TRANSIENT = /^(HTTP_(408|409|425|429|5\d\d)|REQUEST_ABORTED|NETWORK_ERROR|EMPTY_RESPONSE|INVALID_JSON_RESPONSE|INVALID_RESPONSE|STREAM_ERROR)$/;

export function withRetries(adapter, { delays = [15000, 60000, 180000], onRetry = () => {}, before = () => {} } = {}) {
  return {
    async next(context, options) {
      before(context);
      for (let retry = 0; ; retry++) {
        try { return await adapter.next(context, options); }
        catch (error) {
          if (!TRANSIENT.test(error.code ?? '') || retry >= delays.length || options?.signal?.aborted) throw error;
          onRetry({ context, code: error.code, wait: delays[retry], retry: retry + 1 });
          await new Promise(resolve => setTimeout(resolve, delays[retry]));
        }
      }
    }
  };
}
