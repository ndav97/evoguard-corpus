# Línea base y comparación final por episodios

**Fecha:** 2026-10-08.

**Decisión del tesista:**
- Obtener una línea base por modelo con las métricas de EvoGenUI-Bench (Peng, Xia, Wang, Ye, Ning y Wen, 2026; arXiv:2608.29387).
- Repetir la misma medición con EvoGuard UI para cuantificar la mejora.
- Ajustar todo a un presupuesto máximo de **S/ 5 000** (sección 4).
- Usar los **cinco modelos del pool** tanto en la línea base como en la comparación final.
- Mantener **60 familias** en el corpus definitivo.

**Dónde está cada pieza:**
- Configuración: `config/experiment.json`.
- Código: `runner/episode/` (`run.mjs`, `store.mjs`, `metrics.mjs`, `analyze.mjs`, `rehearse.mjs`).

## 1. Por qué hace falta una medición aparte de la generación del corpus

La generación del corpus (`corpus:generate`) construye **historias de referencia válidas**:
- si un modelo falla, la tarea se reasigna a otro;
- se permiten reparaciones con feedback de los tests visibles;
- cada versión parte de la versión *aceptada* anterior.

Esas condiciones inflan el éxito a propósito, así que no sirven como línea base.

La línea base, igual que en el paper, necesita **episodios**: un único modelo recorre los turnos de una familia, cada turno sobre su propia salida y sin rescate. El oráculo mide cada turno pero no filtra nada ni se muestra al modelo.

## 2. Protocolo de un episodio

| Aspecto | Regla |
|---|---|
| Modelo | Uno por episodio (`singleProvider` del motor): sin reasignación |
| Turnos | T001…T00n de la familia (3 en el piloto y 5 en el corpus definitivo), en orden |
| Punto de partida de cada turno | El código que dejó el propio modelo en el turno anterior, aunque fallara. Si no entregó, el código que quedó en su workspace. Si no hay snapshot porque se agotó el tiempo, el estado anterior |
| Herramientas del modelo | El protocolo de acciones 1.1 completo, incluido `run_checks` (suite visible del repositorio) |
| Feedback del pipeline | Ninguno. El pipeline no repara tras la entrega (equivale a «una generación por turno» del paper) |
| Límites | `config/policy.json`: 25 ciclos y `timeout_seconds` (1 800 s comerciales y 3 600 s locales), contando solo el trabajo del modelo |
| Oráculo | Contenedor nuevo con los tests ocultos T1..Tt y la suite completa. Privado: el modelo nunca lo ve |
| Alcance | Mismo control que el corpus: no puede tocar tests existentes, dependencias ni configuración. Si lo hace, el turno falla |
| Parche del turno | Se calcula respecto de la **base del turno**, no de HEAD. Si el agente hace su propio `git commit`, `reset` o `checkout`, su trabajo cuenta igual: el pipeline vuelve HEAD a la base (`reset --soft`) antes de su commit determinista, y la historia se reproduce por hash. Se registra `head_moved` |
| Código que impide medir | Cuenta como **fallo de todos los requisitos del turno**, no como infraestructura, en tres casos: la suite no produce informe; la suite agota su tiempo dos veces con Docker respondiendo (bucle, test que no termina); el parche supera 12 MiB. Se registra la causa (`no_report`, `oracle_timeout`, `patch_oversize`). Si el parche es enorme, el turno siguiente parte del estado anterior |
| Infraestructura | Si Docker, el workspace o el evaluador fallan, el episodio se interrumpe y se repite entero. Los registros parciales se conservan como `*.incompleto-<fecha>` |
| Reintentos de transporte | Las esperas por 429, 5xx o errores de red consumen el tiempo del modelo, como en la generación del corpus. Se registran por turno (`transport_retries` y su espera) para poder hacer un análisis de sensibilidad |
| Procedencia | Cada `turn.json` y `episode.json` guarda la huella del código del ejecutor y de `config/models.json`. El análisis avisa si un experimento mezcla versiones |

## 3. Métricas

Definiciones en `runner/episode/metrics.mjs`, con pruebas en `tests/episode-metrics.test.mjs`.

| Métrica | Definición | En el paper | En el plan |
|---|---|---|---|
| **P_t** (turno aprobado) | Entregó, respetó el alcance, la comprobación de tipos no falló (si la familia la define), pasan los tests ocultos de **T1..Tt** y pasa la suite del repositorio | TP | P |
| **Z** (episodio exitoso) | Producto de los P_t: todos los turnos aprobados | **TP@5** | **TEE** (promedio por familia y luego entre familias) |
| **CPT** | Racha inicial de turnos aprobados (0..n) | CPT | — |
| **APR** | P(P_t = 1 dado que P_{t−1} = 1), agregada sobre todas las transiciones elegibles | APR | — |
| **Regresión en t** | Un requisito anterior (Tk con k < t), o la suite, pasaba en t−1 y falla en t. La suite se compara con V0 en t = 1. Un requisito que ya fallaba es un *defecto persistente* | Auditoría manual de 110 transiciones | Definición de regresión del marco teórico |
| **R / TER** | El episodio tuvo al menos una regresión | — | **TER** |
| Causa de un turno fallido | Por prioridad: regresión > sin entrega (ciclos, tiempo, contexto, fallo técnico) > requisito nuevo no cumplido > otra (alcance o tipos) | Taxonomía del paper (regresión 52,7 %) | — |
| Satisfacción nueva y retención | Pasa Tt; proporción de requisitos vigentes que se conservan | — | Indicadores secundarios |
| Estimación independiente | Producto de las tasas de aprobación por posición. Si Z observado la supera, la dificultad se concentra en ciertos episodios | Igual | — |

**Supuesto en t = 1:** la suite de V0 pasa, sin contar los fallos conocidos. No se vuelve a medir en cada episodio porque lo garantizan la verificación de la base y la calibración.

**Asimetría a declarar en la tesis:** si un turno se corta por tiempo o por contexto, no hay snapshot. Se pierde el trabajo parcial y el turno siguiente parte del estado anterior. Si se agotan los ciclos o hay un fallo técnico, el trabajo parcial sí se conserva.

**Agregación e incertidumbre:**
- **Por modelo:** tasas agregadas con intervalo de Wilson al 95 %, como las tablas del paper.
- **TEE y TER por familia:** bootstrap de familias completas, con 10 000 remuestras y semilla fija.
- **Comparación final:** para cada modelo, Δ = TEE(E) − TEE(B) y ΔR = TER(B) − TER(E), emparejadas por familia y con bootstrap de familias.

**Ventajas frente al paper:**
- **Regresión:** se mide en **todas** las transiciones con tests deterministas, mientras que el paper la estimó con una auditoría de 110 casos y un juez basado en un modelo.
- **Repeticiones:** hay varias por episodio (el paper hizo una generación por turno y reconoce que su TP variaba entre 39,7 % y 46,4 % al regenerar).

## 4. Fases (dimensionadas al presupuesto, 2026-10-08)

**Presupuesto:** el tesista dispone como máximo de **S/ 5 000**, unos 1 453 USD a 3,4413 PEN por USD el 2026-10-08. Con ese límite se tomaron estas decisiones:
1. **Referencias del corpus = parches de referencia calibrados.** Las versiones de referencia son los `reference/T00n.patch` de cada familia, verificados con los tests ocultos. **No se generan referencias con modelos**: ahorra unos 300–550 USD y semanas de máquina. Las etiquetas de impacto salen de esos parches, y el código escrito por modelos se estudia en los episodios. Es un cambio metodológico que se declara en la tesis.
2. **Etiquetas de riesgo (π0) con un modelo local**, el elegido en el banco. Solo cuesta GPU. El riesgo se define respecto de ese modelo.
3. **Piloto con 1 repetición.**
4. **Fase final con 1 episodio por familia, 1 repetición y los brazos B y E.** Los brazos explicativos I y G se descartan.

| Fase | Familias | Turnos | Episodios × repeticiones | Brazos | Modelos | Turnos totales |
|---|---|---|---|---|---|---|
| **Piloto** (`linea-base-piloto`) | S001–S020 | 3 (TP@3) | 1 × 1 | B | 5 | **300** (100 episodios) |
| **π0** (`etiquetas-pi0`) | 40 de entrenamiento y validación | 5 | 1 × 2 | B | 1 local | **400** |
| **Final** (`evaluacion-final`) | 20 de prueba | 5 (TP@5) | 1 × 1 | B y E | 5 | **1 000** |

**Precisión con este tamaño:**
- Por modelo, cada brazo tiene 20 episodios, así que el TEE de un modelo tiene un margen de unos ±20 puntos.
- La comparación agrupada de los cinco modelos tiene 100 pares familia-modelo emparejados. Su margen es de unos ±10 puntos, que es lo que pide el plan, y es la que sostiene la hipótesis.
- Las diferencias por modelo se presentan como descriptivas.
- Si la caché de prompts reduce el costo lo suficiente, se añade una 2.ª repetición a la fase final.

### Relación con el entrenamiento de EvoGuard UI

- **Impacto:** qué partes del código toca cada cambio. Se etiqueta con los parches de referencia calibrados.
- **Riesgo:** qué requisitos suele romper el agente. Se etiqueta con los episodios del brazo B del modelo local (fase π0) sobre las familias de entrenamiento y validación.
- **Separación:** las familias de prueba nunca se usan para entrenar.

## 5. Costo y tiempo

**Control del gasto** (`runner/episode/budget.mjs` y `npm run episode:budget`):
- **Costo de cada turno:** tokens reales (entrada total, cacheada, escritura de caché, salida y razonamiento de Gemini) × precios de `config/experiment.json` → `cost_usd` en `turn.json`.
- **Gasto acumulado:** todos los turnos, incluidos los de episodios interrumpidos, más las horas de GPU de los locales y los gastos externos anotados en `budget.extra_spent_usd` (diagnósticos, banco, GPU sin uso).
- **Tope:** el ejecutor **no inicia un episodio** si el gasto más su proyección pesimista superara el tope operativo, que es el límite menos una reserva del 15 %. La proyección usa el percentil 90 observado o, con menos de 10 turnos, el techo de la configuración.
- **Precios:** son de lista y de terceros; hay que sustituirlos por las tarifas de Synterolink. La entrada cacheada se registra para medir si la caché se aplica: OpenAI y Gemini cachean automáticamente el prefijo común, y Anthropic necesita activarla en el transporte.

**Estimación por turno, sin caché:**

| Modelo | Típico | Techo |
|---|---|---|
| GPT-5.6 Sol | 1,60 USD | 5,00 USD |
| Claude Sonnet 5 | 0,80 USD | 2,50 USD |
| Gemini 3.1 Pro | 0,85 USD | 2,60 USD |
| Local (GPU a 0,40 USD/h) | 0,07 USD | 0,20 USD |

Supuestos: unos 300 000 tokens de entrada por turno, porque el historial se reenvía en cada ciclo, y unos 20 000 de salida.

| Fase | Comerciales | GPU | Total típico |
|---|---|---|---|
| Piloto (300 turnos) | ~195 USD | ~7 USD | ~200 USD |
| π0 (400 turnos locales) | — | ~25 USD | ~25 USD |
| Final (1 000 turnos) | ~650 USD | ~25 USD | ~675 USD |
| Banco local y GPU sin uso | — | ~25 USD | ~25 USD |
| Reserva (15 %) | | | ~140 USD |
| **Total** | | | **≈ 1 065 USD ≈ S/ 3 700** |

Con caché efectiva la parte comercial baja hasta ~55 %, y el total se queda en unos S/ 2 100.

**Calibración antes de seguir:** los 5 primeros episodios de cada modelo comercial en el piloto (S001–S005; 45 turnos, unos 50 USD) se ejecutan primero. Con su costo y su tiempo reales se confirma o se ajusta el plan:
```
scripts\episode\linea-base-piloto.cmd -Proveedores openai,anthropic,google -Familias S001,S002,S003,S004,S005
npm run episode:budget
```

**Tiempo de ejecución en el PC, secuencial y a 5–10 min por turno:**
- piloto: 25–50 h;
- π0: 35–70 h;
- final: 85–170 h.

## 6. Cómo se ejecuta

1. **Ensayo del ejecutor** (sin modelos, unos 20 min):
   - comando: `scripts\episode\ensayar-episodios.cmd`, o `npm run episode:rehearse -- S001`;
   - cuatro escenarios con resultado conocido:
     - ideal;
     - turno sin entrega con cambios: aplica su parche y agota los ciclos, y el turno siguiente continúa desde ese código;
     - regresión provocada: deshace T1;
     - agente que hace su propio `git commit` en cada turno;
   - resultado: `docs/verification/episode-rehearsal.json`, que el ejecutor exige antes de medir;
   - el ensayo deja de valer si cambia el código de `runner/episode/` o la huella del pipeline semi-real.
2. **Línea base del piloto:**
   - comando: `scripts\episode\linea-base-piloto.cmd`;
   - para empezar sin GPU, solo con los comerciales: `-Proveedores openai,anthropic,google`;
   - retoma sola, con vigilante por episodio (100 min por turno: 300 en el piloto y 500 en la final), reinicio de Docker y un reintento;
   - si el episodio no llega a iniciarse (preflight, configuración o credenciales), se detiene con el motivo;
   - antes de cada episodio comprueba:
     - imagen y ensayo de la familia vigentes;
     - ensayo general vigente;
     - ensayo del ejecutor vigente;
     - modelos congelados.
3. **Análisis:** `npm run episode:analyze -- --experiment linea-base-piloto`. Escribe en `runs/episodes/linea-base-piloto/analisis/`:
   - `resumen.md`, con la tabla por modelo al estilo de la tabla 2 del paper;
   - `modelos.csv`, `episodios.csv` y `comparaciones.csv`.

**Registros** (`runner/episode/store.mjs`):
- **Por turno:** `runs/episodes/<experimento>/<brazo>/<proveedor>/<Sxxx>/e<episodio>-r<repetición>/T00n/`, con `events.jsonl`, `calls.jsonl`, `patch.diff` y `turn.json`. `turn.json` incluye: requisitos, suite, alcance, ciclos, duración, tokens y modelo observado.
- **Por episodio:** `episode.json` en la carpeta del episodio.
- **Privados:** los informes del oráculo, en `evaluator/episodes/…`.

## 7. Pendientes

- **Brazos I, G y E:** necesitan el extractor y la guía de EvoGuard UI (OE2–OE4). `armPacket` los rechaza hasta entonces. La guía debe ocupar el mismo presupuesto de contexto que el brazo B.
- **Caché de Anthropic:** activarla (`cache_control`) cuando se elija el transporte de Sonnet, y comprobar en la calibración si Synterolink aplica la caché de OpenAI y Gemini.
- **Precios reales de Synterolink** en `config/experiment.json`.
- **Requisitos antes de la línea base con modelos:**
  - transporte de Sonnet resuelto;
  - banco de modelos locales;
  - `config/models.json` y `config/context.json` congelados.

  Son los mismos que para generar el corpus.
- **Paralelismo:** decidir con el piloto si se ejecutan varios episodios a la vez. No cambia el costo, solo el tiempo.
