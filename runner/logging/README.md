# Registro futuro
Validar cada referencia con schema/generation.schema.json y cada ejecución π0 con schema/run.schema.json.
Conservar prompt exacto + hash, versión/modelo y parámetros reales, timestamps, tokens, costo si disponible, duración, ciclos, base y candidato Git, hashes de fixture/stack, comandos y salidas visibles, resultado externo separado.
Nunca serializar variables de entorno, claves, headers de autorización ni credenciales. Logs del oráculo solo en almacenamiento del evaluador; no reutilizarlos como feedback.
Cada intento tiene identidad propia; conservar fallos. null significa desconocido/no observado, nunca cero.
Se almacenará todo bajo runs/corpus-generation o runs/pi0 según propósito; este commit no crea runs ficticios.

## Ensayo del motor
El comando `npm run runner:simulate` conserva eventos, respuestas guionadas, comandos/salidas, parches y evaluaciones simuladas en `.artifacts/simulations/<uuid>/`. Cada registro se identifica como simulación; no usa el schema de referencia experimental ni ocupa runs/corpus-generation. El resumen solo se escribe tras verificar todos los escenarios. No se inventan métricas de modelos. El almacenamiento durable de referencias reales continúa pendiente.
