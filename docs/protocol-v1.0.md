# Protocolo v1.0 — materialización trazable
Esta es una transcripción operativa de las decisiones aceptadas en la conversación, **no una copia del Markdown original no recuperable**. Fuente íntegra relevante: reference-conversation.md. La planificación metodológica está cerrada para piloto; parámetros se recalibran con evidencia del piloto, registrando revisiones.

## Diseño
Corpus principalmente propio, sintético, multimodelo. Piloto: 10 familias independientes, un episodio de tres turnos por familia; V0 tiene dos requisitos. React + TypeScript, componentes funcionales, rango orientativo 5–20 componentes relevantes. Diversidad arquitectónica entre familias. Rotación balanceada OpenAI → Anthropic → Google → Local A → Local B: cada proveedor ocupa 8 de 40 artefactos principales. Dos ciclos de cinco familias con rotación por fila.

F001 usa useState centralizado y estados derivados; sin reducers, effects, persistencia, gestor externo, backend, autenticación o servicios externos. No imponer nombres de componentes, funciones, archivos o representación del estado. Fixture común inmutable: 30 productos, IDs P001–P030, campos id/name/category/price, nombres ASCII únicos, precios positivos, categorías Electronics 9, Home 8, Sports 7, Books 6.

## Evolución
- V0: R001 búsqueda por substring, case-insensitive, trim; R002 categoría, conjunción con búsqueda.
- T001 → V1: R003 orden nombre/precio asc/desc, conserva criterio al cambiar filtros.
- T002 → V2: R004 páginas de máximo 10, tras filtros y orden. Cambiar búsqueda o categoría siempre vuelve a primera página; navegación válida incluso con cero resultados.
- T003 → V3: R005 selección única observable, identidad estable al ordenar/paginar; filtros que excluyen al seleccionado limpian selección.
Cada referencia satisface todos los requisitos activos, incluidos los anteriores.

## Agentes y aislamiento
Agente recibe todo el repositorio de **la aplicación** y su historia pasada, solicitud actual, requisitos vigentes y fixture. Puede leer/modificar pruebas de desarrollo y crear otras; mismo modelo implementa y prueba.
No recibe futuros requisitos, turnos, referencias, ramas, etiquetas, casos/código/logs del oráculo ni información predictiva de impacto/riesgo.
Terminal, archivos, búsqueda, npm ci sobre lockfile, TypeScript/build, tests, lint, Playwright/navegador local permitidos. Internet externa prohibida durante ejecución; dependencias preinstaladas/caché offline. No dependencias nuevas sin requisito explícito.
Git de inspección permitido; pipeline crea commits. Lint/format no invalidan por estilo.

## Entregas y reasignación
Máximo 3 entregas por modelo/tarea; 25 ciclos agente↔herramientas por intento. Reparaciones 2/3 continúan el código propio anterior y solo usan feedback de build/typecheck/tests visibles.
Timeout de seguridad API 30 min, local 60 min. Registrar tokens, duración y costo; sin corte monetario inicial.
Si entrega supera validación técnica, evaluador ejecuta oráculo independiente. Fallo de oráculo invalida ese modelo/tarea de inmediato, sin feedback del oráculo ni reparación contra él.
Tras agotar entregas o fallar oráculo, fallback circular desde el siguiente proveedor. Nuevo modelo comienza desde referencia correcta anterior (scaffold para V0), nunca hereda parche fallido.
Fallos se preservan aparte. No correcciones funcionales humanas para rescatar candidatos. Al agotar proveedores, tarea bloqueada y familia DRAFT; no repetir indefinidamente.

## Validez y congelamiento
DRAFT → GENERATED → VALIDATED → AUDITED → FROZEN.
VALIDATED exige build/typecheck, oráculo de todos los requisitos activos, fixture reproducible, ausencia de servicios externos y perfil arquitectónico cumplido.
FROZEN exige V0–V3 validadas, auditoría estructural/humana, cada oráculo estable 5/5 desde entorno limpio, requisitos/solicitudes/fixtures/prompts/modelos/stack congelados, commits/patches/intentos/tests/procedencia completos.
Auditar 100% de las diez familias del piloto. Controlar similitud con procedencia independiente, perfil estructural y análisis sobre código funcional (excluir scaffold/configs/helpers comunes); señal automática lleva a revisión, no decisión automática. Familias demasiado similares se rediseñan o agrupan como una; nunca diferenciarlas cosméticamente.
Error poscongelamiento: nueva revisión, preservar original y excluir revisión defectuosa, sin sobrescribir.

## Etiquetas y evaluación
Impacto: diff de referencias validadas mapeado al grafo previo; creaciones se registran aparte. No inventar etiquetas antes del código.
Riesgo: π0 fijo y ejecuciones separadas; regresión solo si requisito previamente activo/pasaba sigue vigente y falla después. Fallar requisito nuevo no es regresión. Error de infraestructura no implica fallo funcional.
Mantener toda familia y variantes en la misma partición. Frecuencia de regresión es estimación ruidosa; presupuesto y repeticiones definitivas se resuelven tras piloto.

## Alcance de este commit
Se materializa la especificación, fixture, prompts, scaffold y contratos de oracle/runner. No V0, llamadas API, modelos locales, resultados, etiquetas o congelamiento experimental.
Las decisiones de formato y desempates operativos están separadas en operational-decisions.md.
