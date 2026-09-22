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
