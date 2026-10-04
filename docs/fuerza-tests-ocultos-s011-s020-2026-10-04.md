# Fuerza de los tests ocultos de S011–S020 (2026-10-04)

**Pregunta:** ¿los tests ocultos de las diez familias nuevas detectan implementaciones incorrectas de cada turno?

**Ejecución:** `scripts\real\mutantes-y-contexto.cmd` en el PC del usuario, 2026-10-04 07:59–08:46 (hora de Lima). Usa la herramienta ya ajustada el 2026-09-29: mutantes en las líneas que añade cada referencia, evaluados con los tests ocultos de T001..T00n, con 8 mutantes por turno como máximo. Las 30 referencias pasan sus tests ocultos.

| Familia | Eliminados | Sobreviven | No compila | Puntuación bruta |
|---|---|---|---|---|
| S011 | 7 | 1 | 1 | 0,88 |
| S012 | 15 | 2 | 0 | 0,88 |
| S013 | 7 | 0 | 0 | 1,00 |
| S014 | 9 | 1 | 0 | 0,90 |
| S015 | 4 | 1 | 0 | 0,80 |
| S016 | 8 | 3 | 0 | 0,73 |
| S017 | 12 | 3 | 0 | 0,80 |
| S018 | 12 | 6 | 0 | 0,67 |
| S019 | 18 | 1 | 0 | 0,95 |
| S020 | 9 | 6 | 0 | 0,60 |
| **Total** | **101** | **24** | **1** | **0,81** |

Evidencia: `docs/verification/real-mutants-s011.json` … `real-mutants-s020.json`.

## Triaje de los 24 sobrevivientes

Cada sobreviviente se comparó con la petición visible (`turns/T00n.md`), el test oculto y la referencia. Evidencia en `docs/verification/mutants-triage/mutants-S0xx.json`. Revisor: Claude. Conviene una segunda revisión independiente, como en S001–S010.

| Veredicto | N | Detalle |
|---|---|---|
| EQUIVALENT | 18 | Props de estilo (S014 clase de variante, S015 `c="dimmed"`, S020 `kind`); `aria-hidden` de un icono con el nombre en `aria-label` (S016); claves de traducción nuevas sin entrada en los idiomas, que muestran el texto por defecto (S020 ×4); `null`/`undefined` ante una comprobación por veracidad (S017 ×2, S020); `type` de un botón fuera del formulario (S017); `preventDefault` sin acción por defecto (S011); contabilidad interna del temporizador sin efecto en el estado (S018 ×3); variante por defecto normalizada a `info` (S018); `text/csv`, que la regla general ya convierte en «CSV» (S019) |
| UNSPECIFIED | 0 | — |
| WEAKNESS | 6 | La petición exige el comportamiento y el test no lo detectaba |

Descontando los equivalentes, la puntuación es 101 / (101 + 6) = **0,94**.

## Tests ocultos reforzados (las 6 debilidades)

| Familia | Turno | Adición | Punto de la petición |
|---|---|---|---|
| S012 | T002 | Tras un fallo, pulsar Cancel quita el `role="alert"` | 3: «al cerrar el diálogo» |
| S012 | T002 | Se sigue llamando a `notify('ra.page.error', …)` (`useNotify` simulado con `vi.mock` parcial de react-admin) | 4 |
| S016 | T001 | Cambiar un filtro llama a `onSubmitKeywords("oksigen", {lokasi: ["Bandung"]}, "")` | 1: «al cambiar un filtro» |
| S016 | T001 | Cambiar el orden llama a `onSubmitKeywords("oksigen", {}, "terbaru")` | 1: «al cambiar el orden» |
| S018 | T001 | Sin aviso visible no queda ningún escuchador `keydown` en `document` ni en `window` | 3 |
| S018 | T001 | Al desmontarse, se retira el escuchador añadido | 3 |

Los tests nuevos no se han podido ejecutar desde la nube (sin acceso al registro de npm). Por eso S012, S016 y S018 se recalibran y se vuelven a medir con mutantes en el PC (`scripts\real\recalibrar-reforzadas.cmd`).

## Contexto de las 20 familias

`docs/verification/real-context.json` (2026-10-04): el primer mensaje de V1 cabe en las tres ventanas medidas (8192, 16384 y 32768 tokens). Cuando la vista completa no cabe, se reduce al árbol o al directorio de la zona del cambio. El margen más ajustado es el de S014 con 32768 tokens: entra el árbol completo sin contenidos y quedan 199 tokens.
