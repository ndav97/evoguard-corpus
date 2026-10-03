# EvoGuard Corpus — Estado del proyecto (2026-09-27)

> Sustituido por `estado-del-proyecto-2026-10-02.md` (corpus solo semi-real; estrato sintético archivado).

Sustituye a `estado-del-proyecto-2026-09-24.md` como estado vigente; aquel documento se conserva como registro histórico de F001.

## 1. Resumen

El piloto tiene **20 familias en dos estratos**:

| Estrato | Familias | Base V0 | Oráculo | Estado |
|---|---|---|---|---|
| Sintético | F001–F010 | Scaffold neutro React+TS+Vite y fixture determinista | Casos E2E en Playwright dentro de un contenedor aislado, con planes vinculados por hash | F001 **FROZEN** (generada y auditada). F002–F010 en **DRAFT** con oráculo `E2E_CALIBRATED`: listas para generar |
| Semi-real | S001–S010 | Commit real fijado de un repositorio público React/TS (10 organizaciones y dominios; 6 con vitest y 4 con jest) | Tests ocultos por turno (fail-to-pass), preservación de turnos previos, suite original (pass-to-pass) y 2 ejecuciones estables | 30/30 turnos **CALIBRATED**; integrado al runner, 10 imágenes verificadas y ensayo del pipeline en PASS: listo para generar |

Commits en el PC (`evoguard-corpus`):
- `892950c`: F001 auditada y congelada.
- `e61dc3d`: protocolo 1.1, banco de modelos locales y guía de Vast.ai.
- `5115eab`: F002–F010 y runner multi-familia.
- `7648db2`: estrato semi-real S001–S010, minero de bases y calibrador.

## 2. Estrato sintético (F001–F010)

- **Pipeline multi-familia.** Estas piezas trabajan por familia:
  - descubrimiento por directorio;
  - validación por familia y global (`npm run corpus:validate`);
  - paquete, seed y linaje;
  - reglas de arquitectura derivadas del `structural_profile`;
  - oráculo por familia (`runner/oracle/families/Fxxx`);
  - generación, auditoría y preflight (`-- Fxxx`).
- **Rotación de proveedores por fila:** `ring[(n−1+v) mod 5]`, de modo que cada proveedor genera 8 de los 40 artefactos.
- **Diversidad arquitectónica:**

  | Familia | Arquitectura |
  |---|---|
  | F001 | useState centralizado |
  | F002 | useReducer |
  | F003 | Estado distribuido por props |
  | F004 | Formularios controlados |
  | F005 | useEffect + localStorage |
  | F006 | useMemo |
  | F007 | useReducer con fechas fijas |
  | F008 | Context API |
  | F009 | Máquina de estados con reducer |
  | F010 | Hooks propios + localStorage |

- **Calibración de cada familia:**
  - la versión correcta pasa todos sus casos;
  - la versión anterior falla exactamente los casos del requisito nuevo;
  - entre 15 y 27 mutantes detectados por familia;
  - estabilidad 5/5 en V3.
- **Pruebas y entorno:**
  - `npm test` pasa 200/200 (2026-09-28).
  - Las calibraciones de las familias se ejecutan aparte con `npm run test:calibration` (más de 1 h con 2 núcleos).
  - Entorno reverificado y ensayo integral en PASS con la imagen `sha256:3ed948d6…`.
  - El preflight queda despejado para F002–F010.
- **Documentación:** guía `docs/family-authoring.md` y checkpoint `docs/checkpoint-2026-09-25-familias.md`.

## 3. Estrato semi-real (S001–S010)

- **Motivo:** el corpus no puede basarse solo en datos sintéticos (indicación del docente).
- **Bases V0:** se minaron 66 repositorios y se verificaron 46. De ellos, 34 bases son válidas. Se seleccionaron 10 bases y hay 5 de reserva (`docs/seleccion-piloto-semi-real.md`).
- **Contenido de cada familia:** `family.yaml` (repositorio, commit V0, paquete, runner) y, por turno T001–T003:
  - `turns/T00n.md`: petición visible para el modelo;
  - `oracle/T00n.test.*`: tests ocultos;
  - `reference/T00n.patch`: implementación de referencia.
- **Calibrador:** `scripts/real/calibrar.mjs`, en Docker y sin red. Detalle en `docs/resumen-chat-estrato-semi-real-2026-09-27.md`.

## 4. Pendientes

### Sin modelos (Claude)
1. **Estrato semi-real listo para generar** (2026-09-28): integrado al runner (fases R1–R5, `docs/estrato-semi-real.md`); las 10 imágenes VERIFIED (`config/real-bases.json`) y el ensayo del pipeline con cada repositorio real en PASS con el código actual (`docs/verification/real-rehearsal-s0xx.json`, commit `1f9fdd3`). Correcciones surgidas de los ensayos: hooks de git de los repos (lefthook), selección del test a borrar en el escenario, contenedores de ejecuciones interrumpidas y falsos positivos del filtro de secretos. Solo faltan los modelos (preflight: modelos congelados y contexto).
2. **Estrato sintético** (2026-09-29, `docs/progreso-tareas-sin-modelos.md`):
   - hecho: revisión independiente de la equidad de los oráculos, con 41 ambigüedades corregidas (`docs/revision-equidad-oraculos-2026-09-29.md`);
   - hecho: 9 mutantes de F009 declarados;
   - hecho: ensayo de generación y auditoría de F002 hasta FROZEN;
   - hecho: calibración conjunta F002–F010, 72/72.
3. **Estrato semi-real:**
   - hecho: prueba de fuerza de los tests ocultos. Puntuación bruta 0,92 y ninguna debilidad conocida tras reforzar los tests (`docs/fuerza-tests-ocultos-semi-reales-2026-09-29.md`);
   - revisión humana de los enunciados T001–T003.
4. ~~Coherencia de nombres~~: hecho. Los productos de F003 pasan a `A001–A016`.
5. **Documentación:** registrar en `operational-decisions.md` la decisión del estrato semi-real y los criterios de calibración de ambos estratos.

### Con modelos (usuario)
1. ~~`npm run providers:diagnose`~~ Hecho el 2026-09-28: openai y google HEALTHY (9/10). anthropic FAILING (0/10) por prosa antes del JSON, porque Synterolink no aplica la salida estructurada. Corregido con la normalización acotada `prose_prefix`; con las muestras reales pasaría a 9/10 (`operational-decisions.md`, 2026-09-28). Falta:
   - segundo diagnóstico (2026-09-29): openai 10/10, google 9/10, anthropic 6/10 (DEGRADED). Los 4 rechazos son pseudo-llamadas XML. Primera sonda: Synterolink ignora la salida estructurada pero respeta las herramientas nativas (8/8 `tool_use`). **Siguiente paso: `npm run providers -- probe --rounds=5 --variants=D,E,F`** para elegir entre la herramienta con razonamiento (D/F) y la forzada (E);
   - **repetir `scripts\real\ensayar-familias.cmd`** una vez, porque el cambio de `actions.mjs` desactualiza la huella de S001–S010. Desde el 2026-09-29 el transporte de proveedores no forma parte de la huella, así que el cambio de intermediario de Sonnet ya no obliga a repetirlos. Los ensayos sintético y S900 están vigentes.
2. Banco de modelos locales en Vast.ai, elección de `local_a`/`local_b`, recongelado de `config/models.json` y recalibración del contexto. Con repositorios reales, valorar una ventana mayor que 8 192 tokens.
3. Generar y auditar cada familia sintética:
   - `npm run generation:preflight -- Fxxx`
   - `npm run corpus:generate -- Fxxx all`
   - `npm run corpus:audit -- Fxxx --freeze`
4. Familias semi-reales: `npm run corpus:generate -- Sxxx all` y `npm run corpus:audit -- Sxxx --freeze` (tras preparar imágenes y ensayar).
