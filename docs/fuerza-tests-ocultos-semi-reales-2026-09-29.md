# Fuerza de los tests ocultos semi-reales (2026-09-29)

**Pregunta:** ¿los tests ocultos de S001–S010 detectan implementaciones incorrectas de cada turno?

**Primera ejecución** (`npm run real:mutants`, PC del usuario, 8 mutantes por turno como máximo):
- **Cómo:** se mutaron las líneas que añade cada referencia de calibración y cada mutante se ejecutó contra los tests ocultos del turno.
- **Resultado:** 136 eliminados, 57 sobrevivientes y 7 que no compilan. Puntuación bruta 0,70 (por familia, entre 0,50 y 0,82).
- **Evidencia:** `docs/verification/real-mutants-sxxx.json` (commit `7fa3b4a`).

## Triaje de los 57 sobrevivientes

Dos revisores independientes (S001–S005 y S006–S010) clasificaron cada sobreviviente comparando la petición visible (`turns/T00n.md`), el test oculto y la referencia. Evidencia en `docs/verification/mutants-triage/`.

| Veredicto | N | Significado |
|---|---|---|
| EQUIVALENT | 37 | Sin cambio observable (props de estilo, className, tipos de TypeScript, `controlId` coherente, ramas inalcanzables) |
| UNSPECIFIED | 5 | Cambio observable que la petición no exige; un test oculto no debe comprobarlo (equidad) |
| WEAKNESS | 15 | La petición exige el comportamiento y el test no lo detectaba |

Descontando los equivalentes, la puntuación es 136 / (136 + 20) = **0,87**. Si además se descuentan los no especificados, es 136 / (136 + 15) = **0,90**.

## Correcciones

**Tests ocultos reforzados (13 de las 15 debilidades).** Cada adición comprueba solo lo que dice la petición, mediante roles, nombres accesibles y textos citados:

| Familia | Turno | Adición |
|---|---|---|
| S002 | T003 | `mapHistoryRows(fila)` muestra el usuario en `<span class="wrap-text-in-cell">`, sin botón |
| S003 | T001 | Modo ZXCVBN con puntuación 0 → «Strength: Very weak» |
| S004 | T001 | Reset también restablece «Elements Per Row»; el encabezado «Inputs» sigue presente |
| S004 | T003 | «Copied to clipboard» no aparece antes de copiar |
| S005 | T002 | Tras cancelar con Escape, una edición nueva se guarda con Enter |
| S005 | T003 | El botón de quitar tiene `type="button"` |
| S006 | T003 | Las horas escritas a mano cuentan en el total normalizado |
| S008 | T003 | Sin fallo no hay aviso; al cerrar y reabrir desaparece el aviso; el aviso es exactamente `t('deleteFailed')` |
| S010 | T002 | Las entradas de la leyenda son `type="button"` |
| S010 | T003 | NEEDS ATTENTION aparece después de NAMESPACES |

**Pendiente (2 debilidades, S010 T002 punto 6):** que el resumen esté conectado con `applications-list.tsx`, incluido el intercambio de `syncFilter` y `healthFilter`. Hace falta un test de integración de `ApplicationsList` con sus servicios simulados. Escribirlo sin poder ejecutarlo contra el repositorio sería frágil, así que se hará cuando se pueda iterar en el PC. Hasta entonces, una solución que no conecte el resumen aprobaría T002.

**Petición corregida (S008 T001–T003):** las peticiones indicaban `src/locales/en/translation.json`, pero el archivo de traducciones del repositorio (el que modifica la referencia y el que leen los tests) es `public/locales/en/translation.json`. Un modelo que siguiera la petición al pie de la letra habría fallado sin culpa. La ruta se corrigió en las tres peticiones.

**Anotaciones sin cambio:**
- S005 T003: con cambios pendientes en el campo, la referencia guarda al perder el foco antes de quitar la etiqueta. El test oculto solo cubre el caso sin cambios, así que ninguna implementación queda penalizada; la referencia solo se usa para calibrar.
- S009 T001: la referencia añade un `title` que la petición no pide. No se comprueba.
- S003 T003: `min_score` no está acotado en la petición y la referencia lo limita a 4. Es inocuo.

## Herramienta ajustada

- Cada mutante se evalúa con los tests ocultos de **T001..T00n**, como el oráculo de esa versión, y no solo con los del turno.
- El operador de texto ya no muta props de estilo o identificación (`className`, `size`, `variant`, `controlId`…), claves de módulos CSS ni posiciones de tipo. Los literales se detectan con un analizador que respeta comillas y escapes.

**Siguiente paso (PC):** `npm run real:mutants -- S001 … S010` con la herramienta y los tests nuevos. Confirma que cada referencia pasa los tests ampliados y da las puntuaciones definitivas.
