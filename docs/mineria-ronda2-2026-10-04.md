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
