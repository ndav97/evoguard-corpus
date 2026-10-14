# Línea base piloto (brazo B): interpretación — 14-oct-2026

Fuente: `resumen.md`, `modelos.csv` y `episodios.csv` de esta carpeta, copiados de
`runs/episodes/linea-base-piloto/analisis/` (generados con `npm run episode:analyze -- --experiment linea-base-piloto`).
Diseño y definiciones: `docs/diseno-linea-base-episodios.md`.

## Validez

- 100/100 episodios válidos (S001–S020 × 5 modelos × 3 turnos = 300 turnos), 0 incompletos, 0 errores de infraestructura.
- Un solo `code_sha256` y un solo `models_sha256` en los 300 registros: todo el piloto se ejecutó con el mismo código
  del ejecutor y la misma configuración de modelos (muestreo del fabricante, contexto calibrado, Ollama 0.40.3).
- Un episodio de Claude (S005) se interrumpió a mano y se repitió completo; el interrumpido queda como
  `e1-r1.incompleto-*`, el análisis lo excluye y su costo (~US$ 0.28) sí cuenta en el presupuesto.
- Los episodios de diagnóstico con código o configuración anteriores están apartados en `runs/episodes-diagnostico/`
  y no entran en la línea base.

## Resultados (brazo B, 3 turnos)

| Modelo | TP | TP@3 (TEE) | APR | TER | T1 / T2 / T3 | USD por turno | Min por turno |
|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 | 93.3 % | 90 % | 97.4 % | 0 % | 95 / 95 / 90 % | 0.430 | 7.8 |
| GPT-5.6 Sol | 50.0 % | 35 % | 73.9 % | 25 % | 65 / 50 / 35 % | 0.401 | 5.5 |
| Qwen3-Coder 30B | 16.7 % | 10 % | 50.0 % | 35 % | 20 / 20 / 10 % | GPU | 12.3 |
| Gemma 4 26B | 25.0 % | 0 % | 28.6 % | 40 % | 50 / 20 / 5 % | GPU | 6.0 |
| Devstral 24B | 5.0 % | 0 % | 33.3 % | 50 % | 10 / 5 / 0 % | GPU | 6.9 |

Global: 114/300 turnos aprobados (38 %). Intervalos de Wilson y bootstrap por familia en `resumen.md`.

## Lectura

1. **La evolución degrada el rendimiento.** Salvo Claude, la tasa de aprobación cae con la posición del turno
   (GPT 65→35 %, Gemma 50→5 %). Es la premisa del problema de la tesis.
2. **Los fallos se concentran por familia.** El TP@3 observado supera la estimación independiente (GPT 35 % frente a
   11 %): hay familias que un modelo resuelve entera y otras en las que falla desde T1. Por eso los intervalos de
   TEE se calculan con bootstrap de familias completas.
3. **Causas distintas según el tipo de modelo.** En los comerciales domina el requisito nuevo incumplido o el alcance
   (GPT: 13 requisito nuevo, 9 otra, 5 regresión). En los abiertos domina la no entrega por agotar ciclos
   (Qwen 42/50, en gran parte por reescribir archivos completos dentro de `edit_file` y chocar con el límite de 4096
   tokens de salida; Gemma 18 + 11 declaraciones propias de `technical_failure`).
4. **Regresiones (TER).** 0 % en Claude; 25–50 % en el resto. La retención de requisitos ya cumplidos va de 74 %
   (Devstral) a 100 % (Claude).
5. **Efecto techo en Claude.** Con TP@3 = 90 %, el margen de mejora del brazo E en Claude es ≤ 10 pp en 3 turnos.
   En la fase final (5 turnos) el techo puede bajar, pero el efecto de EvoGuard se espera sobre todo en GPT y en
   los modelos abiertos. No cambia el diseño (comparación emparejada B frente a E por modelo).
6. **Datos para el modelo predictivo.** 38 % de turnos aprobados: clases razonablemente equilibradas, con
   variedad de causas de fallo.

## Familia S008: ningún modelo aprueba (revisado)

Los cinco modelos fallan la misma prueba oculta de T001 («el título tiene el id `modal-modal-title`») y, por
retención, T002 y T003. Causa: el repositorio usa `@mui/material` 9.4.0, que eliminó `titleTypographyProps` de
`CardHeader` (ahora `slotProps.title`); el código original del repositorio aún usa esa prop, que MUI 9 ya ignora.
Los modelos siguen la convención del archivo, añaden el `id` ahí, el código compila, pero el `id` no llega al DOM.
El requisito pedido realmente no se cumple, así que la etiqueta es correcta: es un fallo silencioso legítimo (el
tipo de error que EvoGuard debe detectar), no un defecto del oráculo. S008 pertenece a train/val (partición v1.1),
no al conjunto de prueba. No se modifica nada.

## Costo y tiempo del piloto

- Comerciales: US$ 49.89 en los episodios válidos (Claude 25.81, GPT 24.08), US$ 50.18 con el episodio interrumpido.
- Abiertos: 25.2 h de turno (Gemma 6.0, Qwen 12.3, Devstral 6.9) dentro de 25.3 h de GPU facturadas (US$ 10.12).
- Caché de entrada: GPT 77 %, Claude 4.6 %. En Claude la caché casi no se reutiliza porque el prefijo del historial
  cambia entre ciclos (compresión por niveles); se pagan escrituras de caché sin lecturas. Afecta solo al costo,
  no a la validez. Mejora posible antes de la fase final, aplicada igual en B y E.
- Presupuesto acumulado al cierre del piloto: US$ 158.83 (S/ 547) de un tope operativo de US$ 1 235.

## Decisiones pendientes (antes de π0 y de la fase final)

1. Modelo local de π0: la configuración dice `local_a` (Qwen3-Coder); Gemma tuvo mejor TP (25 % frente a 17 %),
   la mitad de minutos por turno y más entregas.
2. Salida de 8192 tokens para los modelos abiertos en la fase final (igual en B y E), por los CYCLE_LIMIT de Qwen.
3. Prefijo estable para la caché de Anthropic (solo costo).
