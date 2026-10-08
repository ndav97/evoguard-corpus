# EvoGuard Corpus — Estado del proyecto (2026-10-02, actualizado 2026-10-08, tarde)

Sustituye a `estado-del-proyecto-2026-09-27.md`.

## 0. Dónde estamos (2026-10-05)

**Prioridad: terminar el piloto (S001–S020).** El corpus definitivo (S021–S060) queda en pausa por decisión del tesista. Se retoma cuando el piloto esté generado, auditado y analizado.

| Frente | Estado | Siguiente paso |
|---|---|---|
| Piloto S001–S020 | Calibrado, imágenes verificadas, mutantes revisados, contexto medido y peticiones con revisión independiente. Los ensayos del 2026-10-04 están en PASS | Repetir los ensayos, porque el 2026-10-05 cambió el pipeline (ver abajo); después, pasos con modelos |
| Corpus definitivo S021–S060 | 40 bases elegidas. S021–S030 redactadas con 5 turnos, en borrador y **sin calibrar** | En pausa. Al retomar: `scripts\real\calibrar-s021-s030.cmd` |

**Cambio de pipeline del 2026-10-05 (commit `c975269`):**
- Admite familias de 5 turnos (V1–V5) además de las de 3 y añade `test_mode: script` (suite lanzada con el script `test` del paquete).
- El piloto no cambia: sigue con 3 turnos y modo directo, y las pruebas de `tests/real-families.test.mjs` y `tests/strata.test.mjs` pasan (37/37).
- Aun así toca `generate`, `audit`, `mutants`, `rehearse`, `suite` y el motor de ejecución, así que **hay que repetir los ensayos de S900 y S001–S020 antes de generar.**
- `npm test` en la máquina virtual de Cowork da 5 archivos en fallo, los mismos antes y después del cambio: las pruebas del oráculo de UI necesitan el Chromium de Playwright, que no está instalado allí. En el PC no aplica.

### Avance de la fase A (2026-10-07)
- **2026-10-06, primer ensayo mínimo (S900):** falló por un error del cambio de 5 turnos; el bucle recorría V1–V5. Corregido en `a339957`.
- **2026-10-06/07, ensayos:** S900 y 19 familias en PASS (commit `e88ecba`).
  - S014 quedó BLOCKED. En V1, el intento que debía aceptarse superó los 30 minutos porque el límite del intento incluía la evaluación del pipeline, y la suite de S014 tarda unos 520 s.
  - **Decisión del tesista:** el límite del intento mide solo el trabajo del modelo, y la evaluación tiene su propio límite de 30 minutos por operación (`8173e50`, `docs/operational-decisions.md`).
- **2026-10-07/08, segunda ronda:** S900 y S001–S011 en PASS (`70a24ce`). En S012–S014 Docker Desktop se colgó: la suite y `docker create` quedaron bloqueados durante horas. No es un fallo del código ni de las familias, que pasaron el día 6 con las mismas imágenes.
  - **Corrección en el lanzador** (`411a3b8`), sin tocar código de la huella:
    - se salta los ensayos vigentes;
    - pone un límite de 150 minutos por familia;
    - si una familia falla, reinicia Docker cuando no responde, elimina los contenedores que queden y la reintenta una vez;
    - guarda la salida de cada ensayo.
- **Siguiente paso:** volver a lanzar `scripts\real\ensayar-familias.cmd`. Solo ensayará S012–S020 (unas 6 h).

### Línea base por episodios y presupuesto (decisiones del 2026-10-08)
**Métricas.** La línea base y la comparación final usan las métricas de **EvoGenUI-Bench** (Peng et al., 2026): TP, **TP@n (episodios exitosos, equivalente a la TEE)**, CPT y APR, más la TER. Se usan los **cinco modelos** en ambas fases y se **mantienen 60 familias**.
- **Episodio:** un solo modelo recorre una familia sobre su propia salida, sin reasignación ni reparación. El oráculo mide sin mostrarse al modelo.
- **Diseño:** `docs/diseno-linea-base-episodios.md` y `config/experiment.json`.
- **Código:** `runner/episode/`; 34 pruebas y una revisión independiente.

**Presupuesto máximo: S/ 5 000** (≈ 1 453 USD). Decisiones de costo mínimo (`b52ea52`):
1. **Referencias del corpus = parches de referencia calibrados.** **No se generan referencias con modelos**: `corpus:generate` sale del plan. Es un cambio metodológico que se declara en la tesis.
2. **Etiquetas de riesgo π0 con un modelo local:** fase `pi0`, 400 turnos, solo GPU.
3. **Piloto** con 1 repetición: 300 turnos.
4. **Final:** 1 episodio × 1 repetición, brazos B y E, cinco modelos: 1 000 turnos. I y G se descartan.
5. **Tope de gasto en el código.** El ejecutor no inicia un episodio que superaría 1 235 USD (el límite menos un 15 % de reserva). Se consulta con `npm run episode:budget`.

| Fase | Turnos | Costo típico |
|---|---|---|
| Piloto | 300 | ~200 USD |
| π0 (local) | 400 | ~25 USD |
| Final | 1 000 | ~675 USD |
| GPU extra y reserva | | ~165 USD |
| **Total** | | **≈ 1 065 USD ≈ S/ 3 700** |

Si la caché de prompts funciona, el total baja a unos S/ 2 100. Los precios son de lista y de terceros: hay que sustituirlos por los de Synterolink en `config/experiment.json`.

### Plan para cerrar el piloto (actualizado 2026-10-08, costo mínimo)

| Fase | Paso | Quién | Comando o entregable |
|---|---|---|---|
| A. Ensayos | A1. Ensayos de S900 y S001–S020 (en curso; S012 y S013 en PASS) | Tesista, PC | `scripts\real\ensayar-familias.cmd` (retoma solo) |
| | A2. Ensayo del ejecutor de episodios (sin modelos, unos 20 min) | Tesista, PC | `scripts\episode\ensayar-episodios.cmd` |
| B. Revisión humana | Hoja de revisión de las 60 peticiones y veredictos | Claude prepara, tesista revisa | Artefacto de revisión |
| C. Proveedores comerciales | Sonda de Sonnet, variante con **caché activada**, diagnóstico de los tres; **precios reales de Synterolink** | PC + Claude | `npm run providers -- probe …`, `npm run providers:diagnose` |
| D. Modelos locales | Banco en Vast.ai, elección de `local_a`/`local_b` (y del modelo π0), recongelar modelos y contexto | GPU + Claude + tesista | `docs/gpu-vast-ai.md` |
| **E. Calibración de costo** | 5 episodios × 3 comerciales (S001–S005; 45 turnos, unos 50 USD); revisar costo y tiempo reales | Tesista, PC | `scripts\episode\linea-base-piloto.cmd -Proveedores openai,anthropic,google -Familias S001,S002,S003,S004,S005` y `npm run episode:budget` |
| **F. Línea base del piloto** | Los 100 episodios restantes (5 modelos × 20 familias) | Tesista, PC + GPU | `scripts\episode\linea-base-piloto.cmd` |
| G. Análisis | Tabla por modelo al estilo del paper, costo por modelo y redacción de resultados del piloto | PC + Claude | `npm run episode:analyze -- --experiment linea-base-piloto` |

**Notas:**
- **Orden:** A y B no necesitan modelos. E necesita C y D.
- **Calibración:** con sus resultados se confirman el costo por turno, el tiempo y si la caché funciona, antes de seguir.
- **Corpus definitivo:** se retoma después de G. Sin generación con modelos, cada familia necesita autoría, calibración, imagen y ensayo. Después vienen las fases π0 (modelo local) y final.
- **S014:** un test inestable ajeno al cambio pasó a `known_failures` (`3d47e7f`).

## 1. Decisión del día: corpus solo semi-real

El tesista decidió que el corpus de EvoGuard UI **ya no usa familias sintéticas puras**. Se construye solo con el estrato semi-real: repositorios públicos fijados en un commit V0 verificado, con cambios controlados redactados para el estudio. La configuración está en `config/strata.json`.

| Aspecto | Antes | Ahora |
|---|---|---|
| Estratos activos | Sintético (F001–F010) y semi-real (S001–S010) | Solo semi-real |
| Piloto | 20 familias: 10 sintéticas y 10 semi-reales | **20 familias semi-reales (S001–S020)**, 3 turnos por episodio |
| Corpus definitivo | 60 familias, 2 episodios × 5 turnos | Igual, todas semi-reales |
| F001–F010 | En `families/` y `oracle/` | Archivadas en `archive/sintetico/` (fuera del corpus, del análisis y de la generación) |
| Banco de modelos locales | F001 V0–V3 + S001:V1, S005:V1 | S001:V1, S003:V1, S005:V1, S007:V1 |

## 2. Familias semi-reales

| Familias | Estado |
|---|---|
| S001–S010 | CALIBRATED, imágenes verificadas, ensayos repetidos en PASS el 2026-10-04 con el pipeline actual, tests ocultos reforzados con mutantes y peticiones revisadas |
| S011–S020 | CALIBRATED (2026-10-03; S012, S016 y S018 recalibradas el 2026-10-04 con tests reforzados), imágenes verificadas, ensayos en PASS, mutantes con solo sobrevivientes equivalentes y contexto medido. Falta la revisión independiente de sus 30 peticiones |

### Nuevas bases (S011–S020)

| Familia | Repositorio (paquete) | Runner | Zona del cambio | T001 / T002 / T003 |
|---|---|---|---|---|
| S011 | jaegertracing/jaeger-ui (`packages/jaeger-ui`) | vitest | `TracePageSearchBar` | Nombres accesibles de los botones / recuento anunciado / Enter y Mayús+Enter |
| S012 | navidrome/navidrome (`ui`) | vitest | `SaveQueueDialog` | Nombre recortado y recuento / aviso de error / cola vacía |
| S013 | traefik/traefik (`webui`) | vitest | `TraefikResourceStatsCard` | Leyenda accesible / porcentajes que suman 100 / datos incoherentes |
| S014 | glific/glific-frontend (`.`) | vitest | `Timer` | Temporizador accesible / minutos en la última hora / refresco cada 30 s |
| S015 | gregrickaby/viewer-for-reddit (`.`) | vitest | `SubscriptionFilterList` | Búsqueda tolerante / estado vacío / orden por suscriptores |
| S016 | kawalcovid19/wargabantuwarga.com (`.`) | jest | `SearchForm` | Recorte de espacios / botón para borrar / mínimo de 2 caracteres |
| S017 | Automattic/studio (`apps/ui`) | vitest | Barra de direcciones de la vista previa | Host sin esquema / borrar recientes / ocultar la página actual |
| S018 | processing/p5.js-web-editor (`.`) | jest | `Toast` y sus acciones | Escape / duración completa / avisos de error |
| S019 | usememos/memos (`web`) | vitest | `utils/format.ts` | Tamaños sin unidades inválidas / documentos de oficina / extensión del nombre |
| S020 | openmrs/openmrs-esm-form-builder (`.`) | vitest | Rango de las preguntas numéricas | Números válidos / paso / quitar el rango |

**Bases descartadas al preparar el lote:**
- moollaza/repo-remover: usa bun;
- BearStudio/start-ui-web: tests en modo navegador;
- kafbat/kafka-ui: tests que dependen de código generado que no está en el repositorio;
- hotosm/tasking-manager: los tests solo corren con `craco test`.

**Composición del piloto:**
- **Runners:** 7 vitest y 3 jest en el lote nuevo (13 y 7 en total). No quedaban más bases jest válidas de organizaciones nuevas.
- **Organizaciones:** todas distintas.
- **Dominios:** S020 (formularios clínicos) comparte el área de salud con S004 (medplum).

### Calibración de S011–S020 (2026-10-03)

Seis familias pasaron a la primera. Las otras cuatro se corrigieron (commit `3eee772`) y pasaron en la segunda ejecución.

| Familia | Tests ocultos que fallan antes (T001 · T002 · T003) | Tests de la suite en V0 | Corrección necesaria |
|---|---|---|---|
| S011 | 3/3 · 2/4 · 2/5 | 3754 | — |
| S012 | 3/4 · 3/4 · 3/4 | 761 | — |
| S013 | 2/3 · 3/5 · 3/4 | 161 | 4 fallos de V0 en `known_failures` |
| S014 | 4/4 · 4/6 · 3/4 | 2260 | — |
| S015 | 3/4 · 2/4 · 3/4 | 1617 | T003: las opciones del Select de Mantine se buscan por texto |
| S016 | 2/3 · 3/4 · 2/6 | 363 | Botón renombrado a «Kosongkan kata kunci» (rompía tests existentes que buscan `/cari/i`); `provinces.test.ts` como archivo conocido |
| S017 | 4/5 · 3/4 · 2/3 | 921 | — |
| S018 | 2/4 · 2/4 · 1/4 | 460 | 8 tests de mongodb-memory-server (sin red) en `known_failures` |
| S019 | 4/5 · 2/3 · 4/5 | 1727 | — |
| S020 | 2/5 · 4/5 · 3/3 | 118 | — |

`known_failures` admite ahora rutas de archivos de test enteros, que ya no se ejecutaban en V0. Para soportarlo cambiaron `prepare`, `pipeline` y `audit` del pipeline semi-real, así que hay que repetir los ensayos de S001–S010 junto con los de S011–S020.

### Ensayos, mutantes y contexto (2026-10-04)

- **Ensayos:** S900 y S001–S020 en PASS. S015 falló una vez por un test intermitente de `SidebarNav` (`waitFor` de 1 s con la máquina cargada), ajeno al cambio. Sus dos tests de plegado pasaron a `known_failures`.
- **Mutantes de S011–S020:** 101 eliminados y 24 sobrevivientes. De esos, 18 son equivalentes y 6 eran debilidades (S012 T002, S016 T001, S018 T001). Las debilidades se corrigieron con tests ocultos nuevos y, tras recalibrar, se eliminan. Solo sobreviven equivalentes. Detalle en `docs/fuerza-tests-ocultos-s011-s020-2026-10-04.md`.
- **Contexto:** el primer mensaje cabe en 8k, 16k y 32k tokens para las 20 familias. El margen más justo es el de S014 con 32k: entra solo el árbol y quedan 199 tokens.

## 3. Pendientes

### En el PC, sin modelos
1. ~~Llevar al PC el archivo del estrato sintético y las familias S011–S020~~: hecho en el commit `e50205c`.
2. ~~Calibrar S011–S020~~: hecho el 2026-10-03.
3. ~~Preparar imágenes, ensayar, mutantes y contexto~~: hecho el 2026-10-04.
4. ~~Revisión independiente de las 30 peticiones nuevas y del triaje de mutantes~~: hecha el 2026-10-04 (`docs/revision-peticiones-s011-s020-2026-10-04.md`). Hubo 0 hallazgos altos, 4 medios y 5 bajos, con 6 aclaraciones aplicadas. El segundo triaje coincide en 22 de 24 veredictos y añadió un test en S018 T002.
5. ~~Recalibrar S018~~: hecho el 2026-10-04. Pasa los tres turnos y el mutante `toast.js:8` queda eliminado; sus 3 sobrevivientes son equivalentes.
6. ~~S016 T002~~: la referencia descarta la búsqueda automática pendiente al borrar. Verificado el 2026-10-04: calibración OK, mutantes 1,00 y ensayo en PASS.
7. **Revisión humana** de todas las peticiones semi-reales.

### Corpus definitivo (40 familias más) — EN PAUSA
- **Bases elegidas (2026-10-05):** S021–S060, en `docs/seleccion-corpus-definitivo-2026-10-05.md` y `scripts/mine/bases-corpus-definitivo.txt`.
  - Todas son GREEN y hay como máximo 2 por organización contando el piloto.
  - Son 17 vitest y 23 jest, así que el corpus completo queda en 30 y 30.
  - Las suites tardan 4 minutos como máximo.
  - Salen de tres rondas de minería: 10 bases de la ronda 1, 30 de 55 verdes en la ronda 2 y 38 de 59 en la ronda 3. Quedan reservas documentadas.
- **Tanda 1 (S021–S030), 2026-10-05:** redactadas con 5 turnos cada una, en borrador. Son karma, kubeapps, tekton-dashboard, weave-gitops, traces-drilldown, netobserv, tilt, meshery, juju-dashboard y artifacthub.
  - Para admitirlas, el pipeline acepta ahora familias de 5 turnos (V1–V5) y `test_mode: script`, que usan kubeapps y tilt (craco/react-scripts).
  - **Estado al pausar:** no se ha ejecutado ningún test de estas familias. Los parches se aplican en orden sobre V0 y el validador las acepta como borrador. Los riesgos que anotaron los autores están en `.artifacts/s21/Sxxx-notes.txt` (en el PC).
  - **Riesgos principales:** S021 y S024 convierten los avisos de consola en fallo; S024 comprueba tipos en los tests; S025 y S026 dependen de componentes de Grafana y PatternFly en jsdom; S029 usa el rol `group` en happy-dom.
  - Al retomar: `scripts\real\calibrar-s021-s030.cmd`. Los clones de trabajo de la nube (rama `evo`) no se conservan; todo lo necesario está en `families-real/`.
- **Después:** tandas S031–S040, S041–S050 y S051–S060.
- **Disco:** el disco virtual de Docker no encoge solo. Si C: se llena, hay que ejecutar `scripts\mine\liberar-espacio-docker.cmd` y después `compactar-disco-docker.cmd`.

### Con modelos
- Sin cambios: intermediario de Sonnet, banco de modelos locales (ahora solo con tareas semi-reales), congelar `config/models.json` y `config/context.json`, generar y auditar S001–S020, y `npm run analysis`.
- La revisión 2 de F001 deja de ser necesaria, porque F001 está archivada.
