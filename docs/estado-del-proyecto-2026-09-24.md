# EvoGuard Corpus — Estado, pendientes y plan de continuación

> **Actualización verificada del 24/09/2026 (noche) — oráculo F001 completo a nivel instrumental.** Una nota anterior afirmaba «85 pruebas aprobadas»; no se reproducía: faltaba `tests/fixtures/catalog-complete.html` (28 casos R002–R005 fallaban) y 5 pruebas del sandbox fallan porque la imagen Docker se reconstruyó y quedó `BUILT` sin reverificar. Estado actual: los **33 casos** tienen plan ejecutable vinculado por hash a la especificación; la página de calibración correcta pasa V0 (10), V1 (17), V2 (25) y V3 (33); 17 mutantes deliberados son rechazados; estabilidad 5/5; puente `independent_oracle` integrado con el runner simulado sin filtrar diagnóstico. Suite: **102 pruebas, 97 PASS, 5 FAIL** (solo manifiesto de contenedor). Pendiente para cerrar la fase en el equipo: `npm run environment:verify` y `npm run check`. Fuera de esta fase: transporte al candidato aislado, decisión sobre el contrato de UI, política de contexto, persistencia, preflight y V0. Las secciones siguientes conservan el diagnóstico previo.

> **Contrato de interfaz (24/09/2026, más tarde).** Por decisión del usuario, cada requisito incluye un `ui_contract` (roles, nombres accesibles, valores de opciones y estado inicial) que el constructor recibe por requisito activo y que usa el adaptador del oráculo. V0 solo recibe el contrato de R001–R002. Cambiaron el esquema de requisitos, los prompts y el packet, así que la evidencia del contenedor debe reverificarse (`npm run environment:verify`; la imagen no cambia). Suite en copia Linux: 106 pruebas, 101 PASS, 5 FAIL solo por esa reverificación pendiente. Detalle en `docs/operational-decisions.md`.

> **Paso 4 — política de contexto (24/09/2026, noche).** Los comerciales conservan su contexto normal. Los locales (8192) reciben un contexto gestionado: núcleo obligatorio con requisitos y `ui_contract`, historial en ventana con recortes explícitos, rechazo antes que truncado silencioso y control posterior con los tokens reales. Implementado, probado (115/115) y **calibrado** con Ollama: 3,31 B/token (Granite, peor caso) × 0,8. En V3 quedan ~2400 tokens estimados para historial (el núcleo real mide 3101 tokens). El preflight ya no bloquea por contexto. Detalle y riesgos residuales en `docs/operational-decisions.md`.

> **Pasos 5–8 (24/09/2026, noche).** Implementados y ensayados de punta a punta en el entorno Linux de Claude con la misma imagen del usuario: pipeline real (evaluación en sandbox, oráculo en contenedor aislado, arquitectura, persistencia, historia evolutiva auditada), preflight comprobable (despejado), `corpus:generate` y `corpus:audit`. Ensayo completo con constructores guionados en copia desechable: V0→V3 aceptadas, auditoría PASS (5/5 por versión) y FROZEN. **Falta solo la ejecución real con modelos**, posible únicamente en el equipo del usuario (Docker, claves de Synterolink y Ollama): doble clic en `scripts\run-f001.cmd`. Hace verificación nativa, ensayo, generación V0–V3, auditoría y congelamiento, con commits por etapa y log en `.artifacts\run-f001-*.log`. Después: `docs/paso-9-preparacion-familias.md`.

> **F001 COMPLETA — 25/09/2026 00:27.** Ejecución real: V0, V1 y V2 aceptadas por Gemini, V3 por GPT-5.6 (tras reasignaciones del protocolo). Auditoría PASS con oráculo estable 5/5 en las cuatro versiones y familia **FROZEN**. Hallazgo prioritario antes de F002–F010: Sonnet y Gemini devolvieron JSON no parseable en el 60–80 % de sus llamadas vía Synterolink (Sonnet no completó ninguna versión), lo que sesga la comparación entre modelos. Hay que diagnosticarlo y corregirlo en el adaptador. Detalle en `docs/execution-ledger.md`; siguiente paso en `docs/paso-9-preparacion-familias.md`.

Fecha de corte: **24 de septiembre de 2026**. Último commit observado: `759ba0d`. Este informe incluye también cambios locales sin commit; por tanto, el estado descrito no se reproduce únicamente recuperando ese commit.

## 1. Estado general

El proyecto tiene especificación ejecutable de F001, infraestructura Docker verificada, motor de ejecución simulado, adaptadores de los cinco modelos y evidencia de conectividad. La implementación del oráculo UI está en curso. **No se ha generado V0 y la generación experimental permanece bloqueada.**

La planificación metodológica general está definida, pero todavía faltan componentes operativos necesarios para producir y validar referencias del corpus. La existencia de pruebas instrumentales o páginas HTML de prueba no equivale a tener una aplicación F001 generada por los modelos.

| Área | Estado al corte | Interpretación |
|---|---|---|
| Repositorio y Git | Implementado | Historial metodológico y técnico disponible. Hay cambios locales posteriores al último commit. |
| Especificación F001 | Materializada | Requisitos, turnos, manifiestos, fixture y casos declarativos disponibles. |
| Scaffold | Implementado | Base técnica compilable, sin implementación experimental de F001. |
| Docker y aislamiento | Reverificación pendiente | Evidencia histórica válida, pero la imagen actual (reconstruida 24/09 23:13) está `BUILT` sin verificación vigente. |
| Runner | Simulación implementada | Ejercita intentos y reasignaciones; todavía no constituye la cadena experimental completa. |
| Cinco modelos | Seleccionados y conectividad comprobada | Tres comerciales mediante Synterolink y dos locales mediante Ollama. |
| Parámetros de inferencia | Congelados en configuración | `INFERENCE_PARAMETERS_FROZEN`, con alcance limitado a inferencia. |
| Política de contexto | Implementada y calibrada | Solo locales; comerciales con contexto completo. 3,31 B/token × 0,8. |
| Adaptador UI | Parcial, con dos pruebas que pasan | Interactúa con controles y lee resultados del DOM. |
| Evaluador del oráculo | Restaurado y ampliado | 33 casos ejecutables, evaluación por versión y puente al runner. |
| Oráculo E2E completo | Calibrado con páginas de prueba | 33 casos verificados en navegador, 17 mutantes rechazados, 5/5 estable; falta ejecutarlo contra un candidato aislado. |
| Referencias V0–V3 | No generadas | No hay resultados experimentales que puedan declararse válidos o congelados. |
| Evaluación π0 | Pendiente | Separada de la construcción del corpus. |

## 2. Contraste con el estado comunicado

El resumen recibido indicaba que A01–A03 pasaban, A04–A05 fallaban y R002–R005 seguían pendientes. Ese resumen puede describir una revisión anterior, pero **no coincide por completo con los archivos actuales**.

Se ejecutó esta comprobación focalizada el 24/09/2026:

```powershell
node --test tests/oracle-ui.test.mjs tests/adapter.test.mjs tests/oracle.test.mjs
node runner/preflight.mjs
```

Resultado observado:

- Las dos pruebas de `adapter.test.mjs` pasan.
- `oracle-ui.test.mjs` y `oracle.test.mjs` fallan al importar `runner/oracle/evaluate.mjs`.
- El error es `SyntaxError: Illegal return statement`, en la línea 24 de ese archivo.
- El resumen del ejecutor informa dos pruebas aprobadas y dos entradas fallidas correspondientes a los archivos que no pudieron cargarse. Esto **no significa que solo dos casos funcionales hayan fallado**.
- El preflight sigue bloqueando la generación.

El evaluador contiene fragmentos fuera de sus funciones: un `return` en el nivel superior y un bloque de servidor incompleto. Hasta recuperar una estructura ejecutable, A01–A05 deben figurar como **no verificables en la revisión actual**, no como resultados funcionales PASS/FAIL.

Además, las pruebas muestran dos contratos distintos: `oracle.test.mjs` llama a `runCase` con un adaptador, mientras `oracle-ui.test.mjs` le entrega una URL de archivo. Debe definirse claramente cómo se separan la evaluación abstracta y la apertura de navegador, conservando pruebas para ambas capas.

### A04 y A05: observaciones para la reparación posterior

- **A04:** el test espera los ocho productos `P010`–`P017`, pero `tests/fixtures/catalog-page.html` solo incluye cuatro productos en total y dos de categoría Home. Esa página de prueba no puede satisfacer el resultado esperado completo. Es una inconsistencia del soporte de prueba que debe resolverse antes de juzgar una aplicación candidata.
- **A05:** el código contiene un patrón para interpretar «después cambiar categoría a Home», pero el error de importación impide verificar su funcionamiento. No está demostrado que este paso siga siendo la causa de fallo una vez restaurado el evaluador.
- **Visibilidad:** `visibleIds()` obtiene los textos de elementos con rol `listitem`. Las pruebas actuales demuestran lectura del DOM y acciones sobre controles, pero todavía conviene comprobar explícitamente elementos ocultos, duplicados y estados vacíos antes de afirmar que cubre toda la semántica de «solo lo visible».

## 3. Trabajo metodológico y estructural completado

### Repositorio y trazabilidad

Se creó `evoguard-corpus`, se inicializó Git y se configuró la identidad de autor únicamente en este repositorio. Los archivos sincronizados de `sources/` se mantienen como referencias de solo lectura.

Los principales hitos del historial son:

| Commit | Hito |
|---|---|
| `b2d6f5e` | Estructura inicial, metodología y especificación F001. |
| `eebe2be`, `04a2c91`, `48d8a2c` | Diagnóstico Docker, preparación WSL y comprobación Linux. |
| `72565f4` | Runtime aislado y verificado. |
| `f1d666e` | Runner simulado con reparación y reasignación. |
| `57cde62` | Pool de modelos y adaptadores de conectividad. |
| `86e9b91` | Acceso comercial mediante Synterolink. |
| `759ba0d` | Contrato de respuesta y verificación comercial. |

La conversación de referencia se conservó en [reference-conversation.md](reference-conversation.md). El [protocolo v1.0](protocol-v1.0.md) es una transcripción operativa de las decisiones recuperadas; no debe presentarse como copia idéntica del Markdown original que no se recuperó. Si aparece el original, corresponde comparar diferencias y documentar su resolución.

### Esquemas, requisitos y datos

Se materializaron esquemas JSON, validación estricta y comprobaciones cruzadas entre manifiestos, fixture, requisitos, turnos y versiones del stack. La familia dispone de `family.yaml`, `provenance.yaml`, requisitos R001–R005 y turnos T001–T003.

El fixture determinista contiene 30 productos con identificadores `P001`–`P030`, nombre, categoría y precio. La distribución es Electronics: 9, Home: 8, Sports: 7 y Books: 6. El fixture se controla mediante hash para evitar cambios silenciosos que alteren el significado de los resultados.

| Referencia | Requisitos acumulados | Comportamiento incorporado |
|---|---|---|
| V0 | R001 y R002 | Búsqueda por subcadena sin distinguir mayúsculas, recorte de espacios y filtro por categoría combinado con la búsqueda. |
| V1 / T001 | R001–R003 | Orden por nombre o precio, ascendente y descendente, con reglas deterministas para empates. |
| V2 / T002 | R001–R004 | Paginación de hasta diez productos, aplicada después de filtrar y ordenar; cambios de búsqueda o categoría reinician la página. |
| V3 / T003 | R001–R005 | Selección única por identidad estable; se conserva al ordenar o paginar y se elimina si el filtro excluye el producto. |

La arquitectura prevista para F001 utiliza estado centralizado con `useState` y valores derivados. No requiere backend, persistencia ni servicios externos. Las restricciones arquitectónicas forman parte de la evaluación; no justifican corregir manualmente una implementación experimental.

### Prompts y aislamiento de información

Existen prompts comunes, de generación inicial, evolución y reparación. El constructor del paquete entrega requisitos activos acumulados y parámetros operativos persistentes. Los requisitos futuros y el oráculo privado no deben aparecer en el contexto del constructor.

Los 33 casos declarativos del oráculo ya existen. Lo pendiente es hacerlos ejecutables, comprobar que detectan implementaciones incorrectas y conectarlos al proceso de evaluación de candidatos reales.

## 4. Entorno y ejecución aislada

El entorno se inspeccionó antes de fijar el stack. El inventario inicial registró Git 2.55.0.windows.5, Node 26.7.0 y npm 11.19.0. Docker estaba instalado, pero el motor Linux no estaba operativo inicialmente. Se preparó WSL y, después del reinicio del equipo, se verificó Docker Linux.

Se construyó un runtime con base fijada por digest, dependencias y navegador. Las verificaciones previas comprobaron instalación offline, compilación y uso de Chromium en contenedores limpios. El entorno emplea usuario no privilegiado, raíz de solo lectura, límites de recursos y red externa deshabilitada durante la ejecución aislada.

El workspace se introduce sin montar carpetas del equipo ni el socket de Docker. Los contenedores no reciben credenciales, oráculo privado ni historia del repositorio de control. Los proveedores se invocan desde la capa de control; el código candidato no necesita acceso externo a Internet.

La imagen exportada y las trazas instrumentales residen en `.artifacts/`, fuera de Git. Para reproducibilidad en otro equipo se deben conservar por separado el archivo de imagen y su hash. Reconstruir una imagen consultando repositorios de paquetes no garantiza identidad binaria con la ya verificada.

La evidencia histórica está en [environment.md](environment.md), [docker/README.md](../docker/README.md) y [verification/container.json](verification/container.json). Este informe no ha repetido la verificación completa del contenedor. Hay modificaciones locales de su configuración y evidencia que deben revisarse antes de incorporarlas al siguiente commit.

## 5. Runner implementado y sus límites

El motor simulado dispone de ciclos de acciones, herramientas, entrega, reparación y reasignación. La política contempla tres intentos por proveedor, hasta 25 ciclos por intento y tiempos máximos de 1800 segundos para APIs y 3600 para locales.

La reparación conserva el workspace del intento anterior del mismo proveedor. La reasignación parte de una base limpia: scaffold para V0 o referencia previa validada para evolución. El anillo incluye los cinco proveedores y evita repetir asignaciones indefinidamente.

Los fallos visibles de desarrollo pueden alimentar una reparación. Un fallo del oráculo privado conduce a reasignación sin revelar su diagnóstico al constructor. Los fallos de infraestructura deben registrarse aparte y no contarse automáticamente como regresiones funcionales.

El ensayo instrumental previo cubrió cuatro escenarios, 24 intentos y 13 contenedores cerrados. Esa evidencia prueba comportamiento del motor y limpieza, pero no valida una aplicación F001 ni sustituye el oráculo E2E.

Faltan la integración experimental completa, persistencia de candidatos y referencias, exportación auditada de historia para V1 en adelante y conexión de las evaluaciones reales con los criterios de aceptación.

## 6. Modelos y conectividad

| Rol | Modelo configurado | Acceso |
|---|---|---|
| OpenAI | `gpt-5.6-sol` | Synterolink, protocolo Responses. |
| Anthropic | `claude-sonnet-5` | Synterolink, protocolo Messages. |
| Google | `gemini-3.1-pro-preview` | Synterolink, protocolo generateContent. |
| Local A | `qwen2.5-coder:7b` | Ollama, contexto 8192. |
| Local B | `granite3.3:8b` | Ollama, contexto 8192. |

Los cinco modelos cuentan con evidencia de respuesta instrumental. En la primera prueba comercial Sonnet devolvió JSON rodeado de Markdown; se hizo explícito el contrato de respuesta común y el ensayo comercial final pasó para los tres modelos. No se generó F001 durante estas llamadas.

Los adaptadores registran identificador solicitado y reportado, parámetros, duración y uso disponible. El costo desconocido se conserva como `null`, no como cero. Las credenciales se mantienen fuera de Git y no forman parte de este documento.

El 24/09/2026 `config/models.json` declara congelados **solo los parámetros de inferencia**. Esto no congela la familia, no acredita ejecuciones experimentales y no completa `provenance.models`. Los parámetros de π0, repeticiones y corte monetario permanecen pendientes.

La conectividad no demuestra equivalencia de presupuestos entre modelos ni garantiza que un alias del intermediario conserve indefinidamente el mismo backend. Es necesario registrar el modelo reportado y la fecha de cada ejecución, conservando esta limitación de reproducibilidad.

## 7. Pendientes y secuencia de ejecución

### Paso 1 — Recuperar una base ejecutable del oráculo

**Objetivo:** que las suites puedan cargar el evaluador y producir resultados interpretables.

Restaurar las funciones incompletas de `evaluate.mjs`, definir el contrato de `runCase` y separar, si corresponde, la evaluación por adaptador de la apertura de una página. Revisar también `tests/run-oracle-test.mjs`, que contiene una importación distinta y no forma parte del patrón habitual `tests/*.test.mjs`.

**Criterio de cierre:** importación válida y pruebas focalizadas ejecutadas; ninguna suite se declara aprobada solo porque su archivo existe.

### Paso 2 — Completar y comprobar R001-A01–A05

**Objetivo:** validar búsquedas y sus interacciones sobre observaciones reales de la interfaz.

Alinear la página de prueba con el fixture esperado, comprobar expansión de `P010–P017` e interpretación de acciones secuenciales y verificar resultados intermedios. Incluir páginas deliberadamente incorrectas para demostrar que el oráculo rechaza errores, además de aceptar la implementación de prueba correcta.

**Criterio de cierre:** los cinco casos pasan en el soporte correcto y detectan las desviaciones que les corresponden. Registrar evidencia nueva que sustituya el estado comunicado anteriormente.

### Paso 3 — Implementar R002–R005 y cerrar los 33 casos

**Objetivo:** convertir toda la especificación declarativa en evaluación ejecutable.

Cubrir categoría combinada con búsqueda, orden y empates, paginación y reinicios, selección estable y eliminación al filtrar. La evaluación debe respetar la versión: V0 no puede fallar por carecer de funcionalidades que solo se introducen en turnos posteriores.

Las páginas de calibración del oráculo son material de prueba, no referencias del corpus. No deben convertirse en una V0 escrita manualmente ni entregarse como solución al constructor.

**Criterio de cierre:** matriz de cobertura de los 33 casos, controles negativos y ejecución repetible. Antes del congelamiento se exige estabilidad del oráculo en cinco ejecuciones según la política.

### Paso 4 — Cerrar la política de contexto

**Objetivo:** ejecutar el mismo protocolo informativo dentro de los límites de cada modelo.

Medir paquete inicial, contrato JSON, historial y salidas de herramientas. Definir reservas de salida y tratamiento del crecimiento del contexto, especialmente para los locales de 8192 tokens. No truncar silenciosamente requisitos ni eliminar información privada de forma que accidentalmente termine exponiéndose en otra parte del paquete.

**Criterio de cierre:** política documentada, casos límite comprobados y trazabilidad de lo que cada modelo recibe. Los parámetros congelados no resuelven por sí solos esta política.

### Paso 5 — Integrar persistencia, referencias y evaluación real

**Objetivo:** que cada intento tenga evidencia recuperable y cada referencia aceptada proceda de validaciones reales.

Conectar adaptadores al motor experimental, conservar acciones, parches, métricas y resultados; separar diagnósticos privados de mensajes visibles; implementar exportación auditada para evolución. Asegurar que una entrega solo se acepta después de completar las evaluaciones y guardar la referencia.

**Criterio de cierre:** ensayo integral instrumental recuperable, sin fabricar registros experimentales; historial exportado sin secretos ni material reservado.

### Paso 6 — Actualizar preflight y criterios de preparación

**Objetivo:** que el bloqueo refleje requisitos actuales y comprobables.

El texto actual todavía menciona conectividad completa y congelamiento de parámetros como pendientes, pese a la evidencia comercial y al congelamiento limitado registrado. Debe sustituirse por comprobaciones efectivas. Asimismo, se deben distinguir los modelos configurados antes de generar de la procedencia observada después de ejecutar: exigir registros futuros para permitir la primera ejecución crearía una dependencia circular.

**Criterio de cierre:** cada bloqueo corresponde a una condición verificable. No basta con cambiar `CASES_SPECIFIED_ADAPTER_PENDING` ni eliminar un mensaje para habilitar generación.

### Paso 7 — Generar y validar V0

**Dependencias:** oráculo aplicable a V0 operativo, política de contexto, integración, persistencia y preflight coherente.

Ejecutar generación real en el alcance autorizado, aplicar pruebas de desarrollo, oráculo independiente y restricciones arquitectónicas; reparar o reasignar según protocolo. Guardar procedencia y resultados reales. No realizar correcciones funcionales humanas ni revelar resultados del oráculo al constructor.

**Criterio de cierre:** referencia V0 válida y recuperable con R001 y R002, sin anticipar requisitos futuros.

### Paso 8 — Ejecutar T001–T003, auditar y congelar F001

Producir V1, V2 y V3 desde sus referencias previas, comprobar requisitos acumulados y distinguir fallos nuevos de regresiones. Auditar el episodio completo y la estabilidad del oráculo antes de recorrer los estados `GENERATED`, `VALIDATED`, `AUDITED` y `FROZEN` conforme a sus criterios.

**Criterio de cierre:** cuatro referencias trazables, tres turnos completos, evidencia íntegra y auditoría aprobada. Un intento exitoso aislado no equivale a familia congelada.

### Paso 9 — Revisar viabilidad, ampliar el piloto y preparar π0

Con evidencia de F001, evaluar tiempos, consumo, fallos y necesidades operativas. Preparar las otras nueve familias con diversidad y control de similitud para limitar pseudo-replicación. Mantener auditoría del 100 % del piloto.

Definir el modelo fijo π0, repeticiones y presupuesto con justificación metodológica. Mantener separados los registros de construcción del corpus y los de evaluación π0. El ground truth de impacto y riesgo debe apoyarse en cambios y resultados observados, sin etiquetas inventadas.

**Criterio de cierre:** piloto reproducible y decisiones de evaluación documentadas. No se fija aquí un calendario artificial: la duración depende de lo que revele F001.

## 8. Evidencia y conservación del trabajo

Las 75 pruebas aprobadas registradas tras la integración comercial son **evidencia histórica de esa revisión**. No describen la suite actual, que incorpora archivos nuevos y presenta el error de importación señalado. Tampoco se suman a las dos pruebas del adaptador como si fueran una ejecución conjunta.

Fuentes principales:

- [Registro de ejecución](execution-ledger.md).
- [Decisiones operativas](operational-decisions.md).
- [Verificación general](verification.md).
- [Ensayo del runner](verification/runner-simulation.json).
- [Conectividad de proveedores](verification/provider-connectivity.json).
- [Conectividad Synterolink](verification/synterolink-connectivity.json).
- [Configuración de modelos](../config/models.json).
- [Evaluador actual](../runner/oracle/evaluate.mjs), [adaptador UI](../runner/oracle/ui-adapter.mjs) y [pruebas UI](../tests/oracle-ui.test.mjs).

Antes del siguiente commit funcional se deben revisar los cambios locales existentes, ejecutar las comprobaciones correspondientes y conservar las evidencias. Este informe no modifica esas implementaciones ni incorpora cambios ajenos a un commit.

## 9. Próximo bloque recomendado

La prioridad inmediata es **restaurar el evaluador y verificar R001-A01–A05**. Después corresponde ampliar cobertura a R002–R005 y cerrar contexto e integración. La generación de V0 continúa pendiente de esas garantías; las páginas de prueba y los ensayos de conectividad siguen siendo instrumentales.

Este documento registra el estado comprobado y planifica la continuación. No se ejecutaron nuevas llamadas a modelos ni se generaron referencias del corpus para elaborarlo.
