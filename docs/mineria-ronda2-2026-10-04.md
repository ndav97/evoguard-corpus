# Ronda 2 de minería de bases V0 (2026-10-04)

**Objetivo:** reunir bases para las 40 familias semi-reales que faltan hasta el corpus definitivo de 60. El reparto es de 30 familias de entrenamiento, 10 de validación y 20 de prueba, por familia completa. El piloto S001–S020 cubre 20.

## Fuentes

| Origen | Bases |
|---|---|
| Ronda 1 (2026-09-26), verdes y sin usar | 10: openedx/frontend-app-learner-portal-enterprise, openedx/frontend-app-instructor-dashboard, mozilla/pontoon, mozilla/treeherder, openmrs/openmrs-esm-patient-chart, openmrs/openmrs-esm-patient-management, nukeop/nuclear, argoproj/argo-workflows, grafana/k6-studio (con fallos conocidos), cds-snc/platform-forms-client |
| Ronda 2 (esta) | 44 a verificar y 11 de reserva (`scripts/mine/repos-v0-ronda2.txt`) |

## Método

- **Candidatos:** desde la nube no se puede usar la API de búsqueda de GitHub. Por eso los candidatos salieron de una lista razonada de aplicaciones React con tests unitarios (observabilidad, Kubernetes, consolas de Red Hat, plugins de Grafana y Mattermost, datos, salud, educación, autoalojados…). En total, 266 repositorios con existencia comprobada (`git ls-remote`). Quedaron fuera las 66 bases de la ronda 1.
- **Análisis:** `scripts/mine/mine-baselines.mjs --repos …` con los mismos filtros que la ronda 1:
  - vitest o jest;
  - al menos 10 tests de UI y 15 tests;
  - entre 2 000 y 100 000 líneas en el paquete de la UI;
  - lockfile, licencia abierta, IA ≤ 30 % y actividad desde 2025-09-01.
- **V0:** el último commit anterior al 2026-10-04.
- **Evidencia:** `docs/mineria-ronda2/` (resúmenes, `screened-*.csv` con el motivo de cada descarte y `candidatos.txt`).

## Resultado

- **266 analizados, 56 aprobados.** Motivos de descarte principales:
  - demasiado grandes (más de 100 000 líneas): 73 en el primer lote;
  - pocos tests de UI;
  - sin vitest/jest;
  - sin React;
  - sin lockfile;
  - librerías;
  - historia con más del 30 % de commits con trazas de IA.
- **Tope de 3 repositorios por organización**, contando el piloto y las 10 bases de la ronda 1. Las organizaciones que lo superan (RedHatInsights y grafana) pasan a reserva.
- Se eliminó un duplicado: jorenn92/Maintainerr redirige a Maintainerr/Maintainerr.

## Verificación pendiente (PC)

`scripts\mine\verificar-bases-ronda2.cmd` hace con Docker lo mismo que en la ronda 1:
1. clona cada base en su V0;
2. instala sus dependencias con red;
3. ejecuta su suite dos veces sin red.

Resultados en `.artifacts\baselines-ronda2\`. En la ronda 1, 34 de 46 bases verificadas resultaron válidas, y al redactar familias se descartaron 4 de 14. Con 44 + 11 bases nuevas y 10 de la ronda 1 se espera llegar a las 40.

## Avisos para elegir las bases

- **Licencia por revisar:** element-hq/element-call.
- **Dependencias de servicios:** content-services/content-sources-frontend (pg), homarr-labs/homarr (drizzle y better-sqlite3), taskcluster/taskcluster (pg).
- **Muchos snapshots:** mattermost/mattermost-plugin-boards y broadinstitute/gnomad-browser.
- **Otros casos:**
  - continuedev/continue: la interfaz es una webview de extensión;
  - Maintainerr/Maintainerr: declara Node 26;
  - vmware-tanzu/kubeapps y weaveworks/weave-gitops: último commit en enero de 2026;
  - scratchfoundation/scratch-gui: un solo autor en la ventana.

## Verificación de la ronda 2 (2026-10-04, 15:48–18:51 hora de Lima)

Evidencia en `docs/mineria-ronda2/verificacion/`. De 55 bases, 28 quedaron GREEN y 2 GREEN_WITH_KNOWN_FAILURES. El resto:

| Resultado | N | Causa principal |
|---|---|---|
| RED | 7 | Suites que no llegan a ejecutarse en el entorno (Maintainerr pide Node 26; plugins de Mattermost, Yoast, linkerd) o tests de integración con red (scratch-www) |
| NO_TESTS / NO_REPORT | 11 | El runner directo no encuentra la configuración (che-dashboard, shlink, zipkin, ens, gnomad, homarr) o el script `test` choca con `--maxWorkers` (prometheus, thanos) |
| INSTALL_FAILED | 4 | insights-remediations, kubeflow/pipelines, content-sources, insights-advisor |
| FLAKY | 2 | synthetic-monitoring-app (2 tests), listenbrainz (13 tests dependientes de la fecha) |
| TIMEOUT | 1 | druid |

**Bases utilizables (tope de 3 por organización con el piloto):** karma, sensei, amundsen, insights-inventory, policies-ui, compliance (de la reserva), gazebo, kubeapps, element-call, odh-dashboard, tektoncd/dashboard, kedro-viz (2 suites conocidas), model-registry, traces-drilldown, metrics-drilldown, weave-gitops, image-builder, qdrant-web-ui, netobserv, airflow, koku-ui y tackle2-ui. Son **22**, más las 10 de la ronda 1, en total **32**. Quedan de respaldo, si se relaja el tope por organización, tasks, notifications y edge (RedHatInsights) y logs-drilldown, profiles-drilldown, infinity y oncall (grafana).

No alcanzan para 40 familias con margen, así que se hizo una ronda 3 (`docs/mineria-ronda3/`).

## Ronda 3 (2026-10-04)

Se analizaron 155 candidatos nuevos de administración pública (Singapur, EE. UU., Noruega, Alemania, Francia, Italia, Países Bajos, Canadá), salud e identidad (MOSIP, OpenCRVS), ciencia, educación (MIT ODL, OpenStax), datos y orquestación (Cadence, Flyte, Neo4j, CouchDB), consolas de OpenShift y CNCF, plugins de Grafana de terceros y plugins de WordPress.

**59 aprobados**, todos en la selección (`scripts/mine/repos-v0-ronda3.txt`). Siguiente paso: `scripts\mine\verificar-bases-ronda3.cmd`.

**Avisos:**
- **Licencia por revisar:** pagopa/pn-frontend, pagopa/selfcare-onboarding-frontend y buerokratt/Service-Module.
- **Dependencias de servicios:** nasa/earthdata-search, digitalservicebund/a2j-rechtsantragstelle y opengovsg/isomer.
- **Muchos snapshots:** redhat-developer/gitops-console-plugin.
