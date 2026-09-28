# EvoGuard Corpus — Estado del proyecto (2026-09-27)

Sustituye a `estado-del-proyecto-2026-09-24.md` como estado vigente; aquel documento se conserva como registro histórico de F001.

## 1. Resumen

El piloto tiene **20 familias en dos estratos**:

| Estrato | Familias | Base V0 | Oráculo | Estado |
|---|---|---|---|---|
| Sintético | F001–F010 | Scaffold neutro React+TS+Vite y fixture determinista | Casos E2E en Playwright dentro de un contenedor aislado, con planes vinculados por hash | F001 **FROZEN** (generada y auditada). F002–F010 en **DRAFT** con oráculo `E2E_CALIBRATED`: listas para generar |
| Semi-real | S001–S010 | Commit real fijado de un repositorio público React/TS (10 organizaciones y dominios; 6 con vitest y 4 con jest) | Tests ocultos por turno (fail-to-pass), preservación de turnos previos, suite original (pass-to-pass) y 2 ejecuciones estables | 30/30 turnos **CALIBRATED**; integrado al runner (imágenes por familia en preparación en el PC) |

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
  - `npm test` pasa 179/179.
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
1. **Estrato semi-real integrado al runner** (hecho el 2026-09-27, fases R1–R5): imagen por familia, workspace aislado, oráculo de tests ocultos + suite, control de alcance, linaje por hash, generación, auditoría y preflight (`docs/estrato-semi-real.md`). Ensayo completo con la familia de prueba S900 en PASS. **Pendiente en el PC:** terminar `preparar-imagenes.cmd` (S001–S005 ya VERIFIED) y ejecutar `ensayar-familias.cmd`.
2. **Estrato sintético:**
   - completar la corrida conjunta de la calibración;
   - revisión independiente de la equidad del oráculo (comprobaciones que no se deducen del texto visible);
   - declarar los 9 mutantes de F009 que aún no se verifican;
   - un ensayo instrumental de generación y auditoría en una familia nueva.
3. **Estrato semi-real:**
   - prueba de fuerza de los tests ocultos, con mutantes sobre las referencias;
   - revisión humana de los enunciados T001–T003.
4. **Coherencia de nombres:** los productos de F003 usan IDs `S001–S016`, que coinciden con los nombres de las familias semi-reales. Conviene cambiar el prefijo de F003 antes de generar.
5. **Documentación:** registrar en `operational-decisions.md` la decisión del estrato semi-real y los criterios de calibración de ambos estratos.

### Con modelos (usuario)
1. `npm run providers:diagnose` cuando Synterolink confirme que el servicio funciona.
2. Banco de modelos locales en Vast.ai, elección de `local_a`/`local_b`, recongelado de `config/models.json` y recalibración del contexto. Con repositorios reales, valorar una ventana mayor que 8 192 tokens.
3. Generar y auditar cada familia sintética:
   - `npm run generation:preflight -- Fxxx`
   - `npm run corpus:generate -- Fxxx all`
   - `npm run corpus:audit -- Fxxx --freeze`
4. Familias semi-reales: `npm run corpus:generate -- Sxxx all` y `npm run corpus:audit -- Sxxx --freeze` (tras preparar imágenes y ensayar).
