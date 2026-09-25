# Evaluación independiente
Los casos se definen antes de generar la aplicación. Este directorio solo pertenece al evaluador.
F001 contiene un caso por criterio de aceptación (33 casos) y un contrato de adapter de UI (`F001/adapter.ts`).

## Estado — 2026-09-24
Los 33 casos son ejecutables en `runner/oracle/`:
- `plans.mjs`: un plan explícito por caso; traduce los pasos a acciones del adapter y compara observaciones con expectativas.
- `spec-lock.json`: hash de `{id, steps, expected}` de cada caso. Si un caso cambia, su plan deja de ser ejecutable hasta revisarlo.
- `reference.mjs`: expectativas derivadas del fixture (filtro, orden ASCII con empates estables, páginas de 10). Solo lo usa el evaluador.
- `ui-adapter.mjs`: acciona controles accesibles y lee la UI (listitems visibles, `role=status`, estados ARIA). No calcula resultados.
- `evaluate.mjs`: evaluación por caso y por versión (V0: 10 casos, V1: 17, V2: 25, V3: 33); un control ausente es FAIL del candidato.
- `bridge.mjs`: etapa `independent_oracle` para el runner; resultado público solo `status`, informe completo por canal privado; estabilidad N/N según `policy.oracle_stability_runs`.

Calibración con `tests/fixtures/catalog-complete.html` (material de prueba, no referencia del corpus): la implementación correcta pasa en V0–V3, 17 mutantes deliberados son rechazados por sus casos y la suite V3 es estable 5/5.

## Límites vigentes
- Oráculo calibrado solo contra páginas de prueba. Falta el transporte de navegador hacia el candidato aislado en contenedor (la fábrica `openSession` del puente) y su ensayo con una aplicación generada.
- Contrato de UI: los roles y nombres que usa el adapter están definidos en el `ui_contract` de cada requisito y se entregan al constructor por requisito activo (decisión del 2026-09-24 en `docs/operational-decisions.md`). `tests/contract.test.mjs` comprueba la coincidencia.
- `family.yaml` mantiene `oracle.status = CASES_SPECIFIED_ADAPTER_PENDING` (el esquema no admite otro valor todavía) y el preflight sigue bloqueando la generación.

El fallo del oráculo se registra solo en el canal privado del evaluador y causa reasignación; no se expone al agente para reparación.
No llamar a un conjunto sin adapter como PASS ni producir métricas de riesgo antes de referencias válidas.
