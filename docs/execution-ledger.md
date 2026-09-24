# Registro de ejecución — plan: docs/superpowers/plans/2026-09-22-f001.md

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

La conectividad comercial deja de estar pendiente. Permanecen política de contexto, oráculo E2E e integración/persistencia de referencias antes de generar V0.
