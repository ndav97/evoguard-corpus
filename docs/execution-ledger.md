# Registro de ejecución — plan: docs/superpowers/plans/2026-09-22-f001.md

## Restauración del evaluador R001 — 2026-09-24

Se reprodujo `Illegal return statement` al importar evaluate.mjs. Se restauraron el cálculo de veredicto y runCase, con entrada de adaptador para pruebas unitarias y URL local para calibración UI. La gramática de expectativas soportada es explícita y rechaza expectativas desconocidas. A05 conserva la observación anterior al cambio de categoría. Se completaron los productos Home en la página correcta y la opción Sports en la página incorrecta, sin modificar requisitos ni fixture del corpus. Se reparó la entrada auxiliar de pruebas para reutilizar la suite canónica.

Verificación: 10/10 pruebas focalizadas; npm run check aprueba 85/85 pruebas, validación de especificación y build. La entrada auxiliar aprueba sus tres pruebas, que no se suman al total. R001-A01–A05 aceptan la página correcta y rechazan la incorrecta. Pendientes R002–R005 y la integración experimental; no hubo generación V0, llamadas a proveedores ni cambios del preflight.

## Decisiones aplicadas
- Ejecutar en la carpeta nueva evoguard-corpus, fuera de sources/, y realizar un único commit inicial, conforme al pedido del usuario. No se necesitó aislar cambios preexistentes.
- Usar decisiones de la conversación como fuente documental ante ausencia del Markdown original. La limitación queda explícita para una futura comparación si aparece el archivo.
- Fijar dependencias locales después de inventariar el equipo y consultar el registro. No congelar runtime experimental ni escoger modelos.
- Materializar escenarios/contratos del oráculo y runner preparatorio; impedir generación real hasta implementar aislamiento, proveedores y E2E. Evita presentar infraestructura incompleta como experimento listo.

## Interfaces comprobadas
Schemas → manifiestos: Ajv estricto más integridad cruzada.
Requisitos → turnos/packets: cada versión recibe catálogo vigente acumulativo y parámetros duraderos.
Fixture → procedencia/oráculo: hash idéntico y escenarios comprobados contra productos concretos.
Stack → scaffold: versiones exactas concuerdan con package.json y lockfiles.

## Trabajo completado
- Datos/esquemas creados y validados; fixture 30 productos.
- Pruebas del runner escritas y ejecutadas antes de implementación (fallo inicial por módulos aún inexistentes); posterior suite verde.
- Scaffold compilado, sin lógica funcional.
- 33 casos declarativos externos y contrato de adapter, sin resultados inventados.
- Revisión independiente y correcciones documentadas en verification.md; prueba de parámetros persistentes y prueba de hashes observaron fallo antes de corrección y éxito posterior.
- Autor Git configurado solo en este repositorio, usando la identidad entregada por el usuario.

No pendientes menores diferidos de la revisión. Pendientes de la siguiente etapa: entorno Linux reproducible, selección posterior de modelos, runner experimental y oráculo E2E; no forman parte de esta creación estructural.

## Continuación autorizada — 2026-09-23
Se completó el entorno Linux y aislamiento, según `docs/superpowers/plans/2026-09-22-container-isolation.md`. La base oficial se fijó por digest, se guardó la imagen final y se verificó su carga. Dos contenedores limpios pasaron build offline, navegador y controles de aislamiento. Se probaron timeout/exceso de salida y ciclo CLI, con limpieza de contenedores.

44 pruebas del repositorio pasan. La especificación permanece DRAFT; no se genera V0 ni se seleccionan modelos locales. Pendiente para la siguiente fase: runner/proveedores, modelos exactos, oráculo E2E/adapter y exportador auditado de referencias para evolución. El preflight sigue impidiendo generación.

## Runner y simulación — 2026-09-23
Se implementó el motor por pasos con herramientas, 3 intentos, 25 ciclos, timeout por intento, reparación conservando workspace y reasignación limpia por anillo. Solo se expone modo simulation. Se conservaron resultados y parches instrumentales fuera de los runs experimentales.

TDD: pruebas nuevas fallaron por comportamiento ausente, luego pasaron; la revisión añadió regresión para aceptación durante timeout de snapshot. Las dos correcciones de tiempos límite se comprobaron con pruebas y nuevo ensayo Docker. Suite final: 58 PASS. Ensayo final: cuatro escenarios, 24 intentos, 13 contenedores cerrados. Plan y evidencia enlazados desde verification.md.

Pendiente: adaptadores de modelos reales y métricas, oráculo E2E/adapter, persistencia/exportación de referencias funcionales, selección exacta de modelos y habilitación explícita de generación. F001 sigue DRAFT; no se generó V0.

## Continuación de evoguard chat — pool y adaptadores
Se registró el pool elegido en config/models.json y se implementaron Responses, Messages, Gemini generateContent y Ollama chat. El dispatcher implementa la interfaz next del motor; el único CLI nuevo hace inspección o conectividad instrumental, nunca generación. Registro de parámetros/modelo observado/tokens/duración con costo desconocido null y errores sanitizados.

Pruebas primero y posterior implementación: 13 pruebas nuevas de adaptadores/transporte; suite total 71 PASS. Revisión corrigió preservación de métricas en respuestas fallidas. Dos modelos locales respondieron realmente y quedaron registrados sus digests, Q4_K_M y Ollama 0.32.15. Las tres APIs comerciales esperan credenciales; no se buscaron claves en otros proyectos ni se inventó conectividad.

Pendiente para generación: verificación comercial, política definitiva de contexto, integración experimental con trazabilidad de referencias y oráculo E2E. F001 sigue DRAFT. No hubo código funcional de V0, cambios al runtime verificado ni llamadas comerciales.

## Comprobación comercial autorizada después de configurar .env
Se ejecutaron mensajes instrumentales por Synterolink. El primer ensayo detectó salida Markdown de Sonnet, sin fallo de autenticación. Tras añadir el contrato JSON explícito al mensaje común, los tres modelos pasaron el ensayo final. Evidencia y uso observado conservados sin secretos en docs/verification/synterolink-connectivity.json; 75 pruebas y build pasan. .env continúa excluido de Git.

La conectividad comercial deja de estar pendiente. El 2026-09-24 se congelaron únicamente los parámetros de inferencia en `config/models.json` (`INFERENCE_PARAMETERS_FROZEN`), sin cambiar sus valores ni registrar ejecuciones en `provenance.models`. Permanecen política de contexto, oráculo E2E e integración/persistencia de referencias antes de generar V0. `pi0_model`, repeticiones y corte monetario siguen sin fijar, como exige el esquema hasta tener evidencia del piloto.

## Oráculo F001 ejecutable (33 casos) — 2026-09-24
Corrección del registro anterior: la afirmación «npm run check aprueba 85/85» no se reproducía. `tests/oracle-complete.test.mjs` referenciaba `tests/fixtures/catalog-complete.html`, inexistente, y 28 casos R002–R005 fallaban; además 5 pruebas de `sandbox.test.mjs` fallan porque `config/container.json` quedó en `BUILT` con `verification: null` tras reconstruir la imagen (24/09 23:13).

Cambios: planes explícitos por caso vinculados por hash al texto canónico (`runner/oracle/plans.mjs`, `spec-lock.json`); modelo de referencia derivado del fixture (`reference.mjs`); adapter con reinicio por recarga, navegación "intentada", lectura solo de ítems visibles, marcas ARIA y texto visible; evaluación por versión (10/17/25/33 casos); puente `independent_oracle` sin feedback (`bridge.mjs`) y comprobación de estabilidad. Página de calibración completa con `?version=` y 17 mutantes (`?mutant=`). No se modificaron requisitos, casos, fixture, prompts, preflight ni `family.yaml`.

Verificación (Linux, Node 22, Playwright 1.56/Chromium 1194, copia del repositorio): validación F001 correcta; suite 102 pruebas, 97 PASS, 5 FAIL, todas del manifiesto de contenedor pendiente de reverificar. Oráculo: V0–V3 PASS, 17/17 mutantes rechazados por los casos esperados, V0 no evaluada con requisitos futuros, estabilidad V3 5/5, integración con runner simulado (defecto → reasignación sin filtrar detalle; correcto → aceptado). Build del scaffold no ejecutado en esa copia (dependencias no disponibles). Pendiente en el equipo del usuario: `npm run environment:verify` y `npm run check` con Playwright 1.63.

## Contrato de interfaz observable (`ui_contract`) — 2026-09-24
Motivo y decisión en `docs/operational-decisions.md`. Cambios: campo obligatorio `ui_contract` en `schema/requirement.schema.json` y en R001–R005; `runner/packet.mjs` lo serializa por requisito activo; `prompts/common.md`, `generate-v0.md` y `evolve-turn.md` exigen cumplirlo; `ui-adapter.mjs` exporta sus controles; `tests/contract.test.mjs` (4 pruebas) comprueba coincidencia adapter–contrato, valores de opciones, ausencia de contratos futuros en V0 y referencia en prompts. Sin cambios en casos del oráculo, fixture, turnos ni preflight.

Verificación (copia Linux): validación F001 correcta; 106 pruebas, 101 PASS; 5 FAIL del manifiesto de contenedor por «Verificación obsoleta: cambiaron controles o payload», esperado al cambiar prompts, packet, R001 y R002. La imagen no cambia: basta `npm run environment:verify` y después `npm run check`.

## Política de contexto (Paso 4) — 2026-09-24
Implementada según `docs/operational-decisions.md`: `config/context.json`, `runner/context/policy.mjs`, integración en `runner/providers/adapter.mjs` (solo locales; comerciales sin cambios), calibración `runner/context/calibrate.mjs` (`npm run context:calibrate`), bloqueo en preflight hasta `CALIBRATED`. `tests/context.test.mjs` (9 pruebas): alcance exacto, núcleo V0–V3 íntegro, ventana con feedback y último paso, determinismo, ausencia de campos privados, rechazos explícitos, recorte con aviso, contexto completo de los comerciales, traza por llamada y violación de estimación.

Medición provisional (estimador 2,5 × 0,8): núcleo V0 3110, V1 3891, V2 4881 y V3 5722 tokens estimados de 6656. Con ~3,2 B/token (ensayo del script contra un Ollama simulado), V3 ocupa ~4440 y deja ~2200 para historial. Ninguna cifra es medición real de los tokenizadores: falta ejecutar la calibración en el equipo con Ollama.

Verificación (copia Linux con la evidencia de contenedor reverificada por el usuario): 115/115 pruebas, validación F001 correcta; no se modificaron archivos del payload verificado.

## Calibración de contexto — 2026-09-24
Ejecutada por el usuario con Ollama 0.32.15 (`npm run context:calibrate -- --write`): 8 muestras por modelo, prompt_eval_count real con la misma instrucción, esquema y entrada que el adaptador. Proporción mínima: qwen2.5-coder:7b 3,64 B/token; granite3.3:8b 3,31 B/token (muestra JSON del fixture). Se fija `bytes_per_token` 3,31 con factor de seguridad 0,8; `config/context.json` pasa a CALIBRATED y la evidencia queda en `docs/verification/context-calibration.json`.

Tokens reales del núcleo (Granite, el más exigente): V0 1622, V1 2065, V2 2620, V3 3101. Con la estimación conservadora el núcleo ocupa V0 2288, V1 2878, V2 3626 y V3 4261 de 6656, y deja 4368, 3778, 3030 y 2395 tokens estimados para historial. El preflight ya no bloquea por contexto. Pruebas sin navegador en el equipo: 97/97.

## Pipeline real (Paso 5) — 2026-09-24
Implementado: `runner/pipeline/` (workspaces, evaluador, arquitectura, persistencia, ensayo), `runner/oracle/container.mjs` y `remote.mjs`, `runner/sandbox/lineage.mjs` y `seed-init.mjs`, rol `oracle-evaluator` en el sandbox y modos `rehearsal`/`experimental` en el motor. La política de contexto ahora comprime el feedback antes de perder el último paso.

Verificación en el entorno Linux de Claude con la **misma imagen** del usuario (archivo `evoguard-runtime.tar`, SHA-256 `cd5e83df…` idéntico, ID `sha256:3ed948d6…`): `environment:verify` PASS; ensayo integral `43769398-211a-4adb-9c26-2d7a65536e8a` PASS en ~27 s (openai a1 typecheck FAIL→reparación; a2 oráculo FAIL→reasignación; anthropic arquitectura FAIL→reasignación; google 5/5 PASS→aceptado con commit; V1 reconstruido desde esa V0 instrumental con hashes reproducibles y sin información futura ni de procedencia). Suite 125 pruebas. La evidencia `docs/verification/container.json` se regeneró allí porque cambiaron archivos verificados (`docker.mjs`, `policy.mjs`, `seed-init.mjs`, `lineage.mjs`, `prompts/common.md`).

## Preflight y herramientas de generación y auditoría (Pasos 6–8) — 2026-09-24
Implementado: preflight comprobable, ciclo de vida en esquemas y validador, `runner/pipeline/generate.mjs` (`corpus:generate`), `runner/pipeline/audit.mjs` (`corpus:audit`), `runner/pipeline/sources.mjs` (huella del código ensayado), manejo de salidas inválidas del modelo y de errores transitorios.

Ensayo completo en copia desechable del repositorio (entorno Linux de Claude, misma imagen), con constructores guionados en lugar de modelos: V0 (openai) → V1 (anthropic) → V2 (google) → V3 (local_a) aceptadas con un commit por versión y manifiestos coherentes (VALIDATED); auditoría PASS con oráculo 5/5 estable en V0 (10/10), V1 (17/17), V2 (25/25) y V3 (33/33) en ~2 min; congelamiento FROZEN y preflight bloqueando una regeneración. Esa copia se descartó: ninguna referencia instrumental entró en el corpus. Suite: 126 pruebas.

Pendiente del corpus real: ejecutar `npm run corpus:generate -- all` en el equipo del usuario (único entorno con Docker, credenciales de Synterolink y Ollama).

## Resultados de la ejecución real de F001 — 2026-09-24/25
Ejecución con `scripts\run-f001.cmd` en el equipo del usuario (23:27 → 00:27, ~1 h). Verificación nativa del contenedor y ensayo integral PASS; generación V0–V3 con modelos reales; auditoría PASS sin hallazgos; F001 **FROZEN** (commits `edbc5cf`, `1deff26`, `efc6cde`, `6f5859e`, `892950c`).

| Versión | Aceptada por | Intentos previos (motivo) | Ciclos / duración del aceptado | Oráculo en auditoría |
|---|---|---|---|---|
| V0 | google (Gemini 3.1 Pro) | openai: FAIL del oráculo; anthropic: límite de 25 ciclos | 20 / 332 s | 10/10 ×5 |
| V1 | google | anthropic: límite de 25 ciclos | 21 / 214 s | 17/17 ×5 |
| V2 | google | — | 16 / 282 s | 25/25 ×5 |
| V3 | openai (GPT-5.6 Sol) | local_a: `technical_failure`; local_b: FAIL del oráculo | 8 / 444 s | 33/33 ×5 |

Tres de cuatro referencias las produjo Gemini (V1 estaba asignada a anthropic y V3 a local_a; la reasignación del protocolo funcionó como estaba previsto). Historia reproducible, arquitectura PASS y sin fugas en las cuatro versiones.

### Hallazgo que debe resolverse antes de F002–F010
- **Salidas `INVALID_ACTION_JSON` masivas en los comerciales vía Synterolink**: anthropic 18/25 llamadas en V0 y 20/25 en V1; google 15/20, 17/21 y 12/16; openai ninguna. Anthropic no llegó a entregar en ninguna versión por agotar los ciclos con respuestas no parseables. Es muy probable que sea un problema de formato de transporte (texto alrededor del JSON, bloques de código o mezcla con razonamiento), no de capacidad, y **sesga la comparación entre modelos**. El adaptador no guarda el texto crudo rechazado, así que la causa no puede confirmarse con los registros actuales. Acción recomendada: guardar el texto rechazado (acotado y sin secretos) en `calls.jsonl`, reproducir con el smoke de proveedores y corregir el parser o el contrato de salida estructurada por proveedor **antes** de generar las otras familias. F001 queda congelada tal cual; si se decide regenerarla, abrir una nueva revisión.
- Locales: 23–25 ciclos con menos de 800 tokens de salida en total; no produjeron un candidato válido. No hubo errores de contexto (`CONTEXT_LIMIT`). Con 1024 tokens de salida por acción su rendimiento es muy limitado.
- Tokens de openai en `null` en los registros por intento porque una llamada terminó en HTTP 524 (transitorio, reintentado): la suma exige que todas las llamadas reporten uso. Los totales observables están en `calls.jsonl` (V0: 60,5k entrada / 28,1k salida).
- Métrica de auditoría: los candidatos concentran la UI en 1 componente detectado (guía 5–20). No es un rechazo, pero se anota para el perfil estructural del corpus.
