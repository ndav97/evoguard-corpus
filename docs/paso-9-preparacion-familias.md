# Preparación de las familias F002–F010 (Paso 9)

Estado al 2026-09-24: la infraestructura de F001 está completa y ensayada de punta a punta (generación V0→V3, auditoría 5/5 y congelamiento) con constructores guionados. Solo falta la ejecución real con modelos (`scripts\run-f001.cmd`). Este documento fija qué hacer después, con la evidencia de F001.

## 0. Prioridad: salidas JSON inválidas de Sonnet y Gemini
Hecho el 2026-09-25: el adaptador guarda el texto rechazado y admite, registrándolo, el bloque Markdown envolvente; protocolo 1.1 para los cinco modelos (`docs/protocol-v1.1-actions.md`). Pendiente: cuando Synterolink confirme la solución, ejecutar `npm run providers:diagnose`; si algún proveedor no queda `HEALTHY`, revisar los ejemplos rechazados antes de generar.

## 1. Antes de especificar familias nuevas: revisar F001 real
Con `runs/corpus-generation/F001/*/summary.json`, `calls.jsonl` y `docs/verification/f001-audit.json`:
- tasa de aceptación por proveedor y versión; reparaciones y reasignaciones por etapa (typecheck/build/tests/oráculo/arquitectura);
- `model_output_error` y `CONTEXT_LIMIT` de los locales (¿alcanza la ventana de 8192?);
- tokens por versión (costo en `null`: estimar aparte con la tarifa de Synterolink);
- duración por intento frente a los límites de 1800/3600 s.
Decidir con esos datos si se ajustan límites, contrato de UI o política de contexto **antes** de congelar el protocolo para el piloto.

## 2. Qué necesita cada familia nueva
1. `families/F00n-<slug>/`: `family.yaml` (perfil estructural, `generation_plan`), `provenance.yaml`, `fixtures/` con hash, `requirements/R001–R005.yaml` **con `ui_contract`**, `turns/T001–T003.yaml`.
2. `oracle/F00n/`: casos declarativos por criterio de aceptación.
3. Oráculo ejecutable: planes por caso (`plans.mjs`), modelo de referencia derivado del fixture, `spec-lock.json`, adaptador de UI según su contrato.
4. Calibración: página correcta V0–V3 + mutantes que cada caso debe detectar + estabilidad 5/5.
5. Similitud: comparar requisitos, contratos y fixtures con las demás familias (evitar pseudo-réplica); `provenance.similarity_review`.

## 3. Código acoplado hoy a F001 (generalizar en el Paso 9)
Rutas o identificadores fijos de F001 en: `runner/validation/corpus.mjs` y `cli.mjs` (rutas, R001–R005, T001–T003, reglas del fixture de productos), `runner/packet.mjs` y `packet-cli.mjs`, `runner/sandbox/policy.mjs` y `seed-init.mjs` (payload V0 con `fixtures/products.json` y R001/R002), `probe.mjs`, `runner/oracle/*` (planes, referencia, adaptador del catálogo, bundle del contenedor), `runner/pipeline/*` (store, generate, audit, evaluator, arquitectura: fixture importado) y `runner/preflight.mjs`. Propuesta: un registro `families/<id>/family.yaml` → módulo de oráculo por familia (`oracle/<id>/plans.mjs`, `adapter.mjs`, `reference.mjs`), y parámetros de familia en validación, packet, seed, evaluador y auditoría. La generalización debe repetir el ensayo integral y la reverificación del contenedor.

## 4. Orden recomendado
1. Ejecutar y auditar F001 real → informe de viabilidad (sección 1).
2. Generalizar el código por familia manteniendo F001 FROZEN (sus pruebas deben seguir pasando sin regenerarla).
3. Diseñar F002–F010 con diversidad de dominios y estructuras; revisión de similitud.
4. Especificación declarativa → oráculo ejecutable → calibración con mutantes → ensayo → generación → auditoría, familia por familia.
5. Definir π0 (modelo fijo, repeticiones, corte monetario) con la evidencia del piloto; mantener separados los registros de construcción y de evaluación.
