# Episodios: linea-base-piloto

300 turnos · 100 episodios válidos · 0 incompletos o inválidos (excluidos)

## Brazo B

| Modelo | Episodios (familias) | TP | **TP@3 (episodios exitosos)** | TEE por familia | CPT | APR | TER (episodios con regresión) | Fallos de transición por regresión |
|---|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 | 20 (20) | 93.3 % [84.1 %–97.4 %] | **90.0 % [69.9 %–97.2 %]** | 90.0 % [75.0 %–100.0 %] | 2.8 | 97.4 % [86.5 %–99.5 %] | 0.0 % [0.0 %–16.1 %] | 0/1 (0.0 %) |
| GPT-5.6 Sol | 20 (20) | 50.0 % [37.7 %–62.3 %] | **35.0 % [18.1 %–56.7 %]** | 35.0 % [15.0 %–55.0 %] | 1.5 | 73.9 % [53.5 %–87.5 %] | 25.0 % [11.2 %–46.9 %] | 3/6 (50.0 %) |
| Qwen3-Coder 30B | 20 (20) | 16.7 % [9.3 %–28.0 %] | **10.0 % [2.8 %–30.1 %]** | 10.0 % [0.0 %–25.0 %] | 0.4 | 50.0 % [21.5 %–78.5 %] | 35.0 % [18.1 %–56.7 %] | 1/4 (25.0 %) |
| Gemma 4 26B | 20 (20) | 25.0 % [15.8 %–37.2 %] | **0.0 % [0.0 %–16.1 %]** | 0.0 % [0.0 %–0.0 %] | 0.7 | 28.6 % [11.7 %–54.6 %] | 40.0 % [21.9 %–61.3 %] | 3/10 (30.0 %) |
| Devstral 24B | 20 (20) | 5.0 % [1.7 %–13.7 %] | **0.0 % [0.0 %–16.1 %]** | 0.0 % [0.0 %–0.0 %] | 0.15 | 33.3 % [6.2 %–79.2 %] | 50.0 % [29.9 %–70.1 %] | 2/2 (100.0 %) |

Aprobación por posición del turno y estimación independiente (producto de las tasas por posición):

| Modelo | T1 | T2 | T3 | Independiente | Observado |
|---|---|---|---|---|---|
| Claude Sonnet 5 | 95.0 % | 95.0 % | 90.0 % | 81.2 % | 90.0 % |
| Gemma 4 26B | 50.0 % | 20.0 % | 5.0 % | 0.5 % | 0.0 % |
| Qwen3-Coder 30B | 20.0 % | 20.0 % | 10.0 % | 0.4 % | 10.0 % |
| Devstral 24B | 10.0 % | 5.0 % | 0.0 % | 0.0 % | 0.0 % |
| GPT-5.6 Sol | 65.0 % | 50.0 % | 35.0 % | 11.4 % | 35.0 % |

Turnos no aprobados por causa:

| Modelo | No aprobados | Regresión | Requisito nuevo | Sin entrega | Otra (alcance, tipos) | Satisfacción nueva | Retención |
|---|---|---|---|---|---|---|---|
| Claude Sonnet 5 | 4 | 0 | 2 | 0 | 2 | 96.7 % [88.6 %–99.1 %] | 100.0 % |
| Gemma 4 26B | 45 | 9 | 8 | 23 | 5 | 41.7 % [30.1 %–54.3 %] | 86.1 % |
| Qwen3-Coder 30B | 50 | 8 | 5 | 34 | 3 | 40.0 % [28.6 %–52.6 %] | 88.9 % |
| Devstral 24B | 57 | 10 | 28 | 14 | 5 | 15.0 % [8.1 %–26.1 %] | 74.1 % |
| GPT-5.6 Sol | 30 | 5 | 13 | 3 | 9 | 70.0 % [57.5 %–80.1 %] | 92.8 % |

Turnos sin entrega por motivo y turnos que no se pudieron medir por el código del agente:

| Modelo | CYCLE_LIMIT | TECHNICAL_FAILURE | TIMEOUT | Con reintentos de transporte | Con HEAD movido |
|---|---|---|---|---|---|
| Claude Sonnet 5 | 0 | 0 | 0 | 8 | 0 |
| Gemma 4 26B | 18 | 11 | 1 | 0 | 0 |
| Qwen3-Coder 30B | 42 | 0 | 0 | 0 | 0 |
| Devstral 24B | 19 | 1 | 0 | 0 | 0 |
| GPT-5.6 Sol | 3 | 2 | 0 | 2 | 0 |

## Costo y tiempo

| Brazo | Modelo | Turnos | Costo (USD) | USD por turno | Horas | Min por turno | Entrada cacheada | Llamadas sin tokens |
|---|---|---|---|---|---|---|---|---|
| B | Claude Sonnet 5 | 60 | 25.81 | 0.430 | 7.8 | 7.8 | 4.6 % | 0 |
| B | Gemma 4 26B | 60 | 0.00 | 0.000 | 6.0 | 6.0 | 0.0 % | 0 |
| B | Qwen3-Coder 30B | 60 | 0.00 | 0.000 | 12.3 | 12.3 | 0.0 % | 0 |
| B | Devstral 24B | 60 | 0.00 | 0.000 | 6.9 | 6.9 | 0.0 % | 0 |
| B | GPT-5.6 Sol | 60 | 24.08 | 0.401 | 5.5 | 5.5 | 77.2 % | 0 |

Los modelos locales no tienen costo por token: su costo es el de la GPU durante sus horas (npm run episode:budget).

Definiciones: docs/diseno-linea-base-episodios.md. Intervalos: Wilson al 95 % (agregados) y bootstrap de familias completas (TEE por familia y Δ).
