# Revisión independiente de las peticiones S011–S020 y del triaje de mutantes (2026-10-04)

## Peticiones

**Pregunta:** en los 30 turnos de S011–S020, ¿dicen lo mismo la petición visible, los tests ocultos, la referencia y el código V0? Se buscaron contradicciones, requisitos ocultos, ambigüedades, filtraciones, conflictos entre turnos y tests existentes que una implementación razonable rompería.

**Método:** tres revisores independientes, que no participaron en la autoría (S011–S013, S014–S017 y S018–S020), con el mismo criterio que la revisión de S001–S010 del 2026-09-29. Contrastaron el código V0 de cada repositorio. Evidencia en `docs/verification/request-review/requests-S011.json` … `requests-S020.json`.

**Resultado:** 0 hallazgos altos, 4 medios y 5 bajos. No hay contradicciones, filtraciones ni conflictos entre turnos. S013, S014, S017, S019 y S020 no tienen hallazgos.

### Correcciones aplicadas

| Familia | Turno | Severidad | Cambio |
|---|---|---|---|
| S011 | T003 | media | La petición pide atender la tecla con el `onKeyDown` estándar del `<input>`, no con `onPressEnter` de antd. El test sustituye el campo por un `<input>` nativo, que ignora `onPressEnter` |
| S012 | T002 | baja | El aviso se limpia al cerrar en el mismo manejador que vacía el nombre. El diálogo sigue montado; en el test el estado `open` no cambia |
| S015 | T002 | media | Sin mensaje no debe haber ningún `role="status"`, ni siquiera vacío. Es el mismo caso que S007 T002 |
| S018 | T001 | media | Sin aviso visible no queda registrado ningún escuchador de teclado en `document` ni en `window`; se retira al ocultarse o desmontarse. Lo exige el test añadido tras el triaje de mutantes |
| S018 | T001 | baja | Escape se atiende con el evento `keydown` |
| S018 | T003 | baja | Un estado del aviso sin `variant` cuenta como `'info'` |

### Sin cambio (anotados)

- **S011 T002 (baja):** `aria-label` en un `<span>` sin rol. ARIA 1.2 lo desaconseja y algunos lectores lo ignoran, pero ningún test lo comprueba y no hace fallar a nadie.
- **S016 T002 (media, pendiente):** la referencia de «Kosongkan kata kunci» no cancela la búsqueda automática pendiente. Con `autoSearch`, si se escribe y se borra en menos de 300 ms, la búsqueda antigua se ejecuta después. No penaliza a ninguna implementación, porque ningún test lo exige. Corregirlo requiere cambiar la referencia (`debouncedSearch.cancel()`) y el test a la vez, y comprobar cómo trata `ts-debounce` las promesas canceladas. Se hará cuando se pueda iterar en el PC, como se hizo con S010 T002.
- **S016 T003 (baja):** al pasar rápido de `ab` a `a`, la búsqueda pendiente con `ab` se ejecuta igualmente. No afecta a los tests.

## Triaje de mutantes: segunda revisión

Un revisor independiente clasificó los 24 sobrevivientes de la primera medición sin ver el primer triaje. Evidencia: `docs/verification/mutants-triage/mutants-S011-S020-independiente.json`.

| | Primer triaje | Revisión independiente |
|---|---|---|
| EQUIVALENT | 18 | 16 |
| WEAKNESS | 6 | 8 |

Coinciden en 22 de 24. Las dos discrepancias:

- **S018 T002 `toast.js:8` (`if (!hideTimer)`).** El primer triaje lo dio por equivalente porque no tiene efecto visible: cualquier `showToast` posterior cancela igualmente el temporizador. El revisor señala que el punto 2 de la petición exige cancelar el cierre automático al cerrar el aviso, y el revisor de peticiones de S018 hizo la misma observación. **Se acepta como debilidad.** Test añadido en T002: «al cerrar el aviso no queda ningún cierre automático pendiente» (`jest.getTimerCount()` vuelve al valor anterior).
- **S014 T001 `Timer.tsx:115`.** El mutante cambia el estilo de los temporizadores no secundarios. La línea ya existía en V0 y la referencia solo la reformatea, así que es una cuestión de no regresión visual que la petición protege con «los estilos no cambian». **Se anota como debilidad menor sin refuerzo:** comprobar clases de módulos CSS en un test oculto ataría la evaluación a detalles de implementación.

Con esto quedan 7 de 8 debilidades corregidas. La de S018 se verifica con `scripts\real\recalibrar-reforzadas.cmd -Familias S018`.

**Verificación (2026-10-04, 14:51 hora de Lima):** S018 se recalibró con el test nuevo de T002 y pasa los tres turnos. En T002 fallan antes 3 de 5 tests. El mutante `toast.js:8` queda eliminado: S018 pasa a 15 eliminados y 3 sobrevivientes, todos equivalentes (puntuación bruta 0,83).
