# Adaptadores reales: conectividad preparatoria

El pool elegido se registra en `config/models.json`, separando display_name y api_model_id. Los locales usan contexto 8192 y digest observado de Ollama. Esta selección no equivale a haber generado referencias; `provenance.models` conserva null porque no existe uso experimental. El runner público sigue admitiendo únicamente simulaciones.

| Etiqueta | Modelo | Identificador API |
|---|---|---|
| openai | GPT-5.6 Sol | gpt-5.6-sol |
| anthropic | Claude Sonnet 5 | claude-sonnet-5 |
| google | Gemini 3.1 Pro | gemini-3.1-pro-preview |
| local_a | Qwen2.5-Coder 7B | qwen2.5-coder:7b |
| local_b | Granite 3.3 8B | granite3.3:8b |

## Uso

```powershell
npm run providers -- inspect
npm run providers -- smoke local_a local_b
```

inspect comprueba presencia de credenciales y metadatos locales sin inferencia. smoke requiere etiquetas explícitas, envía un mensaje instrumental mínimo y nunca ejecuta argv ni envía F001. Las pruebas comerciales pueden consumir tokens; no se ejecutan por defecto. Cada llamada local verifica digest antes y después y descarga el modelo de memoria al finalizar mediante keep_alive=0, sin borrar sus archivos.

Credenciales: OPENAI_API_KEY, ANTHROPIC_API_KEY y GEMINI_API_KEY (alternativa GOOGLE_API_KEY). Se leen solo del entorno de este proceso. Para un archivo `.env` local excluido de Git, partir de `.env.example`, completar las claves localmente y ejecutar:

```powershell
node --env-file=.env runner/providers/cli.mjs inspect
node --env-file=.env runner/providers/cli.mjs smoke openai anthropic google
```

No pegar claves en mensajes ni incorporarlas a config/models.json. No se buscan claves en archivos personales ni se inyectan en el contenedor.

## Integración y formato

`createProviderAdapter({provider,config,apiKey,fetchImpl?,onCall?})` implementa `next(context,{signal,timeout})`. `createProviderPool({models,credentials,onCall})` dirige context.provider al adaptador correspondiente. Los adaptadores devuelven las acciones del motor; no las ejecutan. Las pruebas usan transporte controlado y servidor HTTP local, sin credenciales reales.

Los cuatro transportes usan un JSON común `{type,argv}` con validación estricta. Se emplean salidas estructuradas, no el tool calling nativo de cada proveedor. El mismo historial visible se serializa como texto; no se envían estados privados del coordinador, razonamiento interno ni resultados del oráculo. Los campos superiores permitidos son packet, messages, attempt y cycle. El coordinador debe construir el packet con las funciones existentes.

URLs fijas de proveedores y Ollama en 127.0.0.1:11434. Redirecciones prohibidas, sin reintentos automáticos, respuesta máxima 2 MiB, timeout/cancelación propagados. Credenciales y errores del servidor no se serializan en logs. Los errores retornan códigos sanitizados. Un callback de registro fallido propaga el error: el coordinador no debe continuar sin evidencia.

onCall recibe modelo solicitado/observado, parámetros, fecha/duración, tokens disponibles, resultado y código de fallo. Se conserva uso incluso en respuestas incompletas. Costo desconocido permanece null; no se estima precio ni se equiparan los contadores de razonamiento de diferentes APIs. Los cuerpos completos y headers no se registran. Los informes de smoke se guardan en .artifacts/providers y se marcan experimental=false.

## Parámetros preparatorios y límites

OpenAI: reasoning medium. Sonnet: adaptive thinking y effort high, sin sampling personalizado. Gemini: thinking high. Salida comercial máxima 4096 tokens; locales 1024, temperatura 0 y seed 42. Estos valores se documentan como preparación y requieren evaluación antes de congelar el piloto; no implican equivalencia de esfuerzo entre modelos.

El límite local de entrada usa bytes UTF-8 conservadoramente, reservando salida y 512 tokens para plantilla. Rechaza contexto excesivo en vez de truncarlo. No sustituye una política de contexto del experimento: integrar el packet completo de F001 y el historial a 8192 requiere medir tokens y definir recuperación/compactación antes de generación.

Los tags locales se contrastan con digest; no se descargan otros modelos. Los IDs comerciales pueden ser aliases/preview: registrar el modelo observado en cada llamada y confirmar acceso de cuenta; selección documental no prueba conectividad. Falta conectar la generación real, oráculo E2E, registro/exportación de referencias y política definitiva de contexto. No hay comando que genere V0 en esta entrega.

## Documentación consultada

- [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) y [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs).
- [Sonnet 5](https://platform.claude.com/docs/en/models/sonnet-5/overview) y [JSON outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
- [Gemini 3.1 Pro](https://ai.google.dev/gemini-api/docs/generate-content/gemini-3) y [salidas estructuradas](https://ai.google.dev/gemini-api/docs/structured-output).
- [Ollama chat](https://docs.ollama.com/api/chat) y [metadatos de modelos](https://docs.ollama.com/api/tags).
