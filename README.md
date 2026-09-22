# EvoGuard Corpus
Especificación ejecutable F001 conforme a las decisiones del protocolo v1.0 recuperadas de “Saludo inicial”. Estado: **DRAFT**. Este repositorio contiene infraestructura metodológica y un scaffold neutro; no contiene V0 ni resultados experimentales.

## Uso local
```powershell
npm ci
npm --prefix templates/react-vite ci
npm run check
npm run family:validate -- F001
npm run packet:preview -- F001 V0
npm run generation:preflight
```
El último comando debe rechazar la generación mientras falten Docker/entorno congelado, modelos exactos y oráculo E2E. No llama APIs. El preview escribe solo insumos visibles en runs/preflight; **no es un workspace aislado ni ejecuta agentes**.

## Contenido
- schema/: JSON Schema draft-07, versión 1.0.0, validación estricta.
- families/F001-product-catalog/: manifiestos, 5 requisitos, 3 turnos y 30 productos.
- prompts/: instrucciones comunes, generación, evolución y reparación.
- templates/react-vite/: scaffold sin lógica del catálogo; dependencias exactas y lockfile.
- oracle/F001/: casos independientes y contrato de adaptación a la futura UI.
- runner/: validación, ensamblado seguro de insumos y contratos del runner futuro.
- runs/: separación entre construcción de referencias y ejecuciones de π0.
- docs/: protocolo recuperado, decisiones operativas, entorno y verificación.

## Límites actuales
La validación estructural no equivale a validar F001 funcionalmente. app/ y generation/V0–V3 están vacíos intencionalmente. No hay modelos locales seleccionados, llamadas a proveedores, etiquetas de impacto/riesgo ni commits de referencia.
La independencia del oráculo exige un contenedor que solo monte el repositorio de aplicación, con historia pasada saneada; separar carpetas no basta. No ejecutar un agente experimental en la raíz de este repositorio.

Consulta docs/protocol-v1.0.md y docs/environment.md antes de iniciar generación.
