# Revisión sistemática de las peticiones semi-reales (2026-09-29)

**Pregunta:** en los 30 turnos de S001–S010, ¿la petición visible (`turns/T00n.md`), la referencia de calibración y los tests ocultos dicen lo mismo? Se buscan contradicciones, requisitos ocultos, ambigüedades, filtraciones, conflictos entre turnos y problemas de redacción que hagan fallar a un modelo competente sin culpa suya o aprobar a uno que no cumple.

**Método:** tres revisores independientes (S001–S003, S004–S007 y S008–S010) cruzaron cada turno. Donde había copia local del repositorio (kopia, gradebook, authelia, fx-private-relay y el `ui/src` de argo-cd) la contrastaron también con el código V0. Evidencia en `docs/verification/request-review/requests-Sxxx.json`.

**Resultado:** 0 hallazgos de severidad alta, 11 medios y 10 bajos. Ninguno haría fallar con seguridad a una implementación correcta, pero varios podían hacerlo con implementaciones razonables.

## Correcciones aplicadas (21)

**En la petición visible (17).** Se hace explícito lo que el test exige:

| Familia | Turno | Aclaración |
|---|---|---|
| S001 | T001 | `Showing N of M tasks` en un elemento propio, sin texto adicional |
| S001 | T003 | Terminadas las peticiones, el botón vuelve a habilitarse aunque las tareas sigan `RUNNING` |
| S002 | T001 | Filtrar en `HistoryTable` y pasar a `DataTable` solo las filas filtradas |
| S002 | T001 | Textos literales, sin `messages.js`: los tests existentes renderizan sin `IntlProvider` |
| S002 | T002 | `<select>` nativo, con el nombre de usuario como texto y valor de la opción |
| S002 | T003 | La clase `wrap-text-in-cell` va en el propio botón |
| S003 | T001 | La clave i18n es el propio texto en inglés, porque en los tests no se cargan traducciones |
| S003 | T002 | El texto del requisito es exactamente `✓/✗ <requisito>`, sin texto oculto ni símbolo por CSS |
| S003 | T002 | Singular con N = 1 (cosmético) |
| S004 | T001 | El título `Inputs` no cambia |
| S004 | T002 | La validación es inmediata, mientras se escribe |
| S004 | T003 | `Recommended M: <valor>` va en un mismo elemento |
| S006 | T001 | El resumen `Offset: …` va en un único elemento de texto |
| S007 | T002 | Sin resultados no se renderiza ningún `role=status`, tampoco vacío |
| S007 | T003 | Escape se implementa en el manejador existente, que actúa al soltar la tecla |
| S008 | T002 | La etiqueta es accesible (p. ej., `label` de `TextField`) |
| S008 | T003 | El único texto del aviso es `t('deleteFailed')` |
| S009 | T001 | El nombre accesible es exactamente la acción (p. ej., con `aria-label`), sin el contenido visible |

**En los tests ocultos (3):**
- S005 T003: el test de «no guarda dos veces» ahora edita el campo antes de pulsar «Remove label». Antes solo lo enfocaba y no comprobaba nada.
- S007 T002: el `rerender` reutiliza el `searchRef` de `setup`. El test creaba uno nuevo sin necesidad.
- S010 T002: el sustituto de `lodash-es` incluye también `isEqual`.

**En la referencia (1):** S005 T003 no cumplía su propia petición. Con cambios pendientes, pulsar «Remove label» guardaba el valor editado al perder el foco y después la etiqueta vacía. El botón evita ahora que el campo pierda el foco (`onMouseDown` con `preventDefault`), y la referencia cumple «una sola vez».

## Verificación pendiente (PC)

- `npm run real:mutants -- S005 S007 S010`: comprueba que las referencias pasan los tests cambiados y cuánto detectan.
- `scripts\real\ensayar-familias.cmd -Familias S005`: ensayo con la referencia corregida de S005.
