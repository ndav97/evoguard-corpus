# Parámetros de materialización (2026-09-22)
Estas decisiones concretan detalles antes no fijados; no se atribuyen al texto literal del protocolo.
- JSON Schema draft-07, versión de esquema 1.0.0. Manifiestos YAML aceptan sintaxis JSON (subconjunto YAML 1.2).
- El fixture se fija por SHA-256 de bytes UTF-8/LF antes de generar V0; nombres/precios concretos creados ahora. No es una referencia funcional.
- En V0 el orden de presentación no se evalúa. En R003, comparación de nombres ASCII, case-insensitive; empate mantiene orden del fixture (precios incluyen empates). Modo inicial sin orden explícito conserva fixture.
- R004: controles de navegación observables; con cero resultados no hay siguiente/anterior válidos. Se permite indicador 0/0 o 1/1 vacío, sin exigir copy específico. Cambiar orden conserva número de página (no cambia cantidad de resultados).
- R005: selección observable incluso si el producto está en otra página; filtrar y mantenerlo conserva selección. Quitar el filtro no restaura una selección limpiada.
- No fijar selectores, nombres de componentes ni diseño. El adapter del oráculo se escribirá contra UI real y se auditará aparte; hoy hay escenarios declarativos completos y contrato, sin afirmar oráculo E2E implementado. **Sustituida parcialmente el 2026-09-24** para roles y nombres accesibles: ver «Contrato de interfaz observable». Nombres de componentes y diseño siguen libres.
- Fallback recorre cada uno de cinco proveedores como máximo una vez por tarea; si todos fallan se registra bloqueo. Evita intentos ilimitados.
- Dependencias exactas/lockfiles para preparación local. Congelamiento experimental pendiente de Linux/Docker y navegador.
- Repo nuevo en carpeta evoguard-corpus dentro del proyecto, fuera de sources/. Un primer commit tras validar; no se crea worktree adicional para un repo sin historia.
- No se ejecutan modelos ni se serializan secretos. Los esquemas de generación/π0 describen registros futuros, no contienen observaciones ficticias.

## Ampliación autorizada: contenedor — 2026-09-23
- Runtime Linux verificado y archivado por SHA-256. El congelamiento integral del experimento permanece pendiente; no hay V0.
- Base Node oficial por digest y Chromium headless de Playwright 1.63.0. Reproducción exacta desde archivo, no promesa de builds idénticos contra repositorios apt cambiantes.
- Transferencia por stdin de allowlist, sin montajes del host. Git interior nuevo y determinista. V1–V3 se rechazan hasta implementar exportador de referencias válidas.
- Coordinador de modelos fuera del sandbox; no se exponen API keys ni se habilita red externa. Ningún modelo local fue seleccionado.
- Evidencia ligada a hashes del payload y controles; cambios invalidan la autorización. Cada reverificación revoca primero la evidencia anterior. Timeout/exceso de salida eliminan el contenedor propio.

## Motor ensayado sin proveedores — 2026-09-23
- El motor admite únicamente simulación. F001 sigue DRAFT; no se crean referencias, commits funcionales ni modelos seleccionados.
- Un ciclo es una respuesta del adaptador, incluida la entrega. Los 25 ciclos y timeout aplican por intento; el tiempo incluye herramientas, evaluación y captura de evidencia.
- Timeout, agotamiento de ciclos o technical_failure reasignan sin reparar un proceso incierto. Fallos visibles de build/typecheck/tests permiten intentos 2/3 en el mismo workspace. Oracle/arquitectura fallidos reasignan sin feedback privado. Fallos de infraestructura detienen la tarea.
- No se conserva aceptación si falla la captura o cierre. Un snapshot null por timeout indica evidencia no capturada, nunca parche válido.
- Los escenarios guionados usan Docker real, marcador instrumental, compilación real y evaluaciones funcionales simuladas. Se registran aparte en .artifacts/simulations; no confundir PASS del ensayo con validación funcional.

## Pool seleccionado y adaptadores — 2026-09-23
La continuación de “evoguard chat” fija GPT-5.6 Sol, Claude Sonnet 5, Gemini 3.1 Pro, qwen2.5-coder:7b y granite3.3:8b, ambos locales con contexto 8192. La selección se guarda en config/models.json; provenance.models sigue sin uso experimental registrado. Las APIs comerciales utilizan IDs documentados, separados de display_name. Gemini se documenta actualmente como gemini-3.1-pro-preview.

Los adaptadores usan JSON estructurado común para acciones del runner; no herramientas específicas de un proveedor. El 2026-09-24 se congelaron los parámetros de inferencia ya usados en el smoke autenticado: comerciales con `max_output_tokens` 4096 y razonamiento medium (OpenAI), high (Anthropic) y high (Google); locales con contexto 8192, `max_output_tokens` 1024, temperatura 0, semilla 42 y digest observado. Temperatura y semilla comerciales permanecen null porque esos modelos no las exponen de forma equivalente. Este congelamiento no registra uso experimental: `provenance.models`, `pi0_model`, `pi0_repetitions` y `money_cutoff_usd` siguen null, y F001 sigue DRAFT. El packet/historial experimental requiere una política de contexto antes de generación.

Ambos modelos locales se encontraron instalados en Ollama 0.32.15, Q4_K_M; se fijaron digests observados y se verificó respuesta mínima sin tarea F001. No se descargaron modelos ni se alteró la selección. Las claves comerciales no estaban disponibles en el entorno de la sesión; no se efectuaron llamadas comerciales. La configuración con .env es optativa, ignorada por Git y no se carga automáticamente.

## Acceso comercial mediante Synterolink
El usuario aclaró que sus claves pertenecen a Synterolink y proporcionó tres ejemplos OpenCode sin secretos. Se configuraron Responses y Messages bajo https://api.synterolink.com/v1 y Gemini nativo bajo https://api.synterolink.com/v1beta. Se preservó el pool elegido y se separó familia de modelo de intermediario en los registros. Las claves Synterolink tienen variables propias, compartida o por proveedor, sin fallback a claves directas. Sonnet 5 conserva su ID previo: el ejemplo Anthropic solo identifica transporte, no catálogo.

La compatibilidad de las rutas está implementada y comprobada con transporte controlado; la conectividad autenticada sigue pendiente. Ninguna clave enmascarada se trata como credencial real. No se generó V0 ni se hicieron solicitudes comerciales autenticadas.

## Contrato de interfaz observable — 2026-09-24
Problema: el adapter del oráculo necesita localizar controles y resultados (nombres accesibles «Buscar», «Categoría», «Orden», «Anterior», «Siguiente»; productos como listitem con ID; selección en `role="status"`), pero el constructor no recibía esa información (`generate-v0.md` dejaba la UI a su criterio). Una V0 funcionalmente correcta podía fallar por la forma de la interfaz, y ese fallo se habría contado como error funcional del modelo, sesgando la comparación entre modelos.

Decisión (autorizada por el usuario): cada requisito incluye `ui_contract` (estado inicial y elementos con rol, nombre accesible y regla). El packet lo entrega por requisito activo, de modo que V0 recibe solo el de R001–R002 y los contratos de orden, paginación y selección llegan con T001–T003; no se anticipan requisitos futuros. Los prompts común, V0 y de evolución exigen cumplirlo; fuera de él, diseño y descomposición siguen libres. El contrato describe interfaz, no escenarios ni resultados esperados: los 33 casos siguen privados.

Consecuencias: cambió el esquema de requisitos (`ui_contract` obligatorio), el payload verificado del contenedor (prompts, packet, R001, R002) y por tanto debe ejecutarse de nuevo `npm run environment:verify` (la imagen no cambia). `tests/contract.test.mjs` impide que adapter y contrato diverjan y que V0 reciba contratos futuros. Un fallo por incumplir el contrato se clasifica como FAIL del candidato (incumple un requisito recibido), no como fallo de infraestructura.

## Política de contexto — 2026-09-24
Decisión del usuario: los modelos comerciales no reciben menos contexto del normal, porque en un uso real no lo tendrían. Conservan el paquete completo (incluidos los 30 productos) y el historial íntegro de cada llamada, igual que antes. La política solo alcanza a los modelos con ventana limitada (`applies_to`: local_a y local_b, 8192 tokens), para los que gestionar el contexto es una restricción propia del modelo.

Para los locales (`config/context.json`, `runner/context/policy.mjs`):
- Presupuesto de entrada: 8192 − 1024 (salida) − 512 (plantilla) = 6656 tokens, incluida la instrucción de sistema y el esquema.
- Núcleo obligatorio: contrato de respuesta, paquete (solicitud, prompt, requisitos y `ui_contract`) y feedback visible (el último hasta 3000 bytes). Los productos no se repiten en el mensaje: se remite a `fixtures/products.json` y `TASK.json` del workspace. Si el núcleo no cabe → `CONTEXT_CORE_TOO_LARGE`.
- Historial: del paso más reciente hacia atrás; los 2 últimos con límites amplios (3000 bytes por argumento y salida) y los anteriores comprimidos (200/400 bytes). Los recortes conservan inicio y final con aviso explícito. Al primer paso que no cabe se omiten él y los anteriores, y se declara `omitted_steps`. Sin el último paso → `CONTEXT_WINDOW_TOO_SMALL`.
- Estimación: cota por bytes UTF-8 / (bytes_por_token × 0,8). Provisional 2,5 B/token hasta calibrar con `npm run context:calibrate -- --write` (prompt_eval_count real de Ollama). El preflight bloquea mientras la política no esté `CALIBRATED`.
- Control posterior: `prompt_eval_count` ≤ estimación + 512 y ≤ 7168; si no, `CONTEXT_ESTIMATE_VIOLATION`. Estos errores son de infraestructura y no se atribuyen al modelo.

Consecuencia metodológica: comerciales y locales no reciben la misma información por ciclo. La diferencia queda registrada por llamada (`metadata.context`) y debe tratarse como variable del análisis, no como fallo del modelo.

Riesgos residuales: (1) los comerciales mantienen el tope previo de 1 MiB por llamada; un historial de 25 ciclos con salidas de 64 KiB puede superarlo (`INPUT_TOO_LARGE`), así que conviene fijar después el tope según la ventana real de cada modelo; (2) la salida local de 1024 tokens limita cuánto código puede escribir un local en una sola acción; (3) la cota por bytes es empírica: el control posterior detecta subestimaciones en llamadas sin truncar, pero una subestimación mayor que la reserva podría quedar oculta si Ollama trunca. El factor 0,8 la cubre con margen.

## Integración real del pipeline (Paso 5) — 2026-09-24
Decisiones tomadas por Claude con autorización general del usuario:
- **Oráculo en contenedor propio.** El `dist/` del candidato se evalúa en un contenedor nuevo (rol `oracle-evaluator`, misma imagen y aislamiento). Se descartó evaluar en el host (ejecutaría código del candidato fuera del sandbox) y dentro del contenedor del constructor (expondría el oráculo). Construir de nuevo el candidato en el contenedor de evaluación también se descartó: ejecutaría scripts del candidato junto al oráculo.
- **Comandos visibles fijos.** `tsc --noEmit`, `vite build` y `vitest run` se invocan por ruta dentro de `node_modules`, no mediante scripts de `package.json`, que el candidato podría alterar. El prompt común los declara explícitamente; las pruebas de desarrollo requieren al menos un test de Vitest.
- **Arquitectura como análisis estático** del árbol exportado (reglas en `runner/pipeline/README.md`). Import del fixture y `useState` son obligatorios; el rango de 5–20 componentes queda como métrica de auditoría. Un rechazo de arquitectura reasigna sin feedback, como el oráculo.
- **Inicializador enviado desde el host** (`runner/sandbox/seed-init.mjs`) en lugar del incluido en la imagen, para soportar V1–V3 sin reconstruir la imagen verificada, cuya reconstrucción no es reproducible bit a bit.
- **Historia evolutiva**: scaffold → `reference: V0` → `task: V1` → …; los mensajes de commit no revelan proveedor, modelo ni métricas; cada hash debe coincidir con el registrado; los parches se auditan (rutas del pipeline, secretos, enlaces, tamaño).
- **Candidatos del ensayo**: el ensayo usa código escrito a mano (`tests/fixtures/rehearsal/`), marcado como instrumental. Nunca es referencia del corpus ni se entrega a un constructor; sus registros quedan fuera de Git.
- **Errores de infraestructura** (Docker, navegador del oráculo) detienen la tarea como `INFRA_ERROR`, sin atribuirse al modelo. Un build sin `dist/index.html` o un árbol no exportable (enlaces, tamaño) es un fallo del candidato.

## Preflight, generación y auditoría (Pasos 6–8) — 2026-09-24
Decisiones tomadas por Claude con autorización general del usuario:
- **Preflight comprobable** (`runner/preflight.mjs`): validación del corpus y de su ciclo de vida; contenedor verificado e igual al stack; parámetros de inferencia congelados y locales con digest y contexto; política de contexto calibrada; oráculo `E2E_CALIBRATED`; evidencia `docs/verification/pipeline-rehearsal.json` en PASS con la misma imagen y la misma huella del código ensayado; F001 no congelada. Ya no exige procedencia de ejecuciones futuras (dependencia circular).
- **Ciclo de vida**: DRAFT → GENERATED (referencias consecutivas desde V0) → VALIDATED (V0–V3) → AUDITED/FROZEN (auditoría PASSED; FROZEN activa `stack.experimental_frozen`). Los esquemas de familia, procedencia y stack se ampliaron para admitirlo, y el validador contrasta cada referencia con sus archivos.
- **Salida inválida del modelo** (JSON o acción inválida, rechazo, respuesta incompleta): consume un ciclo y el modelo recibe un aviso visible; no se trata como infraestructura. Una ventana de contexto insuficiente reasigna (`CONTEXT_LIMIT`). Los errores transitorios de API o red (408/409/425/429/5xx, red, respuesta vacía o no JSON) se reintentan 3 veces (15 s, 60 s, 180 s) antes de declararse `INFRA_ERROR`.
- **Generación** (`npm run corpus:generate -- all`): una tarea por versión, empezando por el proveedor del `generation_plan`, con commit Git por versión (referencia o intento sin referencia). Nunca sobrescribe una referencia; si una versión queda BLOCKED se detiene y conserva los registros.
- **Auditoría** (`npm run corpus:audit -- --freeze`): por referencia reconstruye la historia (hash exacto), repite typecheck/build/tests, arquitectura, 5 ejecuciones del oráculo con resultado idéntico y PASS, coherencia de registros y ausencia de fugas (oráculo, procedencia, secretos, requisitos futuros) en la historia visible. La revisión de similitud se declara `NOT_APPLICABLE_SINGLE_FAMILY` hasta que existan otras familias.
- **Parche vacío** aceptado como válido: una versión aceptada sin cambios de código produce un commit vacío reproducible.

## Protocolo de acciones 1.1 y diagnóstico de proveedores — 2026-09-25
Decisiones de Claude con autorización del usuario (detalle en `docs/protocol-v1.1-actions.md`):
- **Mismo protocolo para los cinco modelos.** Acciones estructuradas (`read_file`, `list_files`, `write_file`, `edit_file`, `run_checks`) además de `tool`, vista inicial del workspace y aviso de bucles. Solo cambian las affordances; el contenido informativo (requisitos, `ui_contract`, feedback visible) es el mismo, y el oráculo sigue privado.
- **Normalización acotada**: se acepta un bloque Markdown que envuelva todo el JSON, registrado como `markdown_fence`. Revierte parcialmente la decisión del 2026-09-23 de no relajar el parser, porque con Synterolink ese formato aparece como artefacto de transporte y su rechazo sesgaba la comparación entre modelos. Otro texto alrededor del JSON sigue siendo inválido.
- **Texto rechazado conservado** (recortado, con hash y secretos redactados) para distinguir problemas del proveedor de problemas del modelo.
- **`keep_alive` de Ollama a 15 min**, solo para velocidad; no altera la inferencia.
- **Rutas protegidas** (`TASK.json`, `fixtures/`, `.git/`, `node_modules/`, `dist/`) para las acciones de escritura; el shell (`tool`) conserva el comportamiento 1.0 y la arquitectura sigue detectando cambios de fixture o dependencias.
- **F001 no se modifica**: está FROZEN con protocolo 1.0. Recomendación: regenerarla como revisión 2 con 1.1 cuando los proveedores estén sanos, para que sea comparable con las familias nuevas.

## Banco de modelos locales en GPU alquilada (paso 3) — 2026-09-25
Decisiones de Claude con autorización del usuario (proveedor elegido por el usuario: Vast.ai):
- **Arquitectura**: el pipeline sigue en el equipo del usuario; solo Ollama corre en la GPU alquilada, accesible por túnel SSH en `127.0.0.1:11435` (`EVOGUARD_OLLAMA_PORT`). El host siempre es 127.0.0.1: no se admite un Ollama expuesto públicamente. En la instancia, Ollama escucha solo en loopback.
- **Banco = pipeline real con un solo modelo**: mismas etapas, protocolo 1.1 y tope de intentos que la generación, partiendo de las referencias congeladas de F001; sin reasignación (`singleProvider`, permitido solo en modo ensayo). Sus resultados nunca son referencias del corpus.
- **Estimador por candidato**: antes de cada candidato se mide su tokenizador (núcleo V3 y fixture) porque la calibración oficial es de Qwen2.5/Granite. La política de producción sigue fijando los locales a 8 192 hasta un nuevo congelamiento: un local con otro contexto y la política actual da `CONTEXT_POLICY_MISMATCH`.
- **Candidatos iniciales** (`config/local-bench.json`): las dos líneas base del pool actual (Qwen2.5-Coder 7B y Granite 3.3 8B a 8k/1024), Qwen2.5-Coder 7B a 32k/4096, Qwen2.5-Coder 14B, Devstral 24B, Qwen3-Coder 30B (MoE) y Qwen2.5-Coder 32B a 16k. Todos caben en 24 GB en Q4.
- **Criterio de selección** (documentado en `docs/gpu-vast-ai.md`): al menos 3/4 tareas aceptadas, sin errores de infraestructura del modelo, sin bucles persistentes, tiempos compatibles con el tope de 1 h por intento y dos familias de modelos distintas.
- **Reintentos de transporte comunes** (`runner/providers/retry.mjs`): la autoprueba reveló conexiones HTTP reutilizadas y ya cerradas tras la evaluación, situación que también puede darse por el túnel SSH; se reintentan como errores de red (el banco con esperas cortas y la generación con las de antes). Una salida inválida del modelo nunca se reintenta: consume un ciclo.

## Familias sintéticas F002–F010 — 2026-09-25
Decisiones de Claude con autorización del usuario (detalle en `docs/family-authoring.md` y `docs/checkpoint-2026-09-25-familias.md`):
- **Pipeline por familia** sin cambiar el comportamiento de F001: descubrimiento por directorio, validación por familia y global, módulo de oráculo por familia (`runner/oracle/families/Fxxx`) con adaptador accesible genérico, contexto de navegador nuevo por caso y reglas de arquitectura derivadas del `structural_profile`.
- **Rotación por fila**: `provider_ring[(n − 1 + v) mod 5]`; con 10 familias cada proveedor genera 8 de 40 artefactos.
- **Preservación** como regla de autoría: los casos de requisitos anteriores deben seguir siendo verdaderos en V3; la calibración la comprueba (la versión anterior falla exactamente los casos del requisito nuevo).
- **Calibración E2E aparte de `npm test`** (`npm run test:calibration`) por duración.

## Estrato semi-real S001–S010 e integración en el runner — 2026-09-27
Motivación: el corpus no puede basarse solo en datos sintéticos (indicación del docente). Selección, minado y calibración de las bases: `docs/seleccion-piloto-semi-real.md` y `docs/resumen-chat-estrato-semi-real-2026-09-27.md`. Diseño de la integración: `docs/diseno-integracion-semi-real.md` (aprobado por el usuario). Decisiones de Claude:
- **V0 no se genera**: es el commit real fijado. Los modelos generan V1–V3 (30 artefactos); rotación por fila `provider_ring[(n − 1 + v) mod 5]` con v = 1..3, 6 artefactos por proveedor, registrada en `generation.plan` de cada `family.yaml`.
- **Imagen Docker inmutable por familia** (`npm run real:prepare`, `scripts\real\preparar-imagenes.cmd`): `node:<major>-bookworm` fijado por digest local; repositorio clonado por SHA con la historia reducida a un commit determinista `base: V0` (el constructor no ve la historia real posterior); dependencias con el lockfile del repo (`--frozen-lockfile`/`npm ci`); la instalación no puede modificar archivos versionados. Verificación sin red: suite completa dos veces idéntica y sin fallos fuera de `known_failures`, parches de referencia aplicables en orden, zona del cambio presente. Evidencia en `config/real-bases.json`.
- **Aislamiento**: mismo que el estrato sintético (sin red, sin capacidades, uid 1000, límites) salvo la raíz de solo lectura: el repositorio con sus dependencias vive en la capa escribible del contenedor, que se destruye al cerrarlo. Memoria por contenedor configurable (`EVOGUARD_REAL_MEMORY_MB`; en Windows, 75 % de la de Docker Desktop).
- **Lo que ve el constructor**: la petición `turns/T00n.md`, la zona del cambio (`focus`, rutas desde la raíz del repo), una vista inicial del paquete y los resultados de `run_checks` (la suite del repositorio). Nunca tests ocultos, parches de referencia ni el manifiesto. Escribir sobre tests existentes, dependencias, lockfiles, configuración de tests/build/lint o el directorio reservado de los tests ocultos se bloquea con un mensaje visible.
- **Etapas**: `typecheck` solo si la familia lo define (si no, `NOT_APPLICABLE`); `build` `NOT_APPLICABLE`; `development_tests` = suite completa (visible, permite reparar); `independent_oracle` = en un contenedor nuevo, tests ocultos de T1..Tn sin fallos ni errores de compilación y suite sin regresiones fuera de `known_failures` (privado, reasignación sin feedback); `architecture` = control de alcance del parche (dependencias, configuración, tests existentes modificados o borrados, directorio reservado, enlaces). El motor admite `NOT_APPLICABLE` y exige al menos una etapa PASS; los registros ACCEPTED exigen `independent_oracle` PASS.
- **Linaje**: Vn = V0 + parches **aceptados** de V1..Vn−1 (de modelos, no las referencias de calibración), con commits deterministas comprobados por hash. Se refresca el índice de git al abrir (las capas de la imagen alteran metadatos) y las instantáneas usan un índice temporal para no alterar el del constructor (cambio aplicado también al estrato sintético).
- **Ensayos sin modelos**: `npm run real:rehearse -- --mini` (familia de prueba S900, sin red; valida el pipeline completo incluidos generación, auditoría y congelamiento) y `npm run real:rehearse -- Sxxx` / `scripts\real\ensayar-familias.cmd` con la imagen real de cada familia (los parches de referencia como constructor instrumental; en V1 además rechazos por alcance, por oráculo y una reparación visible). El preflight de cada familia exige ambos ensayos vigentes con la misma imagen y el mismo código.
- **Auditoría semi-real**: historia por hash, alcance de cada parche, suite visible, búsqueda de fugas en la historia visible y oráculo con `policy.oracle_stability_runs` ejecuciones idénticas en PASS; `--freeze` fija `generation.status: FROZEN` con la evidencia.
- **Normalizaciones de datos**: `focus` de S010 pasó a ser relativo a la raíz del repositorio como en las demás familias; se añadió el bloque `generation` (estado, plan, referencias) a cada `family.yaml`.

## Diagnóstico de proveedores y preámbulo en prosa — 2026-09-28
Evidencia: `npm run providers:diagnose` en el PC del usuario (protocolo 1.1, 5 rondas × 2 escenarios, `.artifacts/providers/diagnose-2026-09-28T22-38-36-914Z.json`).

| Proveedor | Modelo | Acciones válidas | Estado | Rechazos |
|---|---|---|---|---|
| openai | gpt-5.6-sol | 9/10 | HEALTHY | 1 `INVALID_ACTION`: `read_file` con `content` no vacío (error del modelo) |
| anthropic | claude-sonnet-5 | 0/10 | FAILING | 10 `INVALID_ACTION_JSON`: siempre una o dos frases de prosa antes de la acción |
| google | gemini-3.1-pro-preview | 9/10 | HEALTHY | 1 `INVALID_ACTION_JSON`: `write_file` grande con escapes rotos en `content` (error del modelo); 4 aceptadas con `markdown_fence` |

Diagnóstico de Sonnet: las 10 acciones eran correctas (`list_files` al inicio, `read_file src/App.tsx` tras el error de tipos). Solo cambiaba el envoltorio: 6 con prosa + bloque ```json, 3 con prosa + JSON suelto y 1 con una pseudo-llamada XML `<function_calls>`. El adaptador ya pide salida estructurada (`output_config.format` con el esquema de acciones), así que una respuesta con prosa indica que **Synterolink no aplica ese parámetro** en la ruta Messages. Es un problema de transporte, no de capacidad; rechazarlo dejaría a Sonnet fuera de todas sus versiones y sesgaría la comparación, como ya pasó en F001.

Decisión de Claude con autorización del usuario:
- **Nueva normalización acotada `prose_prefix` / `prose_prefix_fence`** (`runner/protocol/actions.mjs`), igual para los cinco modelos. Se acepta un preámbulo de prosa seguido de un único objeto JSON, suelto o en bloque ```json, con estas condiciones:
  - el preámbulo tiene como máximo 2 000 caracteres y no contiene llaves ni bloques de código;
  - el objeto empieza en línea propia y llega hasta el final de la respuesta.

  La prosa se descarta sin interpretarla y su longitud se registra (`discarded_chars` en `calls.jsonl`). El diagnóstico cuenta estas respuestas aparte (`normalized_prose`).
- **Siguen siendo inválidos:**
  - texto después del JSON;
  - varios objetos;
  - JSON dentro de la prosa;
  - pseudo-llamadas XML (1 de las 10 respuestas de Sonnet);
  - JSON mal escapado.
- **Efecto esperado con las muestras reales:** anthropic pasa de 0/10 a 9/10 (HEALTHY). openai y google no cambian, porque sus rechazos son errores reales de la acción.
- **Medición:** la normalización es parte del protocolo registrado. En el análisis se podrá informar la tasa de respuestas normalizadas por modelo como indicador de adherencia al formato, separado de la calidad del código.
- **F001 sigue sin tocar** (FROZEN con 1.0). Se mantiene la recomendación de regenerarla como revisión 2.
- **Pendiente con Synterolink:** preguntar si la ruta `/v1/messages` admite `output_config.format` (o el nombre anterior `output_format`) para Sonnet 5. Si lo admite, la normalización deja de hacer falta en la práctica, pero se conserva por robustez.
- **Evidencia afectada:** `actions.mjs` y `adapter.mjs` forman parte de la huella del pipeline.
  - Reverificados en el entorno de Claude: el ensayo integral sintético y el ensayo semi-real de la familia de prueba S900, ambos en PASS.
  - Los ensayos de S001–S010 quedan desactualizados y hay que repetirlos en el PC (`scripts\real\ensayar-familias.cmd`); el preflight lo indica.

### Segundo diagnóstico (2026-09-29 01:55 UTC, con la normalización `prose_prefix`)
Evidencia: `.artifacts/providers/diagnose-2026-09-29T02-02-15-681Z.json`.

| Proveedor | Válidas | Estado | Detalle |
|---|---|---|---|
| openai | 10/10 | HEALTHY | Todas sin normalizar; mediana 23 s |
| anthropic | 6/10 | DEGRADED | Las 6 válidas llegaron con preámbulo en prosa. Los 4 rechazos son pseudo-llamadas XML (`<function_calls><invoke name="list_files">…`) |
| google | 9/10 | HEALTHY | 8 con `markdown_fence`; 1 `INCOMPLETE_RESPONSE` (29 s) |

La normalización funciona como se esperaba, pero Sonnet alterna entre JSON y el formato XML de herramientas: 1/10 en el primer diagnóstico y 4/10 en este. **No se añade una normalización para XML.** Convertir ese formato en una acción sería traducir, no quitar un envoltorio, y sería ambiguo con contenidos largos (`write_file`). La salida correcta es arreglar el transporte.

Decisión: la herramienta de diagnóstico `npm run providers -- probe` (`runner/providers/probe.mjs`) prueba cinco variantes de petición a `/v1/messages` con el mismo contexto:

| Variante | Qué pide |
|---|---|
| A | La actual: `output_config.format` |
| B | El nombre beta `output_format` con `anthropic-beta: structured-outputs-2025-11-13` |
| C | A sin razonamiento extendido |
| D | Una herramienta `runner_action` con el esquema de acciones, `tool_choice: auto` y razonamiento adaptativo |
| E | La herramienta forzada (`tool_choice: tool`), sin razonamiento extendido, porque la API no permite forzar herramienta con razonamiento extendido |

Por llamada registra el estado HTTP (con el cuerpo del error recortado y redactado), los tipos de bloque, `stop_reason` y si la acción es válida. El adaptador no cambia hasta ver el resultado. Criterios para elegir la variante:
1. La que dé ≥ 9/10 conservando el razonamiento, en el orden A, B, D.
2. Si solo E funciona, se usará E y se documentará que Sonnet genera sin razonamiento extendido. Es una diferencia de configuración entre modelos que habría que declarar en el análisis.

### Resultado de la sonda (2026-09-29 02:33 UTC, 2 rondas × 2 escenarios por variante)
Evidencia: `.artifacts/providers/probe-anthropic-2026-09-29T02-33-16-279Z.json`. Todas las llamadas devolvieron HTTP 200 con `claude-sonnet-5`.

| Variante | Válidas | Observación |
|---|---|---|
| A `output_config.format` | 3/4 | Siempre prosa antes del JSON. Hubo 1 pseudo-llamada XML. |
| B `output_format` (beta) | 2/4 | 2 pseudo-llamadas XML. |
| C A sin razonamiento | 3/4 | 1 pseudo-llamada XML. |
| D herramienta, `auto`, con razonamiento | 3/4 | Siempre emitió `tool_use`. El único fallo fue `INVALID_ACTION`: la entrada no cumplía el esquema. |
| E herramienta forzada, sin razonamiento | 4/4 | Siempre `tool_use`. |

Conclusiones:
- **Synterolink ignora la salida estructurada** con cualquiera de los dos nombres de parámetro (A, B, C): la respuesta sigue siendo texto libre.
- **Sí respeta las herramientas nativas.** Con herramienta, Sonnet emitió `tool_use` en 8 de 8 llamadas, con razonamiento o sin él.
- **La herramienta es la vía de transporte.** Queda por decidir entre D (conserva el razonamiento, criterio preferente) y E (forzada, sin razonamiento). El fallo de D no se pudo inspeccionar porque la primera sonda no guardaba la entrada de la herramienta.

Segunda sonda: se añade la variante F (D con la herramienta en modo `strict`, que impone el esquema) y se registra la entrada de la herramienta, recortada y redactada. Comando: `npm run providers -- probe --rounds=5 --variants=D,E,F` (30 llamadas). Criterios:
1. Se adopta la primera de F y D con ≥ 9/10.
2. Si ninguna llega, se revisa si los fallos son campos vacíos omitidos. Si lo son, se considera rellenarlos como normalización registrada.
3. Si no hay otra salida, se usa E y se declara la diferencia de razonamiento.

## Huella de los ensayos sin el transporte de proveedores — 2026-09-29
El usuario probablemente cambiará el intermediario de Sonnet. Hasta ahora `runner/providers/adapter.mjs` formaba parte de la huella de los ensayos (`runner/pipeline/sources.mjs` y `runner/real/sources.mjs`), así que cualquier ajuste de transporte obligaba a repetir los ensayos de S001–S010, que tardan horas. Los ensayos usan constructores guionados y no ejecutan ese archivo, que solo lo usa el adaptador para interpretar la salida de los modelos. Decisión de Claude con autorización del usuario:
- **Se quita `runner/providers/adapter.mjs` de ambas huellas.** El transporte se verifica con sus pruebas unitarias y con `npm run providers:diagnose`, que ya es requisito antes de generar.
- **`runner/protocol/actions.mjs` sigue dentro**, porque el motor valida las acciones con ese archivo.
- **Regla para el cambio de proveedor:** se hará solo en `runner/providers/*` y `config/models.json`, sin tocar `actions.mjs`.
- **Efecto:** las evidencias sintética y S900 siguen vigentes. Las de S001–S010 hay que repetirlas una vez por el cambio de `actions.mjs` del 2026-09-28, y el cambio de proveedor ya no las invalidará.

## Tareas sin modelos del 2026-09-29
Decisiones de Claude con autorización del usuario. El avance y lo que queda están en `docs/progreso-tareas-sin-modelos.md`.
- **Equidad de los oráculos F002–F010**:
  - Revisión independiente con 3 revisores: de 260 casos, 0 no deducibles y 41 ambiguos. Todos los ambiguos se debían a cómo el oráculo lee la interfaz.
  - Correcciones en el adaptador genérico: texto con límites entre elementos, listas por nombre exacto y espera tras recargar.
  - Correcciones en los planes de F003 (importe tras la etiqueta) y F009 (separador libre tras el ID).
  - Aclaraciones en el texto visible: formato normativo de los ejemplos en `architecture.md`, y ajustes en F004, F007 y F008.
  - Detalle en `docs/revision-equidad-oraculos-2026-09-29.md`. F001 (FROZEN) no usa el adaptador genérico y no cambia.
- **Prefijo de F003**: los productos pasan de `S001–S016` a `A001–A016`. Así no coinciden con las familias semi-reales, y `P` ya lo usa F001. Se actualizaron:
  - el fixture y su hash;
  - los casos y su spec-lock;
  - el plan y la página de calibración.
- **F009**: los 9 mutantes implementados que faltaban por declarar se declararon; todos son detectados. Hay 24 mutantes en total.
- **Ensayo de una familia nueva** (`npm run pipeline:rehearse-family -- F002`, copia desechable): V0→V3 aceptadas con candidatos guionados escritos por Claude, auditoría PASS con 5/5 ejecuciones estables y FROZEN. Los candidatos (`tests/fixtures/rehearsal-family/F002.mjs`) son material de prueba, nunca referencias.
- **Fuerza de los tests ocultos semi-reales** (`npm run real:mutants`):
  - mutación sobre las líneas que añade cada referencia de calibración, evaluada solo con los tests ocultos del turno;
  - puntuación = eliminados / (eliminados + sobrevivientes). Los que no compilan cuentan aparte;
  - los sobrevivientes se revisan a mano, porque pueden ser equivalentes;
  - se probó con la familia de prueba S900 (3/3 eliminados). Las familias reales se ejecutan en el PC del usuario.
  - `runner/real/mutants.mjs` no forma parte de la huella de los ensayos.

## Tests ocultos semi-reales reforzados — 2026-09-29
Decisión de Claude con autorización del usuario. Detalle en `docs/fuerza-tests-ocultos-semi-reales-2026-09-29.md`.
- **Triaje independiente** de los 57 mutantes que sobrevivieron: 37 equivalentes, 5 no especificados y 15 debilidades.
- **Tests reforzados:** se corrigieron 13 debilidades en S002–S006, S008 y S010, añadiendo comprobaciones que solo cubren lo que pide cada petición.
- **Pendiente:** el cableado de `applications-list.tsx` en S010 T002 necesita un test de integración ejecutable en el PC.
- **Petición corregida:** en S008, la ruta de traducciones pasa a `public/locales/en/translation.json`.
- **`real:mutants` ajustado:** usa los tests ocultos T001..T00n y excluye mutaciones de estilo y de tipos.
- **Verificación:** se hace repitiendo `real:mutants` en el PC, que comprueba primero que cada referencia pasa los tests ampliados. No se repiten los ensayos de familia: los tests ocultos no forman parte de su huella y los escenarios de rechazo no dependen de su contenido.

