# Autoría de familias semi-reales

Esta guía explica cómo se prepara una familia `families-real/Sxxx-slug/` hasta dejarla **CALIBRATED** y lista para generar. Se escribió al ampliar el piloto a 20 familias semi-reales (2026-10-02). S001–S010 sirven de ejemplo.

## 1. Elegir la base V0

- **Origen:** la base sale de las bases verificadas (`.artifacts/baselines/resultado-verificacion.json`, `scripts/mine/repos-v0.txt`). Sirven las que están en estado `GREEN` o `GREEN_WITH_KNOWN_FAILURES`.
- **Criterios del piloto:**
  - un repositorio por organización (no repetir ninguna de las ya usadas);
  - dominios distintos;
  - mezcla de runners vitest/jest;
  - paquete de tamaño manejable.
- **Bases que no sirven:**
  - **Gestor de paquetes no soportado.** `real-family.schema.json` admite npm, pnpm y yarn. Ejemplo: `moollaza/repo-remover`, que usa bun.
  - **Tests que no se ejecutan directamente.** El pipeline ejecuta `npx vitest run` o `npx jest --ci` en el paquete. No sirve un repositorio que necesite `craco test` / `react-scripts test` (`hotosm/tasking-manager`).
  - **Tests que dependen de código generado que no está en el repositorio.** Ejemplo: `kafbat/kafka-ui`, que necesita `src/generated-sources`; su verificación solo ejecutó 79 tests de 143 archivos.
  - **Tests en modo navegador** (vitest `--browser`), como `BearStudio/start-ui-web`.

## 2. Elegir la zona del cambio

- **Foco:** un componente o módulo con tests propios en el repositorio, que se pueda montar en aislamiento con los *helpers* de test del proyecto (`renderWithProviders`, `reduxRender`, `TestContext`, …).
- **Turnos:** los tres son cambios **acumulativos** en esa zona. Cada turno añade o corrige un comportamiento observable y conserva los anteriores (regla de preservación).
- **Límite:** evitar zonas que obliguen a tocar configuración, dependencias o tests existentes, porque el control de alcance lo bloquea.

## 3. Archivos

| Archivo | Contenido |
|---|---|
| `family.yaml` | Repositorio, commit V0 (SHA completo), paquete, gestor, runner, Node, `workspace` (carpeta en la caché de verificación: `github__<owner>__<repo>`), `hidden_tests_dir`, `known_failures`, `focus`, turnos, procedencia y plan de generación por rotación. Se empieza con `provenance.status: DRAFT` |
| `turns/T00n.md` | Petición visible para el modelo, en español, con los textos de interfaz literales |
| `oracle/T00n.test.*` | Tests ocultos del turno, con el estilo y los *helpers* del repositorio |
| `reference/T00n.patch` | Implementación de referencia, **relativa al paquete**, aplicada sobre V0 + referencias anteriores |

## 4. Reglas que comprueba el validador

1. **Directorio:** se llama `Sxxx-<slug>`. El plan es `provider_ring[(n − 1 + v) mod 5]` para V1–V3.
2. **Material privado:** la petición no menciona material privado: `oracle`, `evoguard`, «hidden tests», «reference patch», `calibra…`, ni nombres de proveedores o modelos. Tampoco menciona turnos futuros.
3. **Alcance del parche:** no toca `package.json`, lockfiles, configuración de tests, build o lint, `.github/`, ni tests existentes.
4. **Sin fugas:** ninguna línea de más de 40 caracteres de los tests ocultos o del parche de referencia puede aparecer en la petición. Si un texto de interfaz literal es largo, hay que acortarlo (por ejemplo, `Could not save the playlist.`).
5. **Directorio de tests ocultos:** `hidden_tests_dir` debe quedar dentro de lo que recoge la configuración de tests del repositorio. Ejemplos:
   - `src/evoguard` con un `include: ['src/**/*.test.*']`;
   - `components/evoguard/__tests__` si el `testMatch` exige `__tests__`;
   - `client/evoguard` si el proyecto `client` de jest solo mira `client/**`.

## 5. Calibración y preparación (en el PC, con Docker)

```powershell
scripts\real\calibrar-familias-reales.cmd -Familia S011   # usa la base instalada en el volumen evoguard-bases
```

**Qué comprueba la calibración, por turno:**
- antes del cambio, los tests ocultos del turno fallan y los de turnos anteriores pasan;
- después del cambio, pasan todos los tests ocultos y la suite completa no tiene regresiones;
- dos ejecuciones dan el mismo resultado.

**Si la suite ya tenía fallos en V0** (bases `GREEN_WITH_KNOWN_FAILURES`), hay que copiar sus nombres a `known_failures` y repetir la calibración.

**Cuando la familia queda en OK:**
1. Pasar a `provenance.status: CALIBRATED`, con `calibrated_at` y los recuentos de fail-to-pass.
2. Preparar la imagen y ensayar:
   ```powershell
   scripts\real\preparar-imagenes.cmd -Familias S011
   scripts\real\ensayar-familias.cmd -Familias S011
   npm run real:mutants -- S011
   npm run real:context
   ```
3. Pedir una revisión independiente de las peticiones, como en `docs/revision-peticiones-semi-reales-2026-09-29.md`.

Mientras una familia está en DRAFT, `npm run corpus:validate` la lista como «pendiente de calibrar» y el preflight bloquea su generación.
