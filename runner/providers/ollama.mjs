// Punto de acceso de Ollama. Siempre en 127.0.0.1 (local o túnel SSH a una GPU alquilada); el puerto puede
// cambiarse con EVOGUARD_OLLAMA_PORT para no chocar con un Ollama local (p. ej. túnel en 11435).
// Nunca se admite otro host: el tráfico hacia la GPU remota va cifrado por el túnel SSH.
export function ollamaPort(env = process.env) {
  const raw = env.EVOGUARD_OLLAMA_PORT;
  if (raw === undefined || raw === '') return 11434;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Object.assign(new Error('EVOGUARD_OLLAMA_PORT inválido'), { code: 'OLLAMA_PORT_INVALID' });
  return port;
}
export const ollamaBase = (env = process.env) => `http://127.0.0.1:${ollamaPort(env)}`;
