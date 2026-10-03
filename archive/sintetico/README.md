# Estrato sintético (archivado el 2026-10-02)

**Decisión del tesista (2026-10-02):** el corpus de EvoGuard UI ya no usa familias sintéticas puras. Se construye solo con el **estrato semi-real**: repositorios públicos React fijados en un commit V0 verificado, con cambios controlados redactados para el estudio (`families-real/`). La configuración vigente está en `config/strata.json`.

## Qué contiene esta carpeta

| Ruta | Contenido |
|---|---|
| `families/F001–F010/` | Especificación de las 10 familias sintéticas: requisitos, turnos, fixtures, prompts. F001 está FROZEN con sus referencias V0–V3 generadas por modelos (2026-09-24/25). F002–F010 están en DRAFT, calibradas y sin generar |
| `oracle/F001–F010/` | Casos declarativos de los oráculos E2E (Playwright) |
| `scripts/run-f001.*` | Lanzador histórico del episodio real de F001 |

El código que las usa sigue en `runner/`, porque es infraestructura compartida (motor, contenedores, protocolo de acciones), y apunta a esta carpeta:
- `runner/families.mjs`, `runner/oracle/*`, `runner/pipeline/*` y `runner/validation/corpus.mjs`;
- las calibraciones E2E (`tests/calibration/`, `tests/fixtures/calibration/`).

Los registros de F001 siguen en `runs/corpus-generation/F001` y `evaluator/runs/F001`.

## Reglas
- **No se generan ni se congelan familias Fxxx.** El preflight lo bloquea («Estrato sintético archivado»).
- **No entran en el corpus ni en el análisis.** `npm run analysis` excluye los registros de Fxxx salvo con `--include-archived`.
- **El banco de modelos locales** usa solo tareas semi-reales (`config/local-bench.json`).
- **Integridad:** `npm run corpus:validate` sigue validando las Fxxx («archivada»).
- **Evidencia del contenedor sintético:** la de `config/container.json` / `docs/verification/container.json` quedó obsoleta al mover estas rutas. Sus pruebas se omiten mientras el estrato esté archivado. Para reactivarlo hay que ejecutar `npm run environment:verify`.

## Para qué sirve todavía
- **Antecedente del piloto:** la ejecución real de F001 motivó el protocolo de acciones 1.1, las normalizaciones y la política de contexto, que hoy usa el estrato semi-real.
- **Evidencia del diseño de oráculos:** calibración con mutantes y revisión de equidad de 260 casos.
