# Cambios del plan de tesis V1.5 → V1.6 (16 de octubre de 2026)

| Sección | Cambio |
|---|---|
| 3.2 Definición de términos | π0 pasa a ser el brazo B ejecutado con cada uno de los cinco modelos; cada etiqueta queda identificada por su modelo. |
| 4.4 Población y muestra | Las familias del piloto se ampliaron a cinco turnos; 39 de las 40 familias de entrenamiento y validación están redactadas (falta S051); seis de prueba se redactaron antes de fijar la partición. |
| 4.5.1 Tabla de brazos | El brazo B «con los cinco modelos define π0». |
| 4.6 Calibración de oráculos | Nuevo control previo en un banco local (pasa con la referencia, falla con el turno anterior), que no sustituye la calibración en contenedor; dos defectos de pruebas ocultas detectados y corregidos al ampliar a cinco turnos. |
| 4.7 Amenazas | «Riesgo aprendido con un solo modelo local» → «riesgo aprendido de cinco políticas concretas, que puede no transferirse a otros agentes o versiones». |
| 4.8.1 Resultados del piloto | El párrafo del 14 de octubre se conserva como antecedente (límite de salida 8 192 y elección inicial de Gemma 4). Nuevo párrafo: decisión del 15 de octubre de ampliar π0 a los cinco modelos, con una repetición, y sus tres motivos; el piloto B puede sumarse como entrenamiento. |
| 4.8.1 Etiquetado π0 | 1 000 turnos (40 familias × 5 modelos × 1 repetición), en lugar de 400 con Gemma 4 y dos repeticiones. |
| 4.8.3 Predictor dual | La salida de riesgo se condiciona al modelo, que entra como atributo. |
| 4.8.5 Evaluación integral | El etiquetado bajo π0 suma 1 000 turnos. |
| 5.1 Cronograma | Nuevas filas: familias de entrenamiento y validación de cinco turnos y plan V1.6 (12–25 oct), etiquetado π0 con cinco modelos (26 oct – 8 nov), familias de prueba y corpus v1.0 (2–15 nov), extractor del grafo (16–22 nov). |
| 5.1 Estado | Situación al 16 de octubre: 27 familias calibradas con cinco turnos, S014 a recalibrar por inestabilidad, 11 redactadas a la espera de calibración, S051 por redactar. |
| 5.2 Presupuesto | Etiquetado π0: S/ 85 → S/ 760. Total previsto: S/ 2 464 → S/ 3 139 (62,8 % del límite). Gasto ejecutado sin cambios: S/ 529. |
| Anexo 3 | Estado de las seis condiciones al 16 de octubre. |
| Matriz de consistencia | Técnicas: «etiquetado de riesgo (π0) con los cinco modelos del grupo (1 000 turnos, una repetición)». |
