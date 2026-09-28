# Guía para especificar una familia del corpus (F002–F010)

Esta guía fija cómo se materializa una familia nueva para que quede **lista y esperando a los modelos**: especificación completa, fixture determinista, oráculo ejecutable calibrado y validación automática. La generación (V0–V3 por los modelos), la auditoría y el congelamiento se hacen después con los mismos comandos que F001.

F002 (`families/F002-task-board`) es la familia de ejemplo: cualquier duda de formato se resuelve copiando su estructura.

## 1. Archivos de una familia

| Ruta | Contenido |
|---|---|
| `families/Fxxx-slug/family.yaml` | Manifiesto (JSON, como F001). `status: DRAFT`, `reference_versions` nulos, `generation_plan` por rotación, `pilot.initial_request`, `structural_profile`, `fixture` (ruta, sha256, count, summary), `oracle.status`. |
| `families/Fxxx-slug/provenance.yaml` | Procedencia: `specification_materializer: "Claude"`, `artifact_scope: specification_and_neutral_scaffold_only`, modelos nulos, auditoría y similitud `NOT_STARTED`. |
| `families/Fxxx-slug/fixtures/<nombre>.json` + `README.md` | Fixture fijo, sintético, UTF-8/LF. Único archivo JSON de `fixtures/`. |
| `families/Fxxx-slug/requirements/R001–R005.yaml` | Requisitos con criterios `Rxxx-Ayy` y `ui_contract`. R001–R002 en V0; R003 en T001 (V1); R004 en T002 (V2); R005 en T003 (V3). |
| `families/Fxxx-slug/turns/T001–T003.yaml` | Solicitud en lenguaje natural de cada turno (lo que "pide el usuario"). |
| `families/Fxxx-slug/prompts/architecture.md` | Restricciones de arquitectura del perfil estructural (sin mencionar funcionalidades futuras). |
| `families/Fxxx-slug/prompts/generate-v0.md` | Encargo de V0 (dominio, R001–R002, fixture). |
| `families/Fxxx-slug/app/README.md` | Marcador: aplicación aún no generada. |
| `oracle/Fxxx/R001–R005.cases.yaml` | Casos declarativos (uno por criterio): `steps` y `expected` en texto. **Privados**: nunca llegan al constructor. |
| `runner/oracle/families/Fxxx/index.mjs` | Módulo de oráculo: esquema e invariantes del fixture, `CONTROL`, `LISTS`, `PLANS`. |
| `runner/oracle/families/Fxxx/spec-lock.json` | Hash de cada caso (`npm run oracle:lock -- Fxxx`). |
| `tests/fixtures/calibration/Fxxx.html` + `.json` | Página de calibración (implementación de prueba con `?version` y `?mutant`) y tabla de mutantes. |
| `tests/calibration/Fxxx.test.mjs` | `calibrationSuite('Fxxx')`. |

## 2. Reglas de diseño

**Rotación de proveedores.** `generation_plan[Vv] = provider_ring[(n − 1 + v) mod 5]` para la familia `F00n`. Con 10 familias × 4 versiones cada proveedor genera 8 artefactos. La validación lo exige.

**Determinismo.** Nada depende del reloj, la zona horaria, el idioma del navegador ni de `Math.random`. Fechas y "días" vienen del fixture o de acciones explícitas (p. ej. un botón «Avanzar día»). Importes con dos decimales, punto decimal y sin separador de miles; reglas de redondeo explícitas (al céntimo, 0,5 hacia arriba) y casos que eviten empates de redondeo.

**IDs del fixture.** Prefijo de una letra propio de la familia, tres dígitos (`K001`). Prohibidos `R` y `T` (colisionan con requisitos y turnos en los controles de fuga) y los ya usados (`P` F001, `K` F002). Cada lista muestra ítems cuyo texto visible **comienza** con su ID.

**Sin fugas.** Ni el fixture, ni los prompts, ni los requisitos pueden contener: identificadores de requisitos/turnos futuros (`R003`, `T001`…), nombres de proveedores o modelos (openai, anthropic, gemini, qwen, granite, local_a, local_b), `oracle`, `spec-lock`, `plans.mjs`, `SYNTEROLINK`. `prompts/architecture.md` se entrega desde V0: no puede mencionar funcionalidades de R003–R005.

**Preservación (regla crítica).** El oráculo de V3 ejecuta los casos de R001–R005. Por tanto cada caso de un requisito anterior debe seguir siendo verdadero, sin cambios, cuando existen los requisitos posteriores: un requisito nuevo no puede redefinir un valor observable ya comprobado (p. ej. no cambiar la definición de un «Total» ya introducido: introducir el total final solo cuando ya existen todos sus componentes), no puede insertar pasos que alteren un flujo ya comprobado, y los casos anteriores deben quedar dentro de los límites que introduzcan requisitos posteriores (si R005 limita a 3 préstamos, ningún caso anterior presta más de 3). Los campos que se añadan a un formulario existente necesitan valores por defecto que mantengan válidos los casos anteriores. La calibración lo comprueba (la versión V3 correcta debe pasar todos los casos).

**Requisitos.** Cada requisito: 4–7 criterios observables desde la UI. La descripción contiene todos los parámetros operativos (límites, redondeos, órdenes, desempates) para que el constructor no tenga que adivinar. La solicitud del turno (`turns/T00x.yaml`) expresa lo mismo en lenguaje de usuario. Un requisito nuevo no puede contradecir los anteriores (preserves).

**Contrato de interfaz (`ui_contract`).** Es lo único que el oráculo impone sobre el DOM:
- Controles por rol ARIA y nombre accesible exactos: `searchbox`, `combobox` (`<select>`), `textbox`, `spinbutton` (`<input type="number">`), `checkbox`, `radio`, `button`, `status` (`role="status"` + `aria-label`), `alert` (mensajes de validación, sin nombre), `list` (lista con `aria-label`), `listitem`, `field` (inputs sin rol ARIA — password, date — localizados por su `<label>`).
- Dentro de un rol, ningún nombre puede contener a otro (el adaptador también acepta coincidencia por subcadena): la validación lo comprueba.
- Valores de opciones de `<select>` fijados en el contrato (el oráculo selecciona por valor).
- Textos de `status` con formato fijo y etiquetas (`Pendientes: N`, `Total: 12.50`); los planes los leen con `labeled()`/`amount()`.
- Mensajes de `alert` con una subcadena fija.
- Botones dentro de ítems (p. ej. «Avanzar») se declaran en el contrato con su nombre; el plan los pulsa dentro del ítem.
- El resto (estructura, estilos, textos adicionales) es libre.

**Perfil estructural (`structural_profile`) → reglas de arquitectura automáticas** (`runner/pipeline/architecture.mjs`):

| Campo | Regla |
|---|---|
| `reducer: true/false` | exige / prohíbe `useReducer` |
| `effects: true/false/"allowed"` | exige `useEffect` / prohíbe efectos / sin regla |
| `persistence: false/"localStorage"` | prohíbe / exige `localStorage` (sessionStorage, indexedDB y cookies siempre prohibidos) |
| `context: true/false` (opcional) | exige `createContext`+`useContext` / los prohíbe |
| `memoization: true` (opcional) | exige `useMemo` |
| `custom_hooks: true` (opcional) | exige definir hooks propios `use*` |
| `controlled_inputs: true` (opcional) | exige `value`+`onChange` y prohíbe `defaultValue` |
| `state_strategy: useState` o `reducer: false` | exige `useState` |
| `topology: distributed` | exige `useState` en al menos dos módulos |

Siempre: sin `fetch`/red, sin dependencias nuevas, fixture intacto e importado desde `fixtures/`.

## 3. Oráculo

**Casos.** Uno por criterio, mismo ID. `steps` y `expected` concretos (valores exactos). El texto es canónico: el plan debe traducirlo literalmente y el `spec-lock` fija su hash; si cambia el texto hay que revisar el plan y volver a bloquear.

**Planes** (`PLANS['R001-A01'] = async (ui, c, ctx) => {…}`): cada caso empieza en un **contexto de navegador nuevo** (sin almacenamiento local) con la página cargada. `c.eq(label, observado, esperado)` y `c.set(...)` registran comprobaciones. Expectativas derivadas del fixture (`ctx`) o transcritas del caso. Un error `Premisa del caso inválida` indica un fallo del oráculo (no del candidato); cualquier otro error (control ausente, tiempo agotado) es un FAIL del candidato.

**Adaptador genérico** (`runner/oracle/generic-adapter.mjs`), con claves de `CONTROL` y `LISTS`:
`fill, select, click, tryClick, check, exists, enabled, value, checked, text, textOrNull, options, rows, ids, rowText, rowClick, rowTryClick, rowEnabled, rowFill, rowValue, rowCheck, rowChecked, rowAttribute, alerts, bodyText, reload`. Utilidades: `amount`, `amounts`, `integers`, `labeled`. Los planes no usan selectores CSS ni clases: solo roles/nombres del contrato.

**Calibración** (`tests/helpers/calibration.mjs`): la página HTML (vanilla JS, autocontenida, con `const FIXTURE = [...];` idéntico al fixture) implementa V0–V3 según `?version` y defectos según `?mutant`. La suite exige:
1. cada versión correcta pasa todos sus casos;
2. la página de la versión anterior falla **exactamente** los casos del requisito nuevo;
3. ≥ 8 mutantes, al menos uno por requisito, cada uno rechazado por los casos declarados;
4. estabilidad 5/5 en V3.

Cuando la calibración pasa, `family.yaml` pasa a `oracle.status: E2E_CALIBRATED` (y se recalcula el hash si cambia el fixture).

## 4. Comandos

```
npm run oracle:lock -- Fxxx          # tras revisar los planes
npm run corpus:validate -- Fxxx      # especificación + oráculo vinculado
node --test tests/calibration/Fxxx.test.mjs   (todas: npm run test:calibration)
npm run packet:preview -- Fxxx V0    # paquete que recibirá el constructor
npm run generation:preflight -- Fxxx # bloqueos antes de generar
npm run corpus:generate -- Fxxx all  # cuando haya modelos
npm run corpus:audit -- Fxxx --freeze
```
