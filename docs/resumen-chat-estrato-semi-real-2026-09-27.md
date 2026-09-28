# Resumen del chat «estrato semi-real» (25–27/09/2026) — para continuar en el hilo principal

> **Actualización 2026-09-27 (hilo principal):** el hallazgo de la sección 5 quedó resuelto. F002–F010, `oracle/F00x`, `runner/oracle/families/`, `tests/calibration/` y la generalización multi-familia se sincronizaron al PC en el commit `5115eab`. El estrato semi-real (`families-real/`, `scripts/mine/`, `scripts/real/` y estos documentos) quedó versionado en `7648db2`. Estado vigente: `docs/estado-del-proyecto-2026-09-27.md`.

## 1. Punto de partida y decisión
- **Problema:** el docente indicó que el corpus EvoGuard no puede basarse solo en datos sintéticos (familias F001–F010).
- **Decisión:** se agrega un **estrato semi-real**:
  - **Base V0:** un commit real, fijado por SHA, de un repositorio público React/TS con historia verificable, licencia abierta y suite de tests.
  - **Cambios T001–T003:** los redacta el equipo. En la práctica los redactó Claude, con revisión humana pendiente: enunciados, tests ocultos e implementación de referencia.
  - **Oráculo de regresión:**
    - la suite existente del repo (pass-to-pass, al estilo SWE-bench);
    - los tests ocultos de cada turno (fail-to-pass);
    - la preservación de los turnos anteriores;
    - la estabilidad en dos ejecuciones.
- **Piloto acordado:** 10 bases semi-reales + las 10 familias sintéticas.

## 2. Minado y verificación de bases V0
- **Minero y verificador:** `scripts/mine/mine-baselines.mjs`, con 66 repos fijados en `scripts/mine/repos-v0.txt`. El lanzador de Windows es `scripts/mine/verificar-bases.ps1` / `.cmd`, que reinicia Docker automáticamente y evita la suspensión del equipo.
- **Entorno de verificación:**
  - Docker Desktop, imagen `node:24-bookworm` y volumen `evoguard-bases` (`/cache/repos`, worktrees en `_baselines/`).
  - Tests sin red, con 2 workers y un tope de 20 min.
  - Cada suite se ejecutó dos veces y se descargó la versión de Node que exige cada repo.
- **Resultado (46 verificadas): 34 bases V0 válidas.** 31 están en verde y 3 tienen fallos conocidos estables (≤5 %): traefik, p5.js-web-editor y k6-studio. Detalle en el Project: `claude/bases-v0-verificadas-2026-09-27.md`.
- **Estados posibles del verificador:**
  - GREEN, GREEN_WITH_KNOWN_FAILURES, FLAKY, RED;
  - NO_TESTS, NO_REPORT, TIMEOUT, HUNG, INSTALL_FAILED.

## 3. Selección del piloto semi-real (10 bases)
- **Criterios:** un repo por organización, 10 dominios distintos, 6 con vitest y 4 con jest, y entre 6k y 37k líneas.
- **Reservas:** pontoon, navidrome, jaeger-ui, openmrs form-builder y treeherder.
- **Detalle:** Project `claude/seleccion-piloto-semi-real.md` y `docs/seleccion-piloto-semi-real.md` en el PC.

## 4. Familias semi-reales S001–S010 — TODAS CALIBRADAS (30/30 turnos OK)

| Familia | Repo (paquete, runner) | Foco | T001 | T002 | T003 |
|---|---|---|---|---|---|
| S001 | kopia/htmlui (`.`, vitest) | `Tasks.jsx` | Resumen «Showing N of M tasks» y estado vacío | Estados Success/Canceled y «Clear filters» | «Cancel all running tasks» |
| S002 | openedx/frontend-app-gradebook (`.`, jest) | HistoryTable | Buscar cargas | Columna «Uploaded by» | Usuario clicable |
| S003 | authelia/authelia (`web`, vitest) | PasswordMeter | Progressbar y «Strength: X» | Lista de requisitos ✓/✗ | `onValidityChange` y fuerza mínima |
| S004 | medplum/medplum (`packages/app`, vitest) | ArrayColumnPadding | Restablecer valores por defecto | Validación de rango | «Recommended M» y Copy |
| S005 | mozilla/fx-private-relay (`frontend`, jest) | LabelEditor | Contador de caracteres restantes | Escape cancela | Botón para quitar la etiqueta |
| S006 | morpheus65535/bazarr (`frontend`, vitest) | TimeOffsetForm | Alternancia accesible y «Offset: ±HH:MM:SS.mmm» | Presets +100 ms / +1 s / +1 min | Normalizar al perder el foco y al enviar |
| S007 | plausible/analytics (`assets`, jest) | search-input | Botón «Clear search» | `resultCount` con `role=status` | Escape: primero vacía, luego quita el foco |
| S008 | wger-project/react (`.`, vitest) | DeleteConfirmationModal | Cierre accesible e ids del título y el mensaje | Confirmar escribiendo el texto | Borrado asíncrono con reintento |
| S009 | gethomepage/homepage (`.`, vitest) | widget stocks | Alternancia accesible (`aria-pressed`) | Opción `sort` ticker/change | Recordar la vista por watchlist (localStorage) |
| S010 | argoproj/argo-cd (`ui`, jest) | ApplicationsSummary | Porcentajes «N (P%)» | Leyendas Sync/Health como filtros (`onFilter`) | Fila «NEEDS ATTENTION» |

- **Calibración final:** 2026-09-28 01:23 UTC, 30/30 OK. Resultados en `.artifacts/real-calibration/resumen.md` y `Sxxx.json`, y en el Project `claude/familias-semi-reales-calibradas-2026-09-27.md`.
- **Formato de cada familia** (`families-real/Sxxx-slug/`):
  - `family.yaml`: repo, V0, paquete, runner, `hidden_tests_dir`, turnos y `provenance.status: CALIBRATED` con `calibrated_at`;
  - `turns/T00n.md`: enunciado en español con los literales de UI en inglés;
  - `oracle/T00n.test.*`: tests ocultos;
  - `reference/T00n.patch`: parche relativo al paquete.
- **Calibrador:** `scripts/real/calibrar.mjs`, lanzado con `scripts/real/calibrar-familias-reales.cmd`; `-Familia S00x` calibra una sola familia. Por turno, antes del cambio comprueba:
  - que los tests ocultos del turno fallen;
  - que los tests de los turnos anteriores sigan pasando.

  Después del cambio comprueba:
  - que pasen todos los tests ocultos;
  - que la suite completa pase sin regresiones;
  - que dos ejecuciones den resultados idénticos.

  Al terminar deja el workspace en V0.

### Incidencias resueltas (útiles para la sección de metodología)
- **Parches de paquetes en subcarpeta:** `git apply` los ignoraba en silencio. Ahora se usa `--directory=<paquete>` y se verifica que el parche cambió algo.
- **Falsa inestabilidad:** se debía al orden de los resultados; se compara con los resultados ordenados.
- **ts-jest con tipos (S007 T002):** el test oculto ni siquiera compila en V0. Ahora cuenta como fail-to-pass, marcado «no compila».
- **S008:** MUI 9 ignora `titleTypographyProps`; la referencia usa `slotProps.title`.
- **S009 T003:** la vista se guarda por watchlist para no romper tests existentes que dependen del estado inicial.
- **S003:** i18next usa «:» como separador de claves; se evitaron claves con «:».
- **YAML:** `calibrated_at` va entre comillas.

## 5. ⚠️ Hallazgo crítico: el estrato sintético NO está completo en el PC
- En el PC solo existe `families/F001-product-catalog`.
- **Qué falta:** todo lo descrito en el Project `claude/checkpoint-2026-09-25-familias.md`:
  - F002–F010;
  - `oracle/F00x`;
  - `runner/oracle/families/`;
  - `tests/calibration/`;
  - la generalización del pipeline a varias familias.

  Se hizo en **otra sesión en la nube** y nunca se sincronizó al PC (tarea pendiente 7 de ese checkpoint).
- **Estado del repositorio:** el último commit es `e61dc3d` (F001).
- **Opciones:**
  1. Abrir la sesión original del 25/09 y pedirle que sincronice y haga commit de todo en el PC.
  2. Si ese espacio ya no existe, rehacer F002–F010 a partir del checkpoint, sincronizando al PC y haciendo commit por etapas.

## 6. Estado del repositorio en el PC (`evoguard-corpus`)
- **Sin commit (untracked):**
  - `families-real/` (S001–S010 calibradas);
  - `scripts/mine/`;
  - `scripts/real/`;
  - `docs/seleccion-piloto-semi-real.md`.

  → **Conviene hacer commit pronto.**
- **Restos que se pueden borrar:** `.artifacts/pkg2.tgz`, `pkg3.tgz` y `fix4.tgz` (son paquetes de despliegue).
- **Artefactos útiles:**
  - `.artifacts/baselines/verify/*.json` (verificación de bases);
  - `.artifacts/real-calibration/` (calibración).

## 7. Pendientes
1. **Recuperar o rehacer F002–F010** y la generalización multi-familia (bloquea el piloto de 20 familias).
2. **Hacer commit** del estrato semi-real en el PC.
3. **Prueba de fuerza de los tests ocultos semi-reales:** introducir mutantes en las referencias y comprobar que los tests los detectan.
4. **Revisión humana** de los enunciados T001–T003 redactados por Claude.
5. **Integrar el estrato semi-real al runner:** seed = commit V0, requisitos = `turns/*.md`, oráculo = tests ocultos + suite. Encaja con el pipeline actual.
6. **Contexto de los modelos:** con 8 192 tokens conviene acotar los cambios a los archivos del `focus` de cada familia.
7. **Documentar** en `operational-decisions.md` y en el estado del proyecto la decisión del estrato semi-real y los criterios de calibración.
