# Registro futuro
Validar cada referencia con schema/generation.schema.json y cada ejecución π0 con schema/run.schema.json.
Conservar prompt exacto + hash, versión/modelo y parámetros reales, timestamps, tokens, costo si disponible, duración, ciclos, base y candidato Git, hashes de fixture/stack, comandos y salidas visibles, resultado externo separado.
Nunca serializar variables de entorno, claves, headers de autorización ni credenciales. Logs del oráculo solo en almacenamiento del evaluador; no reutilizarlos como feedback.
Cada intento tiene identidad propia; conservar fallos. null significa desconocido/no observado, nunca cero.
Se almacenará todo bajo runs/corpus-generation o runs/pi0 según propósito; este commit no crea runs ficticios.
