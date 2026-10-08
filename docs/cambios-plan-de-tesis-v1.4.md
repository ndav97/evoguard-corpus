# Cambios al plan de tesis: de la V1.3 a la V1.4

**Fecha de corte:** 8 de octubre de 2026.

**Para qué sirve:** reúne todas las decisiones metodológicas tomadas desde la V1.3 (`Plan_de_tesis_V1.3.docx`) que el plan debe reflejar. Para cada sección del plan dice qué dice ahora, qué debe decir y por qué.

**Estado:** el tesista confirmó estas decisiones el 2026-10-08.

**Evidencia en el repositorio `evoguard-corpus`:**
- `docs/diseno-linea-base-episodios.md`;
- `docs/operational-decisions.md`;
- `config/experiment.json`;
- `config/strata.json`.

---

## 1. Resumen de decisiones

| # | Fecha | Decisión | Motivo |
|---|---|---|---|
| D1 | 2026-10-02 | **Corpus solo semi-real**: repositorios públicos reales fijados en un commit verificado (V0), con cambios controlados. El estrato sintético se archiva | Validez externa: aplicaciones reales en lugar de generadas |
| D2 | 2026-10-05 | **60 familias** en el corpus definitivo (S001–S060): 30 de entrenamiento, 10 de validación y 20 de prueba, con **5 turnos** por familia (el piloto conserva 3) | Diseño de la V1.3, con bases ya seleccionadas y verificadas |
| D3 | 2026-10-08 | La línea base y la comparación final se miden **por episodios**, con las métricas de **EvoGenUI-Bench** (TP, TP@n, CPT y APR), además de la TEE y la TER del plan | Comparabilidad con el trabajo de referencia |
| D4 | 2026-10-08 | Se usan **los cinco modelos** (GPT-5.6 Sol, Claude Sonnet 5, Gemini 3.1 Pro y dos locales) en la línea base **y** en la comparación final | Comprobar que el efecto de EvoGuard UI se sostiene en distintos modelos |
| D5 | 2026-10-08 | **Presupuesto máximo de S/ 5 000** | Restricción del tesista |
| D6 | 2026-10-08 | **Las versiones de referencia del corpus son los parches calibrados** del equipo, no versiones generadas por modelos | Presupuesto (D5). El código escrito por modelos se estudia en los episodios |
| D7 | 2026-10-08 | **Etiquetas de riesgo (π0) con un modelo local** | Presupuesto (D5): solo cuesta GPU |
| D8 | 2026-10-08 | **Fase final:** 1 episodio por familia, 1 repetición, brazos **B y E**. Los brazos I y G se descartan | Presupuesto (D5) |
| D9 | 2026-10-08 | **Piloto:** 1 repetición | Presupuesto (D5) |
| D10 | 2026-10-07/08 | Reglas de protocolo:<br>• el límite de tiempo mide solo el trabajo del modelo;<br>• se excluyen los tests inestables ajenos al cambio;<br>• el oráculo se repite si solo falla la suite | Equidad de la medición |

---

## 2. Cambios por sección del plan

### 2.1 Problema: evidencia bibliográfica (EvoGenUI-Bench)

**Ahora dice:** «EvoGenUI-Bench: 74,9 % de éxito por turno, pero solo 37,3 % de episodios completos».

**Debe precisar** (Peng, Xia, Wang, Ye, Ning y Wen, 2026; arXiv:2608.29387):
- **Cifras del mejor modelo:** 74,9 % y 37,3 % son de **Claude-Opus-4.7**, el mejor de los 8 modelos evaluados. El conjunto de modelos queda en **42,7 % de éxito por turno y 11,8 % de episodios completos (TP@5)**. Ningún modelo pasa del 37,3 %.
- **Regresiones:** en una auditoría de 110 transiciones fallidas, el **52,7 %** rompió algo que ya funcionaba. Es la evidencia más directa del problema que aborda la tesis.
- **El benchmark:**
  - 150 tareas de 5 turnos;
  - un juez basado en un modelo (MiMo-V2.5), con ≥ 4/5 en presentación, ejecución y alineación;
  - una generación por turno;
  - validación humana: 86,7 % de acuerdo y κ = 0,73.

### 2.2 Hipótesis (sección 2.3)

- **Sin cambios de fondo.**
- **Precisión a añadir:** la hipótesis se evalúa con los cinco modelos. El resultado principal es la diferencia **agrupada** de los cinco, emparejada por familia y por modelo. Las diferencias de cada modelo se informan como descriptivas.

### 2.3 Objetivos

| OE | Ahora | Debe decir |
|---|---|---|
| OE1 | «Corpus en dos estratos con procedencia, licencias y particiones» | «Corpus **semi-real** de 60 familias (repositorios públicos fijados en una versión verificada, con cambios controlados y calibrados), con procedencia, licencias y particiones por familia completa» (D1, D2, D6) |
| OE5 | Medida: «TEE, retención, satisfacción nueva, costo» | «**TEE (TP@n)**, **TER**, éxito por turno (TP), turnos consecutivos aprobados (CPT), retención entre turnos (APR), satisfacción nueva, causas de fallo, costo y tiempo, para cada uno de los cinco modelos y agrupados» (D3, D4) |

### 2.4 Arquitectura del artefacto (sección 3.1.4)

**Ejecutor y verificador:** queda implementado como un **banco de episodios** (`runner/episode/` de evoguard-corpus) que:
- reutiliza los contenedores aislados y los oráculos calibrados del corpus;
- ejecuta un solo modelo por episodio, con los turnos encadenados sobre su propia salida;
- usa el oráculo como medida, no como filtro, y nunca se lo muestra al agente.

Sigue sin ser parte de EvoGuard UI.

### 2.5 Metodología: población, piloto y versión final

| Elemento | V1.3 | V1.4 |
|---|---|---|
| Estratos | Sintético y semi-real | **Solo semi-real** (D1) |
| Piloto | 20 familias, 1 episodio de 3 turnos, 2 repeticiones del agente textual | 20 familias semi-reales (S001–S020), 1 episodio de 3 turnos, **1 repetición, 5 modelos**, brazo B = **300 turnos** (D4, D9) |
| Versión final | 60 familias (30/10/20), 2 episodios de 5 turnos | 60 familias (30/10/20), **1 episodio de 5 turnos** por familia (D2, D8) |
| Agente evaluado | Un mismo modelo en los cuatro brazos | **Cinco modelos**. Cada modelo se compara consigo mismo entre brazos, con la misma configuración y el mismo presupuesto de contexto (D4) |
| Brazos | B, I, G y E × 3 repeticiones | **B y E × 1 repetición**. I y G se descartan (D8) |
| Turnos de la evaluación | 20 × 2 × 5 × 3 × 4 = 2 400 | 20 × 1 × 5 × 1 × 2 × 5 modelos = **1 000** |
| Etiquetado π0 | 1 200 turnos; modelo sin fijar | **400 turnos** (40 familias de entrenamiento y validación × 5 turnos × 2 repeticiones) con **un modelo local** (D7) |
| Versiones de referencia | Generadas por los modelos constructores (V1–V3) | **Parches de referencia calibrados** por el equipo, verificados con los tests ocultos (D6) |
| Precisión buscada | Semiamplitud de unos 10 puntos del efecto principal | Unos ±10 puntos en la **comparación agrupada** (100 pares familia-modelo). Por modelo, unos ±20 puntos: descriptivo |

**Texto sugerido para justificar D6:**
> Las versiones de referencia del corpus son implementaciones calibradas por el equipo. Para cada turno se verifica que los tests ocultos fallan antes del cambio y pasan después, que la suite del repositorio no presenta regresiones y que el resultado es estable. El código escrito por modelos de lenguaje se estudia en los episodios de evaluación, donde cada modelo evoluciona la aplicación sobre su propia salida.

### 2.6 Diseño de la intervención

| Brazo | V1.3 | V1.4 |
|---|---|---|
| B (textual) | Comparador principal; define π0 | Igual. El paquete textual del turno contiene la petición, la zona del cambio, el árbol y los archivos de la zona, y el historial propio |
| I (importaciones) | Explicativo | **Descartado** (D8) |
| G (impacto) | Explicativo; comparación secundaria TEE(E) − TEE(G) | **Descartado**. Se elimina la comparación secundaria (D8) |
| E (EvoGuard UI) | Intervención | Igual: misma guía, dentro del mismo presupuesto de contexto que B |

### 2.7 Indicadores (definiciones operativas)

**Definiciones por turno y por episodio:**
- **P_t (turno aprobado):**
  - entregó y respetó el alcance;
  - la comprobación de tipos no falló, si la familia la define;
  - pasan los tests ocultos de **T1..Tt**;
  - pasa la suite del repositorio, sin contar los fallos conocidos.
- **TEE = TP@n:** Z = Π P_t. Promedio por familia y luego entre familias. Se informa también agregada, como en el paper.
- **TER:** el episodio tuvo al menos una regresión. Hay **regresión en t** si un requisito anterior (Tk, k < t) o la suite pasaba en t−1 y falla en t. En t = 1, la suite se compara con V0. Un requisito que ya fallaba es un *defecto persistente* y no cuenta.

**Indicadores del paper que se añaden:**
- **TP:** éxito por turno.
- **CPT:** racha inicial de turnos aprobados.
- **APR:** P(P_t = 1 dado que P_{t−1} = 1), agregada sobre las transiciones elegibles.
- **Estimación independiente:** producto de las tasas de aprobación por posición.

**Causas de un turno fallido**, por prioridad:
1. regresión;
2. sin entrega (ciclos, tiempo, contexto o fallo técnico);
3. requisito nuevo no cumplido;
4. otra (alcance o tipos).

**Comparaciones** (para cada modelo y agrupadas, emparejadas por familia):
- **Δ** = TEE(E) − TEE(B);
- **ΔR** = TER(B) − TER(E).

**Incertidumbre:**
- intervalo de Wilson al 95 % en las tasas agregadas;
- bootstrap de familias completas (10 000 remuestras, semilla fija) en TEE, TER y las diferencias;
- sin pruebas de significancia, como en la V1.3.

**Unidades:**
- **análisis:** el episodio;
- **observación:** episodio × brazo × **modelo** × repetición;
- **agrupamiento:** la familia.

### 2.8 Protocolo de ejecución de un episodio

Es nuevo y conviene añadirlo como subsección o anexo.

| Aspecto | Regla |
|---|---|
| Modelo | Uno por episodio, sin reasignación ni reparación por parte del pipeline |
| Punto de partida | Cada turno parte del código que dejó el propio modelo, aunque fallara |
| Herramientas | Protocolo de acciones 1.1: leer, listar, escribir y editar archivos, ejecutar los tests visibles, comandos, entregar |
| Límites | 25 ciclos por turno; 30 min (comerciales) o 60 min (locales) de **trabajo del modelo**. La evaluación tiene su propio límite |
| Oráculo | Contenedor aparte con los tests ocultos y la suite completa. Nunca se muestra al agente |
| Código que impide medir | Cuenta como fallo de todos los requisitos del turno, no como error de infraestructura: la suite no produce informe, se cuelga dos veces o el parche supera 12 MiB |
| Tests inestables | Los ajenos al cambio detectados en los ensayos se excluyen (`known_failures`). Si en un turno solo falla la suite, el oráculo se repite una vez |
| Commits del agente | El parche se mide respecto de la base del turno, así que el trabajo cuenta aunque el agente haga sus propios commits |
| Infraestructura | Si Docker o el contenedor fallan, el episodio se repite entero. Los registros parciales se conservan |
| Registros | Por turno: acciones, llamadas, tokens (incluidos los cacheados), costo, parche y resultado del oráculo. Más la huella del código y de los modelos |

### 2.9 Etapas (sección 4.8)

| Etapa | V1.3 | V1.4 |
|---|---|---|
| 4.8.1 Corpus (OE1) | Familias, versiones de referencia generadas, oráculos, auditoría; etiquetas de impacto y de riesgo (π0, hasta 3 repeticiones) | Familias semi-reales calibradas (peticiones, tests ocultos, **parches de referencia**), imágenes verificadas, ensayos, mutantes y revisión de peticiones. Etiquetas de **impacto** desde los parches calibrados. Etiquetas de **riesgo** con episodios de un **modelo local** (400 turnos) |
| 4.8.5 Evaluación (OE5) | 2 400 turnos + 1 200 de etiquetado π0 | **1 000 turnos** (5 modelos × B y E × 20 familias de prueba × 5 turnos) + **400** de π0 + **300** de línea base del piloto |

### 2.10 Administración: presupuesto y cronograma

**Presupuesto.** Sustituye a S/ 6 144:

| Concepto | USD | S/ (a 3,4413) |
|---|---|---|
| Línea base del piloto (300 turnos) | ~200 | ~690 |
| Etiquetado π0 (400 turnos locales, GPU) | ~25 | ~90 |
| Evaluación final (1 000 turnos) | ~675 | ~2 320 |
| GPU para el banco local y horas extra | ~25 | ~90 |
| Reserva (15 %) | ~140 | ~480 |
| **Total previsto** | **~1 065** | **~3 670** |
| **Límite** | **1 453** | **5 000** |

**Notas al presupuesto:**
- **Base de la estimación:** los precios son de lista para GPT-5.6 Sol (4/20 USD por millón de tokens de entrada/salida), Claude Sonnet 5 (2/10) y Gemini 3.1 Pro (2/12), con unos 300 000 tokens de entrada y 20 000 de salida por turno. Hay que sustituirlos por las tarifas reales del intermediario (Synterolink).
- **Caché de prompts:** si se aplica, el total puede bajar a unos S/ 2 100. En ese caso se añadiría una 2.ª repetición a la fase final.
- **Control:** el software impide iniciar ejecuciones que superen el límite menos la reserva (`npm run episode:budget`).
- **Calibración:** los primeros 45 turnos (5 familias × 3 modelos comerciales; unos S/ 170) fijan el costo real antes de seguir.

**Tiempo de máquina**, en un PC, secuencial, a 5–10 min por turno:
- piloto: 25–50 h;
- π0: 35–70 h;
- evaluación final: 85–170 h.

Cabe en el cronograma de 12 meses. Conviene indicar que se ejecuta de forma desatendida.

### 2.11 Limitaciones y amenazas a la validez

Es nuevo, o amplía lo que ya hay.
1. **Una repetición por condición:** la variabilidad entre ejecuciones no se estima en la fase final. Se mitiga con el emparejamiento por familia y la agrupación de cinco modelos.
2. **Referencias escritas por el equipo (D6):** las etiquetas de impacto reflejan una implementación posible, no la única.
3. **π0 con un modelo local (D7):** el riesgo aprendido es el de ese modelo, y puede diferir del de los comerciales.
4. **Tests inestables excluidos:** se pierde algo de cobertura de la suite en las familias afectadas (S014 y S015).
5. **Asimetría al cortar por tiempo o contexto:** no queda snapshot y se pierde el trabajo parcial. Al agotar ciclos, en cambio, se conserva.
6. **Reintentos de transporte:** sus esperas cuentan dentro del tiempo del modelo. Se registran para un análisis de sensibilidad.
7. **Comparabilidad con EvoGenUI-Bench:** las métricas tienen las mismas definiciones, pero el benchmark es otro:
   - repositorios reales frente a interfaces generadas;
   - tests deterministas frente a juez basado en un modelo;
   - otros modelos.

   Las cifras no son directamente comparables.

### 2.12 Referencias

**Completar la cita:** Peng, Y., Xia, L., Wang, Z., Ye, J., Ning, K. y Wen, H. (2026). *EvoGenUI-Bench: Evaluating LLMs as Multi-Turn Generative UI Assistants*. arXiv:2608.29387 (el plan indica aceptación en EMNLP 2026).

---

## 3. Lo que todavía no está decidido y el plan debería dejar abierto

- **Modelos locales:** cuáles serán `local_a` y `local_b`, y cuál de ellos será π0. Se elige con el banco en Vast.ai.
- **Transporte de Claude Sonnet 5** y activación de su caché de prompts.
- **Tarifas reales de Synterolink:** ajustan el presupuesto.
- **Segunda repetición de la fase final:** solo si la caché lo permite.
- **Paralelismo:** cambia el tiempo de máquina, no el costo.
