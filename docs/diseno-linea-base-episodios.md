# Línea base y comparación final por episodios

**Fecha:** 2026-10-08.

**Decisión del tesista:**
- Obtener una línea base por modelo con las métricas de EvoGenUI-Bench (Peng, Xia, Wang, Ye, Ning y Wen, 2026; arXiv:2608.29387).
- Repetir la misma medición con EvoGuard UI para cuantificar la mejora.
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

## 4. Fases

| Fase | Familias | Turnos | Episodios por familia | Repeticiones | Brazos | Modelos | Turnos totales |
|---|---|---|---|---|---|---|---|
| **Piloto** (`linea-base-piloto`) | S001–S020 | 3 (TP@3) | 1 | 2 | B | 5 | **600** (200 episodios) |
| **Final** (`evaluacion-final`) | 20 de prueba del corpus definitivo | 5 (TP@5) | 2 | 3 | B y E | 5 | **6 000** (+ 6 000 si se añaden I y G) |

**Objetivos del piloto:**
- primera línea base por modelo;
- varianza entre repeticiones, para fijar las de la fase final;
- tiempo y costo reales por turno, para decidir el presupuesto final.

**Condiciones de la fase final:**
- Usa solo familias de la **partición de prueba**, que EvoGuard UI nunca ve al entrenar.
- Las particiones son por familia completa: 30 de entrenamiento, 10 de validación y 20 de prueba.

### Relación con el entrenamiento de EvoGuard UI

Los episodios del brazo B sobre las familias de **entrenamiento** son la fuente natural de las etiquetas de riesgo π0, es decir, qué requisitos suele romper el agente. Las etiquetas de impacto salen de los parches de referencia del corpus generado.

Usar varios modelos como π0 cambia la definición del riesgo: pasa de «este agente» a «un agente cualquiera». Se decidirá con los datos del piloto y se declarará.

## 5. Estimación de tiempo y costo, a revisar con el piloto

| Componente por turno | Estimación |
|---|---|
| Abrir el workspace y reconstruir la historia | 0,5–2 min |
| Trabajo del modelo | 2–15 min (los locales, más) |
| Oráculo, una vez | 15 s – 9 min según la familia; mediana de unos 80 s en S001–S020 |
| Total | unos **5–10 min por turno** |

**Duración en un solo PC, sin paralelismo:**
- **Piloto:** 600 turnos ≈ **50–100 h**, unos 2–4 días continuos.
- **Final (B y E):** 6 000 turnos ≈ **500–1 000 h**, unos 3–6 semanas continuas.

Esto no es viable sin una de estas medidas, que se decidirán con los datos del piloto:
1. **Paralelismo:** varios episodios a la vez en el PC (cada contenedor usa 2 CPU) o en una segunda máquina.
2. **Menos repeticiones** en la fase final, si la varianza del piloto es baja.
3. **Brazos I y G** solo con uno o dos modelos.

**Costo de los modelos comerciales:** se mide en tokens por turno en el piloto (`turn.json`) antes de comprometer la fase final.

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
- **Dos episodios por familia en la fase final:** hoy cada familia tiene una sola secuencia de turnos. Hay que definir el segundo episodio antes de la fase final: otra secuencia sobre la misma base, o la misma secuencia con otro orden.
- **Requisitos antes de la línea base con modelos:**
  - transporte de Sonnet resuelto;
  - banco de modelos locales;
  - `config/models.json` y `config/context.json` congelados.

  Son los mismos que para generar el corpus.
- **Paralelismo:** decidir con el piloto si se ejecutan varios episodios a la vez.
