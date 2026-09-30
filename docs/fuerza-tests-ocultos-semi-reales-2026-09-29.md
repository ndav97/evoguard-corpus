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

## Segunda ejecución (2026-09-29, 10:10–10:31 hora de Lima)

Con la herramienta ajustada y los tests reforzados:
- **Referencias:** las 30 pasan los tests ocultos ampliados de T001..T00n.
- **Resultado:** 144 eliminados, 17 sobrevivientes, 8 que no compilan y 0 errores. **Puntuación bruta 0,89**; por familia, entre 0,80 (S010) y 1,00 (S007).

Los 17 sobrevivientes:

| Tipo | N | Detalle |
|---|---|---|
| Ya clasificados como equivalentes | 7 | S002 `type` sin formulario, S003 tipo TypeScript y clamp, S005 `preventDefault` de Escape, S006 `onBlur` del llamador, S008 tipo `Promise`, S009 `return null`→`undefined` y la guarda de `watchlist` |
| Ya clasificados como no especificados | 4 | S004 `.catch`, S005 `setHasSaved`, S008 `setPending` en éxito, S009 `title` no pedido |
| Nuevo, equivalente | 1 | S001 `bind` del método: el `onClick` usa una función flecha |
| Nuevo, debilidad | 1 | S001 T003: el botón se quedaba deshabilitado al terminar. Corregido: el test de éxito exige que vuelva a estar habilitado («Mientras haya peticiones pendientes, el botón queda deshabilitado») |
| Pendiente conocido | 3 | S010 T002, cableado de `applications-list.tsx` (test de integración por hacer) |

Sin contar equivalentes ni no especificados, la puntuación es 144 / (144 + 4) = **0,97**. Tras el refuerzo de S001, los únicos sobrevivientes con debilidad real son los 3 de S010 T002.

**S001 verificado** (22:23 UTC): la referencia pasa los 20 tests ocultos, el mutante de la línea 121 se elimina y S001 queda en 0,93. Solo sobrevive el `bind`, que es equivalente. La escritura del informe falló con EPERM en Windows, así que el resultado se transcribió de la consola (campo `rerun_2026_09_29`).

**S010 T002, test de integración verificado** (2026-09-30 00:42 UTC):
- **Qué hace el test:** monta `ApplicationsList` en la vista Summary con los servicios simulados y sustituye solo las piezas de la página que no intervienen: marco, barra superior, paginación, filtros laterales y paneles de sincronización. Sustituye además `lodash-es` como hacen los propios tests del proyecto. Después pulsa `OutOfSync (1)` y `Degraded (1)` y comprueba que `updatePreferences` recibe el filtro correspondiente sustituido por `[status]` y el otro sin cambios.
- **Referencias:** T002 y T003 pasan con 12 y 17 tests ocultos.
- **Mutantes:** los tres de `applications-list.tsx` (líneas 521, 525 y 528) se eliminan. S010 queda en **1,00**.

## Resultado final

| Familia | S001 | S002 | S003 | S004 | S005 | S006 | S007 | S008 | S009 | S010 |
|---|---|---|---|---|---|---|---|---|---|---|
| Puntuación | 0,93 | 0,94 | 0,90 | 0,95 | 0,88 | 0,94 | 1,00 | 0,85 | 0,82 | 1,00 |

**Global:** 148 mutantes eliminados, 13 sobrevivientes y 8 que no compilan. **Puntuación bruta 0,92.**

Los 13 sobrevivientes ya están clasificados: 9 equivalentes y 4 con un comportamiento que la petición no exige, que por equidad no deben comprobarse. **No queda ninguna debilidad conocida:** sin contar esos casos, la puntuación es 148 / 148 = 1,00.

**Herramienta:** si la referencia no pasa sus tests ocultos, `real:mutants` muestra ahora el error de la suite o los tests que fallan. Si Windows impide escribir el informe (EPERM por el atributo de solo lectura), quita ese atributo y, si aun así no puede, guarda el informe en `.artifacts/`.
