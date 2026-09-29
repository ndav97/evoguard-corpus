# Revisión independiente de la equidad de los oráculos F002–F010 (2026-09-29)

**Pregunta:** ¿hay comprobaciones del oráculo oculto que un modelo no pueda deducir del paquete visible? El paquete visible incluye los requisitos, los criterios de aceptación, el `ui_contract`, el fixture y los prompts.

**Método:**
- Tres revisores separados, sin participación en la autoría (F002–F004, F005–F007 y F008–F010), revisaron caso por caso los 260 casos.
- Cruzaron cada plan (`runner/oracle/families/Fxxx/index.mjs`) y el adaptador genérico con el paquete V3 visible.
- Clasificaron cada caso como DERIVABLE, AMBIGUOUS o NOT_DERIVABLE, y anotaron también los problemas transversales.
- Después de las correcciones, uno de ellos las volvió a comprobar punto por punto, incluso ejecutando el adaptador en Chromium.

Evidencia en `docs/verification/fairness/`: `findings-Fxxx.json` (revisión) y `recheck-2026-09-29.json` (reverificación).

## Resultado de la revisión

| Familia | Casos | DERIVABLE | AMBIGUOUS | NOT_DERIVABLE |
|---|---|---|---|---|
| F002 | 27 | 25 | 2 | 0 |
| F003 | 30 | 29 | 1 | 0 |
| F004 | 29 | 29 | 0 | 0 |
| F005 | 30 | 26 | 4 | 0 |
| F006 | 29 | 23 | 6 | 0 |
| F007 | 28 | 14 | 14 | 0 |
| F008 | 27 | 27 | 0 | 0 |
| F009 | 30 | 20 | 10 | 0 |
| F010 | 30 | 30 | 0 | 0 |

Ninguna regla de negocio oculta: todos los importes, órdenes y estados esperados se recalcularon desde el fixture y coinciden con las reglas visibles. Las ambigüedades venían de **cómo lee la interfaz el oráculo**:

1. **Texto concatenado (alta, transversal):** el adaptador leía `textContent`, así que `<span>K001</span><span>Título</span>` daba «K001Título». La fila no se reconocía, y las expresiones «Letra: X», «N personas» y «Correcto…» fallaban cuando un botón o un elemento iba pegado. Un desarrollador que separa las partes con CSS cumple el contrato («texto visible») y fallaba.
2. **Separador del formato (media):** varios planes exigen «ID + espacio + título» (F007: ID, horas y título), pero el contrato solo lo mostraba como ejemplo («p. ej.»).
3. **Otros (media o baja):**
   - F003 exigía un único importe en cada status, cuando el contrato dice «incluye».
   - F004 exigía un único nombre de paso en «Paso».
   - F009 no toleraba puntuación entre el ID y el veredicto, pese a «separadores libres».
   - F005 y F010 leían justo después de recargar; con estado restaurado en `useEffect`, el primer render aún muestra el fixture.
   - F010 buscaba listas por subcadena del nombre.
   - F008 no prohibía otros códigos de moneda.
   - F007 no decía que cambiar de sala, día o vista conserva el formulario.

## Correcciones

**Oráculo (no cambia ningún caso canónico ni su hash, salvo el cambio de IDs de F003):**
- `runner/oracle/generic-adapter.mjs`:
  - lee el texto con un espacio en cada límite entre elementos (`boundaryText`) en filas, controles, estados y alertas;
  - busca las listas primero por nombre exacto;
  - `reload()` y `reset()` esperan a que el DOM quede quieto (250 ms sin cambios, máximo 3 s).
  - Las funciones que se evalúan en la página no usan `eval`, para que una CSP de la aplicación no las bloquee.
  - F001 no usa este adaptador, así que no cambia.
- F003: `money()` lee el importe que sigue a la etiqueta del contrato.
- F009: el veredicto de «Revisión» admite cualquier separador tras el ID.

**Texto visible:**
- `prompts/architecture.md` de F002–F010 añade el párrafo «Formato de los textos de la interfaz»: el orden y los separadores de los ejemplos son normativos (un espacio o el separador mostrado); «separadores libres» admite cualquiera.
- F004 R001: «Paso» no muestra otros nombres de paso.
- F008 R002/R005: el total no muestra otro código de moneda.
- F007 R002: cambiar de sala, día o vista no modifica los campos del formulario.

**Reverificación:** los 41 casos AMBIGUOUS y los 12 problemas transversales de severidad alta o media quedaron resueltos (`recheck-2026-09-29.json`). Queda un riesgo menor en la recarga: si el estado guardado se pinta más de 250 ms después del último cambio del DOM sin mutaciones intermedias, el oráculo leería el fixture. En React el efecto de carga tarda milisegundos, así que se acepta y se documenta.

**Calibración:** todas las familias se recalibran con el adaptador nuevo (`npm run test:calibration`). Resultado en `docs/progreso-tareas-sin-modelos.md`.
