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

La configuración actual usa Synterolink para los tres modelos comerciales. Credencial común: SYNTEROLINK_API_KEY. Si hay claves diferentes, usar SYNTEROLINK_OPENAI_API_KEY, SYNTEROLINK_ANTHROPIC_API_KEY y SYNTEROLINK_GOOGLE_API_KEY; cada una tiene prioridad sobre la común. Nunca se reutilizan claves directas de OpenAI/Anthropic/Google para Synterolink. Se leen solo del entorno de este proceso. Para un archivo `.env` local excluido de Git, partir de `.env.example`, completar las claves localmente y ejecutar:

```powershell
node --env-file=.env runner/providers/cli.mjs inspect
node --env-file=.env runner/providers/cli.mjs smoke openai anthropic google
```

No pegar claves en mensajes ni incorporarlas a config/models.json. No se buscan claves en archivos personales ni se inyectan en el contenedor.

## Integración y formato

`createProviderAdapter({provider,config,apiKey,fetchImpl?,onCall?})` implementa `next(context,{signal,timeout})`. `createProviderPool({models,credentials,onCall})` dirige context.provider al adaptador correspondiente. Los adaptadores devuelven las acciones del motor; no las ejecutan. Las pruebas usan transporte controlado y servidor HTTP local, sin credenciales reales.

Los cuatro transportes usan un JSON común `{type,argv}` con validación estricta. Se emplean salidas estructuradas, no el tool calling nativo de cada proveedor. El mismo historial visible se serializa como texto; no se envían estados privados del coordinador, razonamiento interno ni resultados del oráculo. Los campos superiores permitidos son packet, messages, attempt y cycle. El coordinador debe construir el packet con las funciones existentes.

Destinos permitidos explícitos en connection.mjs: APIs directas, Synterolink y Ollama en 127.0.0.1:11434. Redirecciones prohibidas, sin reintentos automáticos, respuesta máxima 2 MiB, timeout/cancelación propagados. Credenciales y errores del servidor no se serializan en logs. Los errores retornan códigos sanitizados. Un callback de registro fallido propaga el error: el coordinador no debe continuar sin evidencia.

## Synterolink

Rutas basadas en los tres ejemplos OpenCode proporcionados por el usuario:

| Modelo elegido | Ruta | Autenticación del transporte |
|---|---|---|
| GPT-5.6 Sol | https://api.synterolink.com/v1/responses | Authorization: Bearer |
| Claude Sonnet 5 | https://api.synterolink.com/v1/messages | x-api-key + anthropic-version |
| Gemini 3.1 Pro | https://api.synterolink.com/v1beta/models/gemini-3.1-pro-preview:generateContent | x-goog-api-key |

Se mantienen los identificadores elegidos. El ejemplo Anthropic no enumera modelos; el acceso a claude-sonnet-5 debe confirmarse con la clave. No se copian los otros modelos del catálogo ni se elevan automáticamente los límites de generación. El ejemplo Gemini utiliza opciones propias del SDK; nuestro adaptador REST mantiene thinkingLevel high como parámetro preparatorio explícito.

La procedencia de cada llamada distingue provider (familia del modelo), access_provider (synterolink), base_url y modelo solicitado/reportado. observed_model es lo que informa el intermediario, no una verificación independiente de sus pesos o enrutamiento. store=false se conserva en las peticiones Responses; su cumplimiento por el servicio no se ha auditado.

La comprobación autenticada de los tres modelos pasó usando las claves locales. Evidencia en docs/verification/synterolink-connectivity.json. Sonnet devolvió inicialmente JSON dentro de Markdown a pesar del esquema de salida; se incluyó el contrato JSON y la instrucción sin Markdown también en el mensaje visible común de todos los adaptadores. El parser continúa siendo estricto: no extrae JSON de texto arbitrario. La comprobación final de los tres pasó; esto demuestra conectividad instrumental, no cumplimiento del esquema para cualquier solicitud ni calidad funcional de F001.

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
