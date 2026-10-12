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

## Métricas de análisis — 2026-09-29
Decisión de Claude con autorización del usuario. El script es `npm run analysis` (`runner/analysis/analyze.mjs`); solo lee registros públicos, nunca los privados del evaluador. Métricas por modelo, para el conjunto y para cada estrato:
- **Éxito al primer intento:** entre las tareas en las que el modelo era el proveedor inicial del plan de rotación, la proporción aceptada en el primer intento.
- **Asignaciones con éxito:** una asignación es la secuencia de intentos de un modelo en una tarea, el inicial y sus reparaciones, hasta que se acepta o se reasigna. Esta métrica compara modelos aunque entren como segundo o tercer proveedor.
- **Oráculo superado cuando se alcanza:** mide la calidad funcional separada de los fallos de formato o de ciclos.
- **Salidas inválidas por llamada:** con sus códigos de error, y las respuestas normalizadas (bloque o prosa) contadas aparte como indicador de adherencia al formato.
- **Recursos:** mediana de ciclos y de duración por intento, y tokens de entrada, salida y razonamiento sumados desde las llamadas.
- **Incertidumbre:** todas las proporciones llevan intervalo de Wilson al 95 %, porque hay pocas tareas por modelo (8 sintéticas y 6 semi-reales).

## Contexto de los modelos locales en el estrato semi-real — 2026-09-29
**Hallazgo.** Se simuló el primer mensaje de V1 con la política de contexto de los modelos locales (8 192 tokens, 6 656 de entrada), usando copias locales de cuatro repositorios:

| Familia | Archivos del paquete | Árbol | Resultado a 8 192 |
|---|---|---|---|
| S001 | 152 | 5 KB | Cabe, con 244 tokens de margen |
| S002 | 235 | 10 KB | Cabe sin contenidos |
| S003 | 388 | 18 KB | No cabía (`CONTEXT_CORE_TOO_LARGE`) |
| S005 | 635 | 36 KB | No cabía (`CONTEXT_CORE_TOO_LARGE`) |

Los modelos locales no podían ni empezar en los repositorios grandes. Con 32 768 tokens, la vista completa cabe en los cuatro (6 000–17 000 tokens) y queda margen para el historial.

**Decisiones de Claude con autorización del usuario:**
- **Dos niveles más de degradación en la política de contexto** (`runner/context/policy.mjs`), que solo se usan cuando no cabe ni el árbol completo:
  1. «directorio de la zona del cambio y su archivo recortado»;
  2. «solo ese directorio».

  El mensaje indica cuántos archivos se omitieron y que `list_files` permite ver el resto. En todo lo que ya cabía el comportamiento no cambia (calibraciones y ensayos siguen igual).
- **Huella de los ensayos:** `runner/context/policy.mjs` sale de la huella, por el mismo motivo que el transporte de proveedores: los ensayos usan constructores guionados y no construyen contexto gestionado. Lo verifican sus pruebas unitarias y `npm run real:context`.
- **Nueva herramienta `npm run real:context`:** mide, con las imágenes reales y sin modelos, el nivel de vista y el margen de cada familia para varias ventanas. Genera `docs/verification/real-context.json`.
- **Banco de modelos locales:** incluye las tareas semi-reales `S001:V1` y `S005:V1`.
- **Recomendación para el congelamiento de modelos:** fijar los locales con una ventana de 32 768 (o al menos 16 384) si el hardware lo permite. A 8 192 el estrato semi-real queda casi fuera de su alcance, lo que sesgaría la comparación. Requiere recalibrar `config/context.json` para la nueva ventana.

### Medición completa de las diez familias (2026-10-02)
`npm run real:context` en el PC (Windows, imágenes reales, sin modelos). Evidencia: `docs/verification/real-context.json`. Se usa el presupuesto de entrada que queda tras reservar la salida y la plantilla. «Margen» = tokens que quedan para el historial del turno.

| Familia | Archivos | 8 192 (salida 1 024) | 16 384 (salida 4 096) | 32 768 (salida 4 096) |
|---|---|---|---|---|
| S001 | 152 | completa, margen 180 | completa, 5 300 | completa, 21 684 |
| S002 | 235 | solo árbol, 370 | completa, 3 121 | completa, 19 505 |
| S003 | 388 | directorio de la zona, 726 | completa, 382 | completa, 16 766 |
| S004 | 198 | solo árbol, 1 126 | completa, 3 925 | completa, 20 309 |
| S005 | 635 | directorio de la zona, 2 495 | directorio de la zona, 7 615 | completa, 9 905 |
| S006 | 441 | directorio de la zona, 2 539 | solo árbol, 1 888 | completa, 15 988 |
| S007 | 233 | solo árbol, 280 | completa, 3 094 | completa, 19 478 |
| S008 | 659 | directorio de la zona, 3 527 | directorio de la zona, 8 647 | completa, 12 558 |
| S009 | 954 | directorio de la zona, 3 041 | directorio de la zona, 8 161 | completa, 11 290 |
| S010 | 449 | directorio de la zona, 1 297 | directorio de la zona, 6 417 | completa, 14 626 |

Lectura:
- **8 192:** ninguna familia salvo S001 recibe la vista completa, y en S001, S002, S003 y S007 quedan menos de 800 tokens para el historial: un turno con varios ciclos de acciones no cabe.
- **16 384:** 5 de 10 familias siguen recortadas y S003 queda con 382 tokens de margen.
- **32 768:** las diez reciben la vista completa (12 000–18 300 tokens) con 9 900–21 700 tokens de margen.

**Decisión de Claude con autorización del usuario:** la recomendación pasa a ser firme. Los modelos locales se congelan con una ventana de **32 768 tokens y 4 096 de salida**, y se recalibra `config/context.json` para esa ventana. Si el hardware elegido en Vast.ai no lo permite, se documentará como limitación y no se usará 8 192 en el estrato semi-real. `config/models.json` no cambia todavía: se congela junto con la elección de modelos.

**Corrección de la herramienta:** en Windows la primera orden en un contenedor nuevo de un repositorio grande puede superar el límite de 60 s de `docker exec` (falló S006 en la primera corrida). `context-check.mjs` reintenta cada familia una vez, sigue con la siguiente si falla, guarda el informe tras cada familia y conserva los resultados anteriores. En la segunda corrida se midieron las diez.

## Revisión 2 de F001 — mecanismo preparado (2026-09-29)
F001 se generó y congeló con el protocolo de acciones 1.0 y con los problemas de transporte de Synterolink (Sonnet no aceptó ninguna versión). Para que sea comparable con F002–F010 se regenerará como revisión 2. Decisiones de Claude con autorización del usuario:
- **Herramienta:** `npm run corpus:revision -- F001 --reason "…"` (`runner/pipeline/revision.mjs`).
  - Archiva íntegra la revisión congelada en `families/F001-product-catalog/revisions/r1/`: referencias, `family.yaml`, `provenance.yaml`, `turns/`, la auditoría y un `manifest.json` con hashes y el motivo.
  - Mueve los registros de generación a `runs/archive/F001-r1/` y `evaluator/archive/F001-r1/`.
  - Devuelve la familia a DRAFT con la misma especificación, fixture, oráculo y plan de rotación.
  - Nada se borra y la validación del corpus pasa tras abrir la revisión.
- **Cuándo aplicarla:** solo cuando los modelos estén listos. Hasta entonces F001 sigue FROZEN tal cual. El banco de modelos locales lee las referencias archivadas si la familia ya no las tiene.
- **Ensayo:** `npm run pipeline:rehearse-family -- F001 --revision`, en una copia desechable. Abre la revisión y regenera V0→V3 con constructores que aplican los parches archivados: las cuatro versiones se aceptan, la auditoría da PASS 5/5 y la familia vuelve a FROZEN. Evidencia en `docs/verification/family-rehearsal-f001-revision.json`.
- **Análisis:** como los registros de la revisión 1 se mueven a `runs/archive/`, `npm run analysis` mide solo la revisión vigente.


## Corpus solo semi-real y piloto de 20 familias semi-reales — 2026-10-02
**Decisión del tesista:** el corpus de EvoGuard UI ya no usa familias sintéticas puras. Se trabaja solo con el estrato semi-real: repositorios públicos con cambios controlados. El piloto pasa a 20 familias semi-reales. Decisiones de implementación de Claude, con autorización del usuario:

- **Configuración:** `config/strata.json` declara el estrato activo (`semi-real`) y el archivado (`synthetic`). `runner/strata.mjs` la expone.
- **Archivo del estrato sintético:**
  - `families/` y `oracle/` pasan a `archive/sintetico/`, junto con el lanzador `run-f001.*`. Se conservan la historia, las referencias de F001 y la evidencia.
  - El código común (motor, contenedores, protocolo, oráculo E2E) sigue en `runner/`, con las rutas apuntando al archivo.
  - Las calibraciones E2E siguen en `tests/calibration/`.
- **Bloqueos:**
  - el preflight rechaza generar cualquier Fxxx («Estrato sintético archivado»);
  - `corpus:generate` y `corpus:audit` ya no tienen F001 como familia por defecto;
  - `npm run analysis` excluye los registros de Fxxx salvo con `--include-archived`.
- **Banco de modelos locales:** solo tareas semi-reales (`S001:V1`, `S003:V1`, `S005:V1` y `S007:V1`).
- **Evidencia del contenedor sintético:** la de `config/container.json` quedó obsoleta al mover las rutas. Sus pruebas se omiten mientras el estrato esté archivado y se restaura con `npm run environment:verify`. No afecta al estrato semi-real, que usa sus propias imágenes, ni a las huellas de sus ensayos: no cambió ningún archivo de `REAL_PIPELINE_SOURCES`.
- **Familias en borrador:** la validación admite familias semi-reales nuevas en DRAFT (`provenance.status`). `npm run corpus:validate` las lista como pendientes de calibrar, las pruebas solo les permiten ese error y el preflight sigue bloqueándolas.
- **Selección de S011–S020** (`docs/seleccion-piloto-semi-real.md`):
  - **Criterios:** mismas reglas que en el primer lote; ninguna organización repetida.
  - **Bases descartadas:** repo-remover (bun), start-ui-web (tests en navegador), kafka-ui (código generado no versionado) y tasking-manager (`craco test`).
  - **Consecuencias:** runners 13 vitest y 7 jest en total; S020 (formularios clínicos) comparte el área de salud con S004.
- **Redacción sin ejecutar:** las familias se redactaron en la nube sin poder instalar dependencias (registro de npm bloqueado). Por eso los tests ocultos y las referencias no se han ejecutado: la calibración en el PC es la primera ejecución real.
- **Regla añadida:** los textos de interfaz que aparecen en la petición no pueden superar 40 caracteres si también están en el parche o en los tests (`docs/autoria-familias-semi-reales.md`).

## Límite del intento sin la evaluación del pipeline — 2026-10-07
Decisión del tesista a propuesta de Claude.

**Hallazgo.** El ensayo de S014 del 2026-10-06 quedó BLOCKED. En V1, el intento guionado que debía aceptarse (anthropic, reparación) terminó en TIMEOUT tras 2 474 s.
- **Causa:** el límite del intento (`timeout_seconds`: 1 800 s para los modelos comerciales y 3 600 s para los locales) incluía la evaluación del pipeline después de `deliver`.
- **Por qué afecta a S014:** su suite tarda unos 520 s (2 274 tests). Un solo `run_checks` del modelo más los tests visibles y el oráculo del pipeline suman unos 27 minutos.
- **Antecedente:** el 2026-10-04 el ensayo pasó, pero muy cerca del límite.
- **Consecuencia en la generación:** casi cualquier modelo que ejecutara `run_checks` en S014 acabaría en TIMEOUT por la duración de la suite del repositorio, no por su propio trabajo. Le pasaría al proveedor que la rotación asigne a esa familia, y eso sesgaría la comparación.

**Decisión** (`runner/execution/engine.mjs`):
- **Límite del intento:** solo mide el trabajo del modelo, es decir, sus respuestas y sus acciones, incluidos sus propios `run_checks`.
- **Operaciones del pipeline tras `deliver`:** las etapas de evaluación, el snapshot y el commit de la referencia tienen cada una su propio límite de 30 minutos, fuera del presupuesto del modelo.
- **Una etapa que se cuelga:** por ejemplo, código del modelo que bloquea la suite. Sigue reasignando como TIMEOUT.
- **Política:** sin cambios (`config/policy.json`). Cambia la semántica de `timeout_seconds`, que ahora es el presupuesto del modelo.
- **Registros:** `duration_seconds` del intento sigue incluyendo la evaluación. En el análisis, la duración del trabajo del modelo se calcula con los eventos.

**Pruebas:** `tests/execution.test.mjs` incluye dos casos nuevos. En el primero, la evaluación supera el límite del modelo y el intento se acepta; en el segundo, una etapa colgada termina en TIMEOUT.

**Evidencia afectada:** `engine.mjs` forma parte de la huella de los ensayos, así que hay que repetir el ensayo mínimo (S900) y los de S001–S020.

## Ensayos colgados por Docker y lanzador con vigilante — 2026-10-08
**Hallazgo.** La segunda ronda de ensayos (2026-10-07) pasó S900 y S001–S011. Después falló de forma repetida:
- **S012:** V2 terminó en INFRA_ERROR y la familia tardó unas 18 horas.
- **S013:** V1 terminó en INFRA_ERROR y tardó unas 3 horas.
- **S014:** quedó colgado hasta que el tesista detuvo el script.

**Patrón.** Tras una entrega, la suite visible del pipeline se colgaba dentro del contenedor. S013 tarda unos 60 s y no terminó en 30 minutos. El límite de cada etapa cortó el intento como TIMEOUT. Al abrir el contenedor del siguiente proveedor, `docker` se quedó bloqueado horas, sin respetar su propio límite, hasta que se interrumpió a mano; la tarea terminó entonces en INFRA_ERROR. En la ronda del 2026-10-06, las mismas familias e imágenes pasaron. Por eso es un fallo del motor de Docker Desktop y no del código ni de las familias.

**Decisión.** No se toca el código que forma parte de la huella de los ensayos, para no invalidar los de S001–S011. Cambia solo el lanzador `scripts\real\ensayar-familias.ps1`:
- **Retoma:** se salta los ensayos vigentes, es decir, en PASS con la misma huella del pipeline y la misma imagen. Lo comprueba `runner/real/rehearsal-status.mjs`. Con `-Repetir` se fuerzan todos.
- **Vigilante:** cada familia tiene un límite de `-LimiteMinutos`, 150 por defecto (la más lenta, S014, tarda unos 85). Si lo supera, se termina el proceso con sus hijos, incluido `docker`.
- **Reintento:** si una familia falla, se reinicia Docker Desktop (y WSL) cuando no responde o cuando se superó el límite. Después se eliminan los contenedores de EvoGuard que queden y se reintenta una vez.
- **Comprobación de Docker:** `docker info` se ejecuta también con límite de tiempo.
- **Registro:** la salida de cada ensayo queda en `.artifacts\real\ensayo-<familia>-<fecha>-<intento>.log`. Antes no quedaba en la transcripción.

## Línea base por episodios con las métricas de EvoGenUI-Bench — 2026-10-08
**Decisión del tesista:**
- Obtener una línea base por modelo con las métricas del paper de referencia (Peng et al., 2026): TP, TP@n (episodios exitosos, equivalente a la TEE del plan), CPT y APR, más la TER del plan.
- Repetir la misma medición con EvoGuard UI.
- Usar **los cinco modelos** en la línea base y en la comparación final.
- **Mantener 60 familias** en el corpus definitivo.

Diseño completo en `docs/diseno-linea-base-episodios.md`; configuración en `config/experiment.json`.

**Por qué es una medición aparte.** La generación del corpus reasigna, repara y parte de referencias aceptadas, así que su éxito no sirve como línea base. Un **episodio** es una familia recorrida por un solo modelo, turno a turno, sobre su propia salida y sin rescate. El oráculo mide cada turno sin mostrarse al modelo.

**Implementación** (`runner/episode/`): no cambia ningún archivo de la huella de los ensayos, así que los de S001–S020 siguen vigentes.
- **Motor:** se reutiliza con `singleProvider`. Un evaluador envolvente ejecuta el oráculo y el control de alcance, guarda el resultado real y nunca devuelve FAIL al motor, de modo que este no repara ni reasigna.
- **Workspace:** el parche se calcula respecto de la base del turno, no de HEAD. Si el agente hace su propio commit, el pipeline rehace el suyo sobre la base y la historia se reproduce por hash.
- **Código que impide medir** (sin informe de la suite, suite que agota su tiempo dos veces con Docker sano, parche de más de 12 MiB): cuenta como fallo de todos los requisitos, no como infraestructura.
- **Registros:** van a `runs/episodes/`, con los informes privados en `evaluator/episodes/`. Cada registro guarda la huella del código y de los modelos.
- **Análisis:** `npm run episode:analyze` genera la tabla por modelo al estilo de la tabla 2 del paper y la comparación emparejada por familia, con bootstrap de familias.
- **Lanzadores:** `scripts\episode\ensayar-episodios.cmd` y `scripts\episode\linea-base-piloto.cmd`, con vigilante, reanudación y reintento.

**Revisión independiente** del código antes de guardarlo:
- 2 hallazgos altos, ya corregidos: la suite colgada por el código del agente se contaba como infraestructura, y si el agente movía HEAD el parche quedaba incompleto.
- 6 medios y 6 bajos, corregidos o documentados.
- 30 pruebas unitarias. El ensayo con Docker (`episode:rehearse`) cubre cuatro escenarios con resultado conocido.

**Pendientes y riesgos:**
- **Brazos I, G y E:** necesitan EvoGuard UI.
- **Segundo episodio por familia** en la fase final: falta definirlo.
- **Duración:**
  - piloto (600 turnos): unos 2–4 días continuos;
  - fase final con B y E (6 000 turnos): unas 3–6 semanas sin paralelismo.
  Se decidirá con los tiempos reales del piloto (paralelismo, repeticiones).

## S014: test inestable ajeno al cambio — 2026-10-08
En el ensayo de S014 del 2026-10-08, el guion aplicó en V2 el parche de referencia correcto y la suite visible falló una vez. Pasó al repetirla.
- **Test afectado:** `src/components/simulator/Simulator.test.tsx › Receive an interactive message and send the response with correct uuid`.
- **Por qué es inestable:** usa un uuid aleatorio y no depende de la zona del cambio (`Timer`).
- **Decisión:** se añade a `known_failures`, con el mismo criterio que S015.
- **Efecto:** sin este ajuste, en la línea base por episodios un turno correcto podría contar como fallo por azar.
- **Ensayo:** no hace falta repetirlo por este cambio. La vigencia del ensayo depende del código y de la imagen, y el turno afectado ya se había aceptado tras la reparación.

## Costo mínimo con un límite de S/ 5 000 — 2026-10-08
El tesista dispone como máximo de **S/ 5 000**, unos 1 453 USD a 3,4413 PEN por USD. El plan con cinco modelos, 2 episodios × 3 repeticiones y generación del corpus con modelos costaba unos 5 000 USD. Ajustes:

**Decisiones del tesista:**
1. **Referencias del corpus = parches de referencia calibrados**, sin generación con modelos (`corpus:generate` deja de formar parte del plan). Las etiquetas de impacto salen de esos parches, y el código escrito por modelos se estudia en los episodios. Es un cambio metodológico que se declara en la tesis.
2. **Etiquetas de riesgo (π0) con un modelo local**: nueva fase `pi0` de `config/experiment.json`, 40 familias × 5 turnos × 2 repeticiones, solo GPU.
3. **Fase final:** 1 episodio por familia, 1 repetición, brazos B y E, cinco modelos (1 000 turnos). I y G se descartan.

**Aplicado por Claude:**
- **Piloto** con 1 repetición (300 turnos).
- **Adaptador de modelos:** registra los tokens cacheados (OpenAI `cached_tokens`, Anthropic lectura y escritura de caché, Gemini `cachedContentTokenCount`). En Anthropic, `input` pasa a ser la entrada total.
- **Presupuesto** (`runner/episode/budget.mjs`, `npm run episode:budget`):
  - costo real de cada turno en `turn.json`;
  - gasto acumulado, incluidos los episodios interrumpidos, las horas de GPU y los gastos externos;
  - **tope**: no se inicia un episodio si el gasto más su proyección pesimista superara el límite menos la reserva del 15 %, es decir, 1 235 USD.
- **Precios:** son de lista y de terceros; hay que sustituirlos por los de Synterolink.
- **Estimación total:** unos 1 065 USD (S/ 3 700) sin caché y unos S/ 2 100 con caché efectiva. Detalle en `docs/diseno-linea-base-episodios.md`, secciones 4 y 5.
- **Calibración:** los 5 primeros episodios de cada modelo comercial del piloto (S001–S005; 45 turnos, unos 50 USD) se ejecutan antes de seguir, para fijar el costo real.

## Tests inestables de los repositorios: exclusiones y repetición del oráculo en episodios — 2026-10-08
Los ensayos del 2026-10-08 fallaron en S014 y S015 por tests inestables de la suite del propio repositorio, ajenos a la zona del cambio, aun con el parche de referencia correcto:
- **S014:** `ChatInterface.test.tsx › … date range filter` (depende de la fecha). Se suma al `Simulator.test.tsx` excluido antes ese mismo día.
- **S015:** `auth.test.ts › … expiration is one millisecond in future` (margen de 1 ms).

**Decisiones:**
1. **Exclusiones:** estos tests pasan a `known_failures`, con el mismo criterio que S015 (2026-10-04).
2. **Repetición del oráculo en episodios** (`runner/episode/run.mjs`, `measureOracle`):
   - se aplica cuando en un turno pasan todos los tests ocultos y solo falla la suite del repositorio;
   - el oráculo se repite una vez, y la suite cuenta como rota solo si vuelve a fallar;
   - se registra en `oracle.suite_retry` de `turn.json`;
   - así un test inestable no convierte en fallo un turno correcto de la línea base.
3. **Ensayos:** los de S014 y S015 se repiten. El lanzador los retoma solos.

## S014: tests dependientes de la hora del día — 2026-10-08 (noche)
La repetición del ensayo de S014 falló dos veces en V1, aun con el parche de referencia correcto. Los tests responsables son 6 de `src/containers/Trigger/Trigger.test.tsx` (creación de disparadores diarios, semanales, mensuales y por hora, y validación de fechas).
- **Comportamiento:** pasaron en todas las ejecuciones hasta las ~13:00 de Lima y fallaron en las de las 17:48 y las 19:26. Dependen de la hora del día, no del azar.
- **Decisión:** como son ajenos a la zona del cambio (`Timer`), pasan a `known_failures`, con el mismo criterio que los demás inestables de S014.
- **Riesgo que queda:** S014 acumula 8 tests excluidos y una suite de unos 9 minutos. Si vuelve a fallar por otro test dependiente del tiempo, conviene valorar sustituir la familia.

## Transporte de Claude Sonnet 5: herramienta nativa estricta y caché de prompts — 2026-10-09
**Segunda sonda** (`npm run providers -- probe --rounds=5 --variants=D,E,F`, `.artifacts/providers/probe-anthropic-2026-10-09T19-53-35-801Z.json`):

| Variante | Válidas | Varias llamadas a la herramienta | Mediana |
|---|---|---|---|
| D: herramienta, razonamiento adaptativo | 10/10 | 2 | 8,6 s |
| E: herramienta forzada | 10/10 | 4 | 6,7 s |
| F: herramienta estricta, razonamiento adaptativo | 10/10 | 4 | 7,1 s |

**Decisión:** se adopta **F**, según el criterio del 2026-09-29: la primera de F y D con ≥ 9/10. Conserva el razonamiento, así que no hay diferencia de configuración que declarar frente a los otros modelos. Cambios en `runner/providers/adapter.mjs`:
- **Petición:** `tools: [runner_action (strict)]`, `tool_choice: auto`, `thinking: adaptive` y `output_config.effort`, sin `format`, que el intermediario ignoraba.
- **Varias acciones en una respuesta:** cuenta la **primera** (protocolo de una acción por respuesta) y se registra `tool_uses`. Sin llamada a la herramienta se mantiene la ruta de texto, con las normalizaciones registradas.
- **Caché de prompts:**
  - la entrada se envía en bloques de texto (cabecera, un bloque por mensaje y cierre) con `cache_control` en el último mensaje;
  - la concatenación es **idéntica** a la entrada de los demás modelos;
  - si Synterolink aplica la caché, `turn.json` registrará los tokens leídos de caché, que se cobran al 10 %.
- **Pruebas:** `tests/providers.test.mjs`.
- **Ensayos:** el adaptador no forma parte de la huella, así que siguen vigentes.
- **Siguiente paso:** `npm run providers:diagnose` (≥ 9/10 en los tres comerciales).

## Lote de calibración y dos correcciones de transporte — 2026-10-10
**Diagnóstico de proveedores** (`npm run providers:diagnose`, dos ejecuciones del 2026-10-09):

| Modelo | Acciones válidas |
|---|---|
| GPT-5.6 Sol | 20/20 |
| Claude Sonnet 5 | 19/20 |
| Gemini 3.1 Pro | 18/20 |

Los tres cumplen el umbral de ≥ 9/10.

**Lote de calibración** (5 familias × 3 comerciales, `linea-base-piloto -Proveedores openai,anthropic,google -Familias S001…S005`): 14 de 15 episodios completados. El episodio S005 · google quedó detenido en T003, probablemente porque el PC se suspendió durante la noche. Costo ≈ 31 USD.

Las llamadas revelaron dos problemas que penalizan el formato de la respuesta y no la capacidad de programar, y que afectan de forma desigual a los proveedores.

1. **Salida truncada.**
   - Con `max_output_tokens = 4096` hubo 62 respuestas incompletas de Gemini y 21 de GPT; el razonamiento se descuenta del mismo límite.
   - En S003, Gemini agotó 25 ciclos en dos turnos, con 23 y 24 de ellos perdidos por errores de salida.
   - **Decisión:** `max_output_tokens = 16384` para los tres comerciales (`config/models.json`). Solo se paga lo usado.
2. **Campos vacíos omitidos.**
   - El protocolo exige los seis campos de la acción, incluso vacíos, y el esquema estricto se pide a cada proveedor, pero Synterolink no lo hace cumplir.
   - Hubo 81 rechazos `INVALID_ACTION` de GPT y 14 de Sonnet por omitir campos vacíos.
   - **Decisión:** en el adaptador (`completeActionFields`), si la respuesta es un objeto JSON con `type` y solo claves del protocolo, los campos ausentes se completan con `""` o `[]` antes de validar.
   - Se aplica igual a todos los proveedores y queda registrado en la llamada (`filled_fields`).
   - Una clave desconocida o mal escrita (`action` en lugar de `type`) sigue siendo una acción inválida del modelo.

**Validez y ensayos:**
- Ninguno de los dos cambios toca `REAL_PIPELINE_SOURCES` (`protocol/actions.mjs` queda intacto), así que los ensayos de las 20 familias siguen vigentes.
- **Pruebas:** `tests/providers.test.mjs`, con 20 pruebas.
- Se corrige también `tests/context.test.mjs`: la entrada de Anthropic va en bloques desde el commit 2757b5b.

**Datos:**
- Los resultados del lote del 2026-10-10 se apartan como diagnóstico en `runs/episodes-diagnostico/calibracion-2026-10-10`; no forman parte de la línea base.
- Su costo se anota en `budget.extra_spent_usd`.
- El lote de calibración se repite con las correcciones.

## Lote de calibración repetido, flujo para GPT y regla de invalidación por transporte — 2026-10-10 (noche)
**Lote de calibración con las correcciones:**

| Modelo | Episodios sin fallos | Turnos | Costo |
|---|---|---|---|
| Gemini | 5/5 | 15/15 | 7,5 USD |
| Sonnet | 4/5 | 14/15 | 3,4 USD |
| GPT | 4/5 | 14/15 | 9,5 USD |

El promedio es de ≈ 0,46 USD por turno.
- **Fallo de Sonnet en S001 T003:** es real. Cumplió los requisitos, pero hubo una regresión en la suite y agotó los ciclos.
- **Fallo de GPT en S003 T003 (TIMEOUT):** se debió al transporte. De los 30 minutos del intento, ~21 se perdieron en 7 errores HTTP 524 de Synterolink, que corta las conexiones sin datos durante ~2 minutos, más las esperas de reintento. En el lote hubo 19 errores 524, todos de GPT.

**Decisiones:**
1. **Flujo (SSE) para la API Responses de OpenAI** (`requestSse` en `runner/providers/http.mjs`).
   - Llegan eventos mientras el modelo razona, así que el intermediario no corta la conexión.
   - Se toma la respuesta del evento terminal, idéntica a la respuesta sin flujo.
   - Si el intermediario responde JSON, se interpreta como respuesta normal.
   - Un evento `error` del flujo (`STREAM_ERROR`) es transitorio y se reintenta.
2. **Motivo de cierre** (`finish_reason`) registrado en cada llamada de los tres comerciales.
   - Diagnóstico del 2026-10-11 02:20 UTC: Gemini tuvo 7 de 10 respuestas incompletas, cortas y de motivo desconocido.
   - Con el motivo registrado se podrá distinguir un fallo del modelo de uno del intermediario.
3. **Regla de invalidación por transporte:**
   - Un turno que termina en TIMEOUT, en el que más de la mitad del tiempo del intento se perdió en errores de transporte y esperas de reintento, se invalida.
   - El episodio completo se aparta en `runs/episodes-diagnostico/invalidados-transporte` y se repite.
   - Su costo se anota en `budget.extra_spent_usd`.
   - **Aplicada a:** S003 · openai (3,35 USD).

**Pruebas:** `tests/providers.test.mjs` (23). Sin cambios en `REAL_PIPELINE_SOURCES`.

**Siguiente paso:** `npm run providers:diagnose`; después se repite S003 · openai.

## Gemini: filtros de seguridad y confirmación del flujo de GPT — 2026-10-11
**Diagnóstico** (`npm run providers:diagnose -- google openai`, 02:33 UTC):
- **Gemini:** 8 de 10 respuestas cerradas con `finishReason: SAFETY` sobre código ordinario (falsos positivos de los filtros de contenido).
- **GPT:** 9 de 10 válidas, las 10 en flujo (`streamed: true`). El flujo funciona a través de Synterolink.

**Decisión:**
- Gemini recibe `safetySettings` con umbral `BLOCK_NONE` en las cuatro categorías configurables: acoso, discurso de odio, contenido sexual explícito y contenido peligroso.
- Se registran las categorías activadas (`safety_categories`), para que cualquier bloqueo restante quede visible.
- Un bloqueo no configurable sigue contando como respuesta incompleta.
- **Pruebas:** `tests/providers.test.mjs`.

## Gemini pasa de Synterolink a VNAIPro — 2026-10-11
**Diagnósticos de la noche del 2026-10-10:** con Synterolink, Gemini obtuvo 3/10, 2/10, 1/10 y, con `--max-output=4096`, 2/10.
- Las respuestas empezaban a escribirse y se cortaban con `finishReason: SAFETY`, sin valoraciones de seguridad, sin `finishMessage` y sin `promptFeedback`.
- Desactivar los filtros configurables (`BLOCK_NONE`) no cambió nada, y bajar el límite de salida tampoco.
- El día anterior el mismo pedido obtuvo 10/10.
- **Conclusión:** es un corte del intermediario.

**Decisión:**
- Gemini 3.1 Pro (`gemini-3.1-pro-preview`) se consume por **VNAIPro**, una pasarela New API, en formato nativo de Gemini: `https://apikey.vnaipro.app/v1beta`, `x-goog-api-key`, credencial `VNAIPRO_API_KEY`.
- **Sin cambios:** el modelo, el razonamiento, el límite de salida, `safetySettings` y el protocolo.
- GPT y Sonnet siguen por Synterolink.

**Datos y presupuesto:**
- Los 5 episodios de calibración de Gemini hechos por Synterolink (afectados por 29 respuestas incompletas) se apartan a `runs/episodes-diagnostico/gemini-synterolink` y se repiten por VNAIPro.
- Su costo se anota en `budget.extra_spent_usd`.
- **Precio:** se mantiene la tabla de Google (2 USD/M de entrada y 12 USD/M de salida) hasta confirmar la tarifa de VNAIPro, que en el informe de costos se marca como estimada.

**Pruebas:** `tests/providers.test.mjs` (24).

**Siguiente paso:** `npm run providers:diagnose -- google`, con el criterio de ≥ 9/10.

## Cambio de modelo: Gemini 3.1 Pro → Gemini 3.8 Flash (VNAIPro) — 2026-10-11
- **Disponibilidad:** VNAIPro no ofrece Gemini 3.1 Pro: devuelve `model_not_found` («No available channel… group gemini Ultra (distributor)»). La cuenta solo da acceso a `gemini-3.6-flash`, `gemini-3.7-flash` y `gemini-3.8-flash` (`scripts/providers/vnaipro-check.mjs`).
- **Decisión del tesista:** se usa `gemini-3.8-flash`. Se mantienen el razonamiento `high`, los 16 384 tokens de salida, `safetySettings` y el protocolo.
- **Consecuencia metodológica:**
  - El tercer modelo comercial pasa de la gama Pro a la Flash. La comparación queda entre modelos de distinta gama, y así debe declararse en el plan y en el informe.
  - La línea base y la comparación final usan el mismo modelo, así que la mejora medida con EvoGuard UI no se ve afectada.
- **Control de revendedor:** con VNAIPro, el modelo que responde (`observed_model`) debe empezar por el pedido; si no, la llamada es `MODEL_MISMATCH`.
- **Precio:** la tarifa de VNAIPro aún no está confirmada. Se conserva la tabla de Google Pro (2 USD/M de entrada y 12 USD/M de salida) como cota superior.
- **Pruebas:** `tests/providers.test.mjs`.

## Gemini 3.8 Flash: acción como llamada a función — 2026-10-11
Diagnósticos de `gemini-3.8-flash` por VNAIPro, todos sobre los mismos 10 pedidos:

| Variante | Válidas | Errores |
|---|---|---|
| JSON con esquema | 5/10 | 5 `MALFORMED_FUNCTION_CALL` |
| JSON sin esquema | 3/10 | 7 `MALFORMED_FUNCTION_CALL` |
| Función `runner_action` en modo ANY (`--gemini-tool`) | **9/10** | 1 `MALFORMED_FUNCTION_CALL` |

- **Variantes de VNAIPro:** la pasarela reparte las llamadas entre `gemini-3.8-flash`, `-tiered` y `-n`. Con la función, las tres responden bien.
- **Diagnóstico:** el modelo intentaba responder con una llamada a función desde el primer token (18–24 tokens) aunque no tuviera ninguna declarada.

**Decisión:**
- `gemini_tool: true` en `config/models.json`. La acción se pide como la función `runner_action` (`parametersJsonSchema` = esquema del protocolo; `toolConfig` en modo ANY) y se toma de los argumentos de la primera llamada (`tool_uses`), igual que la herramienta nativa de Sonnet.
- Se mantienen el protocolo, el validador, el razonamiento y el límite de salida.
- Ninguno de estos cambios toca `REAL_PIPELINE_SOURCES`, así que los ensayos siguen vigentes.
- **Pruebas:** `tests/providers.test.mjs`.

**Siguiente paso:** repetir los 5 episodios de calibración de Gemini y S003 · openai.

## Tercer modelo comercial descartado; modelos abiertos para una RTX 3090 — 2026-10-11
**Gemini 3.8 Flash por VNAIPro en la calibración:**

| Resultado | Detalle |
|---|---|
| Turnos aprobados | 2 de 12 |
| Episodios sin fallos | 0 de 4 |
| S004 | No terminó en 5 intentos: errores de red, HTTP 524 de la pasarela y reintentos agotados (42 de 159 llamadas fallidas) |
| Comportamiento | En la mayoría de los turnos agotó los 25 ciclos explorando el historial de git y las dependencias, sin editar |
| Costo | 32,59 USD (cota superior con la tarifa de Gemini Pro) |

- **Decisión del tesista:** no hay un tercer modelo comercial.
- **Datos:** los episodios se apartan en `runs/episodes-diagnostico/gemini-vnaipro` y su costo se anota en `budget.extra_spent_usd`.
- **Credencial:** la clave `VNAIPRO_API_KEY` queda sin uso y debe regenerarse, porque se expuso en una conversación.

**Modelos abiertos dimensionados para la GPU real (RTX 3090, 24 GB):**
- Los locales anteriores (Qwen2.5-Coder 7B y Granite 3.3 8B, con 8 192 tokens de contexto) se eligieron para la GPU del tesista y no corrieron ningún episodio. Se reemplazan por tres modelos de familias distintas:

| Ranura | Modelo | Fabricante |
|---|---|---|
| `google` | Gemma 4 26B (`gemma4:26b`), MoE | Google |
| `local_a` | Qwen3-Coder 30B (`qwen3-coder:30b`), MoE | Alibaba |
| `local_b` | Devstral 24B (`devstral:24b`) | Mistral |

- **Contexto gestionado de 32 768 tokens** (`config/context.json`, `PROVISIONAL` hasta el banco), con 4 096 de salida, temperatura 0 y semilla 42.
- **Huellas (`digest`):** quedan pendientes del banco (`digest_status: PENDING_BENCH`); con la huella de ceros, la inferencia falla con `MODEL_DIGEST_MISMATCH`.
- **Respaldos del banco:** `gemma4:31b`, `codestral:22b`, `gpt-oss:20b` y `deepseek-coder-v2:16b` (`config/local-bench.json`).
- **Regla de selección:** ≥ 9/10 acciones válidas, rendimiento en las tareas del banco y tiempo por turno dentro del límite.

**Por qué Gemma ocupa la ranura `google`:** las cinco ranuras del anillo (`openai`, `anthropic`, `google`, `local_a`, `local_b`) forman parte del motor y de la huella de los ensayos. Agregar una sexta obligaría a repetir los ensayos de las 20 familias. Gemma es un modelo de Google, así que la etiqueta sigue siendo fiel.
- **Cambios en el transporte:** la ranura `google` admite ahora el transporte `ollama` (`adapter.mjs`, `connection.mjs`), y el presupuesto la cuenta como local (`budget.mjs`).
- **Diferencia que queda:** el motor asigna 1 800 s de trabajo del modelo por intento a la ranura `google` y 3 600 s a las `local_*`. Gemma 4 26B es MoE con ≈ 4B parámetros activos y es el más rápido de los tres; el banco debe confirmar que sus turnos quedan claramente por debajo de 1 800 s. Si no, se repetirán los ensayos con el límite por transporte.

**Ensayos:**
- Los de las familias siguen vigentes, porque no cambia `REAL_PIPELINE_SOURCES`.
- El del ejecutor de episodios debe repetirse, porque cambian `run.mjs` y `budget.mjs`: `scripts\episode\ensayar-episodios.cmd`.

**Pruebas:** proveedores, contexto, banco y episodios en verde. La única excepción es la prueba del registro del banco, que falla en la VM de trabajo por no poder borrar, igual que antes.

## Banco local sin el manifiesto del contenedor sintético — 2026-10-11
- **Problema:** `npm run bench:selftest` falló con «Verificación obsoleta: cambiaron controles o payload». El manifiesto `config/container.json` es del contenedor del estrato sintético (F001), que quedó obsoleto al archivar ese estrato (las rutas pasaron a `archive/sintetico/…`).
- **Alcance:** el banco exigía ese manifiesto aunque solo corriera tareas semi-reales (`Sxxx:V1`), que usan la imagen de su propia familia.
- **Decisión:** `runner/bench/local.mjs` lee el manifiesto solo si hay tareas sintéticas (V0–V3).
- **Autoprueba:** `bench:selftest` sigue dependiendo del estrato sintético y queda fuera de uso; el banco real no la necesita.

## 2026-10-12 — Entorno de GPU fijado entre instancias de Vast.ai

Las instancias de Vast.ai se destruyen y se rentan de nuevo entre sesiones. Para que cambiar de instancia no cambie
las condiciones del experimento:

- **Versión de Ollama fijada en 0.40.3** (`ollama_version` en cada modelo local de `config/models.json`, la misma
  usada en el banco del 2026-10-11). `prepare.ps1` la pasa a `setup-instance.sh`, que reinstala Ollama si la versión
  es otra y aborta si el servidor no queda en la versión fijada.
- **El adaptador verifica la versión** (`/api/version`) antes de generar: con otra versión la llamada falla con
  `OLLAMA_VERSION_MISMATCH` sin enviar el turno al modelo. La versión observada queda en cada llamada (`runtime`).
- **Ficha de entorno por sesión**: `prepare.ps1` guarda en `docs/verification/gpu-sessions/` la GPU, memoria,
  driver, versión de CUDA, versión de Ollama y digests de los modelos de la instancia.
- **Regla operativa**: siempre RTX 3090 de 24 GB; no se cambia de instancia a mitad de un episodio y, cuando sea
  posible, cada fase (piloto, brazo B, brazo E) corre en una misma instancia. Diferencias numéricas menores entre
  GPU/driver con temperatura 0 son posibles y se declaran como amenaza a la validez; los pesos son idénticos (digest).

## 2026-10-12 — Banco local del 2026-10-11: fallos de formato, no de capacidad

Resultado del banco (4 tareas semi-reales, `docs/verification/local-bench/2026-10-11-ddfe54d3.json`): 0/4 para los
tres modelos. La revisión de `calls.jsonl` muestra que la mayoría de los ciclos se perdieron por la salida, no por
el código:

- **Gemma 4 26B**: piensa por defecto en Ollama; gastaba la reserva de 4096 tokens de salida pensando
  (INCOMPLETE_RESPONSE en 47 de 100 llamadas) y enviaba `run_checks` con `argv`.
- **Qwen3-Coder 30B**: devolvía `read_file` con el contenido del archivo copiado en `content`, o `edit_file` con el
  archivo completo y sin `find`; con temperatura 0 repetía la misma salida inválida hasta agotar los 25 ciclos.
- **Devstral 24B**: sí trabajó (ediciones y checks); falló por regresiones reales y por un HTTP 500 de Ollama en S005.

Cambios en el adaptador (no tocan protocolo, motor ni las huellas de los ensayos):

- `reasoning: null` se respeta en Ollama: a los modelos con capacidad `thinking` (`/api/show`) se les envía
  `think: false` y la llamada registra `think`.
- Los campos que el tipo de acción no usa y llegan con valor se vacían (`cleared_fields`), igual para todos los
  proveedores. No se corrige nada que cambie la intención: `edit_file` sin `find` sigue siendo inválido.
- Las respuestas truncadas registran `finish_reason` y una muestra (`rejected_output`); los errores HTTP guardan el
  cuerpo (`error_detail`).

Siguiente paso: repetir el banco completo en una instancia nueva antes de decidir reemplazos.

## 2026-10-12 — Segundo banco local (Ollama 0.40.3, con los cambios del adaptador)

`docs/verification/local-bench/2026-10-12-806ce7a2.json`. Acciones válidas por llamada (sin errores de red):

| Modelo | Aceptadas | Llamadas válidas | Observación |
|---|---|---|---|
| Gemma 4 26B | 1/4 (S005, oráculo PASS) | 99/100 | `think:false` resolvió el truncado; 64–155 s por tarea |
| Devstral 24B | 0/4 | 109/113 | trabaja y entrega; S005 cae siempre por «token repeat limit» |
| Qwen3-Coder 30B | 0/4 | 72/100 | usa `edit_file` con el archivo completo en `content`; se trunca a 4096 tokens |

El HTTP 500 de Devstral era `prediction aborted, token repeat limit reached`: salida degenerada del modelo. Desde
ahora el adaptador lo registra como INCOMPLETE_RESPONSE (`finish_reason: repeat_limit`): el motor avisa al modelo y
continúa, en vez de reintentar la misma entrada y terminar en INFRA_ERROR.

**Decisión del autor (2026-10-12): se mantiene Qwen3-Coder 30B** pese a no cumplir el umbral de ≥ 9/10 acciones
válidas (72/100). Sus fallos son del propio modelo (confunde `edit_file` con `write_file` y se trunca al reescribir
archivos completos); se conserva la familia Alibaba en el anillo y se declara como excepción a la regla de selección.
Los digests de los tres modelos locales se fijan en `config/models.json` con los observados en la instancia del
2026-10-12 (iguales a los del banco del 2026-10-11).
