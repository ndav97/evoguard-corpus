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
