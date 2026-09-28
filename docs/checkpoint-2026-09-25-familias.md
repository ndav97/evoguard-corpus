# Checkpoint 2026-09-25 — preparación de las familias F002–F010

Objetivo de esta etapa: dejar las 9 familias restantes del piloto **listas y esperando a los modelos** (especificación, fixture, oráculo calibrado y pipeline preparado para varias familias), sin tocar la F001 congelada.

## 1. Hecho

### 1.1 Pipeline generalizado a varias familias (F001 intacta)
- **Descubrimiento de familias** (`runner/families.mjs`): las familias se detectan por directorio (`families/Fxxx-slug/`). La rotación de proveedores es «por fila»: la familia `F00n` asigna a `Vv` el proveedor `provider_ring[(n−1+v) mod 5]`. Así cada proveedor genera 8 de los 40 artefactos, y el test lo comprueba.
- **Esquemas relajados solo donde hacía falta:**
  - Perfiles estructurales nuevos: `useReducer`, estado distribuido, Context, hooks propios, `useMemo`, `localStorage` y formularios controlados.
  - En el fixture: `pilot.initial_request` y `summary`.
  - En `provenance`: `created_at` libre y materializador `Claude`.
  - Roles nuevos de `ui_contract`: `textbox`, `checkbox`, `spinbutton`, `radio`, `alert`, `heading`, `list` y `field`.
- **Validación por familia y global** (`npm run corpus:validate [-- Fxxx]`):
  - Invariantes del fixture declaradas por el módulo de la familia.
  - Coincidencia entre `CONTROL`/`LISTS` y el `ui_contract`.
  - Nombres de controles sin ambigüedad por subcadena.
  - `spec-lock` al día.
  - Prefijos de ID distintos entre familias.
  - `experimental_frozen` coherente.
- **Paquete y prompts:**
  - `prompts/common.md` queda genérico. Nueva instrucción: los avisos de validación los muestra la app con `role="alert"`, no la validación nativa del navegador.
  - Cada familia tiene `prompts/architecture.md` y `prompts/generate-v0.md`.
  - F001 conserva la clave `products`; las familias nuevas reciben `fixture` y `fixture_path`.
  - La política de contexto de los modelos locales también omite el fixture de las familias nuevas.
- **Seed y linaje:** admiten cualquier fixture único `fixtures/*.json` y un `familyId`.
- **Arquitectura** (`runner/pipeline/architecture.mjs`): las reglas se derivan del `structural_profile`. Con el perfil de F001 las reglas son las mismas que antes.
- **Oráculo:**
  - Registro de módulos por familia en `runner/oracle/families/Fxxx/` (`index.mjs` + `spec-lock.json`).
  - Adaptador genérico por roles y nombres accesibles (`generic-adapter.mjs`).
  - Cada caso se ejecuta en un contexto de navegador nuevo, así el `localStorage` queda aislado.
  - El paquete del contenedor del oráculo se arma por familia.
  - `npm run oracle:lock -- Fxxx` regenera el lock de una familia.
- **Pipeline:** `store`, `generate`, `audit`, `preflight`, `packet:preview` y `evaluator` aceptan una familia (`npm run corpus:generate -- F005 all`, `npm run corpus:audit -- F005 --freeze`, `npm run generation:preflight -- F005`). Sin argumento siguen trabajando sobre F001.
- **Entorno reverificado en la nube** con la misma imagen (`sha256:3ed948d6…`): `environment:verify` PASS. Ensayo integral `pipeline:rehearse` PASS, con la huella de las fuentes actualizada.
- **Preflight:** F002–F010 quedan despejadas. F001 sigue bloqueada por FROZEN, como corresponde.

### 1.2 Familias F002–F010 materializadas (estado DRAFT, oráculo `E2E_CALIBRATED`)

| Familia | Dominio | Perfil estructural | Casos (V0/V1/V2/V3) | Mutantes |
|---|---|---|---|---|
| F002 task-board | Tablero de tareas: filtro, avanzar, crear, resumen, deshacer | useReducer | 10/16/21/27 | 18 |
| F003 cart-checkout | Carrito: cantidades, cupones, impuesto por región, envío/total | useState distribuido por props (sin Context) | 11/17/23/30 | 19 |
| F004 signup-wizard | Registro por pasos: validación, provincia condicional, plan, reglas cruzadas | Formularios controlados | 11/17/23/29 | 20 |
| F005 notes-local | Notas: búsqueda, crear+persistir, etiquetas, fijar, eliminar/deshacer | useEffect + localStorage | 11/17/23/30 | 27 |
| F006 gradebook | Calificaciones: nota ponderada, edición, letras, pesos, riesgo | useMemo (derivado) | 12/17/23/29 | 24 |
| F007 room-booking | Reservas: conflictos, cancelar, vista semanal, capacidad | useReducer + fechas fijas | 12/17/22/28 | 16 |
| F008 expenses-context | Gastos: mes, total EUR, alta, presupuestos, moneda de visualización | Context API | 9/15/21/27 | 17 |
| F009 quiz-machine | Cuestionario: responder, puntuación, revisión, semilla, rachas | Máquina de estados con useReducer | 12/17/24/30 | 15 |
| F010 library-loans | Préstamos: prestar/devolver, días y vencidos, renovaciones, límites e historial | Hooks propios + localStorage | 11/17/23/30 | 18 |

Cada familia incluye:
- `family.yaml` y `provenance.yaml`.
- El fixture determinista con su README.
- R001–R005 con `ui_contract`.
- T001–T003.
- Los prompts propios.
- Los casos en `oracle/Fxxx/`.
- Los planes y el `spec-lock`.
- La página de calibración con `?version` y `?mutant`, en `tests/fixtures/calibration/`.
- Su suite en `tests/calibration/Fxxx.test.mjs`.

Cada suite exige:
- que cada versión correcta pase todos sus casos;
- que la versión anterior falle exactamente los casos del requisito nuevo;
- que todos los mutantes sean detectados;
- estabilidad 5/5 en V3.

Todas pasaron al calibrarlas una por una.

Guía de autoría: `docs/family-authoring.md`. Incluye la regla de **Preservación**: los casos anteriores deben seguir siendo verdaderos en V3.

### 1.3 Pruebas
- `npm test`: **179/179** (unitarias, contrato, F001 E2E, pipeline, sandbox y `tests/families.test.mjs`).
  - `tests/families.test.mjs` cubre la validación conjunta, la rotación 8/8/8/8/8, la ausencia de fugas en los paquetes V0–V3, el seed de cada familia, la diversidad de perfiles y las reglas de arquitectura.
- `npm run test:calibration`: las 9 suites E2E. Se separaron de `npm test` porque en total tardan más de una hora con 2 núcleos.

### 1.4 Decisiones tomadas (documentar en `operational-decisions.md`)
1. Rotación por fila `RING[(n−1+v) mod 5]`.
2. Las funcionalidades de cada familia no redefinen observables anteriores. Por ejemplo, el total final solo se introduce en V3 (F003 «Total a pagar») y el plan de F004 se elige en el paso Resumen, sin añadir pasos.
3. Renombrados para evitar ambigüedad por subcadena: F003 «Total a pagar» (frente a «Subtotal») y F008 «Divisa» (frente a «Moneda de visualización»).
4. F009: la mejor racha se conserva al reiniciar; solo se pierde al recargar.
5. F010: dos préstamos del mismo libro comparten ID en «Préstamos»; los casos actúan sobre el primero.
6. F007: el plan acepta «–», «-» o «—» entre las horas.

## 2. Pendiente

### Lo hago yo (sin modelos)
1. **Terminar la corrida conjunta** de `npm run test:calibration`. Al hacer este checkpoint estaba en curso; cada familia ya había pasado por separado.
2. **Revisión independiente de equidad del oráculo** (F002–F010). Hay que buscar comprobaciones que no se deducen del texto visible para el constructor, ambigüedades, problemas de preservación y fragilidad del adaptador; después, corregir los requisitos o casos y volver a hacer lock y calibración. La lancé y se interrumpió en este checkpoint.
3. **Revisar los 9 mutantes de F009** que están implementados en la página pero no declarados en `F009.json`, y añadir los que la suite detecte.
4. **Ensayo de generación y auditoría de punta a punta en una familia nueva** con un constructor instrumental (sin modelos). Sirve para probar en contenedor el paquete del oráculo por familia y el control de arquitectura por perfil.
5. **Revisión de similitud entre especificaciones** (dominios, perfiles y requisitos) y registro de la evidencia.
6. **Documentación:** `operational-decisions.md`, `execution-ledger.md`, `estado-del-proyecto` (repositorio y Project) y los README de `runner/`.
7. **Sincronizar y hacer commit en tu PC** del resto del trabajo tras cada tarea.

### Lo haces tú (cuando haya modelos)
1. **Proveedor comercial:** `npm run providers:diagnose` cuando Synterolink confirme que funciona.
2. **Modelos locales:** banco en Vast.ai (`docs/gpu-vast-ai.md`), elegir `local_a`/`local_b`, recongelar `config/models.json` y recalibrar el contexto (`npm run context:calibrate -- --write`).
3. **Tras esos cambios:** `npm run environment:verify` y `npm run pipeline:rehearse` (la imagen no cambia).
4. **Generar cada familia:** `npm run generation:preflight -- Fxxx`, luego `npm run corpus:generate -- Fxxx all` y `npm run corpus:audit -- Fxxx --freeze`.
5. **F001:** regenerar como revisión 2 con el protocolo 1.1, si se decide.
