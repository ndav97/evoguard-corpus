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
El último comando rechaza la generación mientras falten conectividad completa, parámetros congelados, integración experimental del runner y oráculo E2E. No llama APIs. El preview escribe solo insumos visibles en runs/preflight; **no es un workspace aislado ni ejecuta agentes**.

## Entorno Linux verificado
La imagen local está guardada por SHA-256, con dependencias offline y Chromium. `npm run environment:verify` carga el archivo guardado y prueba dos contenedores limpios. Consulta [operación y reproducción](docker/README.md) y [evidencia](docs/verification/container.json). `npm run environment:build` reconstruye y exige verificar de nuevo antes de abrir sesiones.

## Contenido
- config/models.json y runner/providers/: pool seleccionado, adaptadores reales y diagnóstico; `npm run providers -- inspect` no genera F001.
- runner/execution/ y runner/simulation/: motor de intentos y ensayo con respuestas guionadas; ejecutar `npm run runner:simulate`. No genera V0 ni llama modelos.
- schema/: JSON Schema draft-07, versión 1.0.0, validación estricta.
- families/F001-product-catalog/: manifiestos, 5 requisitos, 3 turnos y 30 productos.
- prompts/: instrucciones comunes, generación, evolución y reparación.
- templates/react-vite/: scaffold sin lógica del catálogo; dependencias exactas y lockfile.
- oracle/F001/: casos independientes y contrato de adaptación a la futura UI.
- runner/: validación, ensamblado seguro de insumos y contratos del runner futuro.
- runs/: separación entre construcción de referencias y ejecuciones de π0.
- docs/: protocolo recuperado, decisiones operativas, entorno y verificación.

## Límites actuales
La validación estructural no equivale a validar F001 funcionalmente. app/ y generation/V0–V3 están vacíos intencionalmente. El pool está seleccionado y los locales tienen comprobación instrumental de conectividad; no hay generaciones experimentales, etiquetas de impacto/riesgo ni commits de referencia.
El sandbox implementado recibe únicamente el scaffold, fixture y requisitos iniciales, sin montar archivos del host ni copiar la historia Git del corpus. La exportación de referencias posteriores está pendiente y V1–V3 se rechazan. No ejecutar un agente experimental en la raíz de este repositorio.

Consulta docs/protocol-v1.0.md y docs/environment.md antes de iniciar generación.
