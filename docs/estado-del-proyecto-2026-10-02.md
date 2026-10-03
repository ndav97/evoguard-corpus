# EvoGuard Corpus — Estado del proyecto (2026-10-02)

Sustituye a `estado-del-proyecto-2026-09-27.md`.

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
| S001–S010 | CALIBRATED, imágenes verificadas, ensayos en PASS, tests ocultos reforzados con mutantes y peticiones revisadas. Listas para generar en cuanto se congelen los modelos |
| S011–S020 | **DRAFT**: peticiones, tests ocultos y referencias redactados el 2026-10-02. Los 30 parches de referencia se aplican en orden sobre su V0, pero los tests aún **no se han ejecutado**, porque desde la nube no hay acceso al registro de npm. Falta calibrarlas en el PC |

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

## 3. Pendientes

### En el PC, sin modelos
1. **Llevar al PC el archivo del estrato sintético** (`archive/sintetico/`, `config/strata.json`, cambios en `runner/` y en las pruebas) y las familias S011–S020.
2. **Calibrar** `scripts\real\calibrar-familias-reales.cmd -Familia S0xx` para S011–S020 y corregir lo que falle (`docs/autoria-familias-semi-reales.md`). S013 y S018 parten de bases `GREEN_WITH_KNOWN_FAILURES`: hay que añadir sus fallos conocidos a `known_failures`.
3. **Preparar imágenes, ensayar, ejecutar `real:mutants` y `real:context`** para S011–S020.
4. **Revisión independiente** de las 30 peticiones nuevas y revisión humana de todas las peticiones semi-reales.

### Con modelos
- Sin cambios: intermediario de Sonnet, banco de modelos locales (ahora solo con tareas semi-reales), congelar `config/models.json` y `config/context.json`, generar y auditar S001–S020, y `npm run analysis`.
- La revisión 2 de F001 deja de ser necesaria, porque F001 está archivada.
