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
