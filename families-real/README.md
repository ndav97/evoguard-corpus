# Familias semi-reales (estrato semi-real del piloto)

Cada familia `Sxxx-slug/` parte de un **repositorio público real** fijado en un commit V0 verificado (su suite pasa, estable y sin red) y añade **tres cambios redactados por el equipo** (T001–T003). Los modelos implementan cada cambio sobre la versión anterior, igual que en las familias sintéticas.

## Contenido de una familia

| Archivo | Qué es | ¿Lo ve el modelo? |
|---|---|---|
| `family.yaml` | Repo, commit V0, runner, carpeta del workspace, fallos conocidos y lista de turnos | Solo los datos operativos |
| `turns/T00n.md` | Petición del cambio, con los textos exactos de la interfaz | **Sí** |
| `oracle/T00n.test.*` | Tests ocultos del cambio (fail-to-pass) | No |
| `reference/T00n.patch` | Implementación de referencia; sirve solo para calibrar los tests | No |

## Oráculo de cada turno

1. **Fail-to-pass:** los tests ocultos del turno deben fallar antes del cambio y pasar después. Los que ya pasaban antes (comprobaciones negativas, como «el botón no aparece si…») actúan de guarda.
2. **Preservación:** los tests ocultos de los turnos anteriores deben seguir pasando.
3. **Pass-to-pass:** toda la suite original del repo debe seguir pasando, salvo los `known_failures` registrados en V0.

## Calibración

`scripts\real\calibrar-familias-reales.cmd` comprueba lo anterior con las implementaciones de referencia, en Docker y sin red, y deja el workspace otra vez en V0. Una familia solo pasa a `CALIBRATED` si todos sus turnos dan OK. Resultados en `.artifacts\real-calibration\`.

## Reglas de redacción de los cambios

- Aditivos: no modifican comportamiento existente, así ningún test del repo queda invalidado por un cambio correcto.
- Encadenados en una misma zona de la app, para que haya evolución y riesgo real de regresión entre turnos.
- Observables: textos, roles y peticiones HTTP exactos en la petición; los tests solo comprueban lo que la petición dice.
- Acotados a pocos archivos, compatibles con el contexto de los modelos locales.
