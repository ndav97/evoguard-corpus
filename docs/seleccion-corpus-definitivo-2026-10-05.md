# Selección de las 40 bases del corpus definitivo (S021–S060), 2026-10-05

**Contexto:** el corpus definitivo tiene 60 familias semi-reales: 30 de entrenamiento, 10 de validación y 20 de prueba. El piloto S001–S020 cubre 20; estas 40 completan el resto.

## Reserva de partida

| Origen | Verificadas en verde |
|---|---|
| Ronda 1 (2026-09-26), sin usar | 10 |
| Ronda 2 (2026-10-04) | 30 de 55 (28 GREEN y 2 con fallos conocidos) |
| Ronda 3 (2026-10-05) | 38 de 59 (34 GREEN y 4 con fallos conocidos) |

En total hay unas 70 bases verificadas. Evidencia: `docs/mineria-ronda2/verificacion/`, `docs/mineria-ronda3/verificacion/` y `.artifacts/baselines*`.

## Criterios de selección

1. **Solo bases GREEN:** dos ejecuciones idénticas sin red y sin fallos. Las que tienen fallos conocidos quedan de reserva.
2. **Como máximo 2 repositorios por organización en todo el corpus**, contando el piloto. Así se limita que familias de un mismo equipo y estilo de código caigan en particiones distintas. Si dos familias comparten organización, deben ir a la misma partición.
3. **Variedad de dominios:** se evita repetir el dominio de una familia del piloto cuando hay alternativa.
4. **Equilibrio de runners:** el piloto tiene 13 vitest y 7 jest; estas 40 tienen 17 vitest y 23 jest. El corpus queda en 30 vitest y 30 jest.
5. **Suite de 4 minutos como máximo.** La suite se ejecuta muchas veces durante la generación y el oráculo, así que quedan de reserva gazebo (374 s), image-builder (316 s) y neo4j-browser (602 s).
6. **Fuera:** licencias sin confirmar (pagopa selfcare), dependencias de servicios (a2j-rechtsantragstelle, platform-forms-client), apps de escritorio (nuclear, k6-studio), interfaces muy pequeñas (esignet, con unas 2 000 líneas) y suites con muchos snapshots (gitops-console-plugin).

## Las 40 bases

| ID | Repositorio | Paquete | Dominio | Runner | Líneas | Tests | Suite (s) | Licencia | V0 |
|---|---|---|---|---|---|---|---|---|---|
| S021 | prymitive/karma | `ui` | Alertas de monitorización | jest | 13 242 | 1141 | 16 | APACHE-2.0 | `4d5a17a594d0` 2026-09-29 |
| S022 | vmware-tanzu/kubeapps | `dashboard` | Catálogo de aplicaciones Kubernetes | jest | 20 590 | 1095 | 36 | APACHE-2.0 | `b70ead2c4768` 2026-01-13 |
| S023 | tektoncd/dashboard | `.` | CI/CD en Kubernetes | vitest | 12 388 | 613 | 50 | APACHE-2.0 | `868ba5bbafb7` 2026-10-02 |
| S024 | weaveworks/weave-gitops | `.` | GitOps | jest | 18 122 | 231 | 39 | APACHE-2.0 | `936e848c4e00` 2026-01-26 |
| S025 | grafana/traces-drilldown | `.` | Exploración de trazas | jest | 17 383 | 589 | 14 | AGPL-3.0 | `47aba3406025` 2026-10-02 |
| S026 | netobserv/network-observability-console-plugin | `web` | Observabilidad de red | jest | 50 156 | 607 | 30 | APACHE-2.0 | `aba92a5381ef` 2026-10-02 |
| S027 | tilt-dev/tilt | `web` | Entorno de desarrollo | jest | 20 641 | 360 | 19 | APACHE-2.0 | `3ae48d2c15a5` 2026-10-02 |
| S028 | meshery/meshery | `ui` | Gestión de service mesh | vitest | 92 322 | 2805 | 232 | APACHE-2.0 | `696f64dd1f95` 2026-10-04 |
| S029 | canonical/juju-dashboard | `.` | Operación de despliegues | vitest | 39 127 | 2357 | 166 | LGPL-3.0 | `f07e90f270fb` 2026-09-30 |
| S030 | artifacthub/hub | `web` | Registro de paquetes cloud-native | vitest | 45 247 | 1975 | 175 | APACHE-2.0 | `c98b3a61f97a` 2026-09-28 |
| S031 | cncf/clomonitor | `web` | Salud de proyectos open source | vitest | 7 514 | 216 | 29 | APACHE-2.0 | `dad5b7108536` 2026-09-28 |
| S032 | Kuadrant/kuadrant-console-plugin | `.` | Gestión de APIs | jest | 36 258 | 548 | 21 | APACHE-2.0 | `684caec0546c` 2026-10-02 |
| S033 | openshift-pipelines/console-plugin | `.` | Pipelines en consola OpenShift | jest | 65 484 | 699 | 37 | APACHE-2.0 | `9f09bceba7e5` 2026-10-04 |
| S034 | kubev2v/migration-planner-ui | `apps/agent-ui` | Migración de máquinas virtuales | vitest | 26 333 | 301 | 35 | APACHE-2.0 | `8dbfb4cd32a2` 2026-10-04 |
| S035 | konveyor/tackle2-ui | `client` | Modernización de aplicaciones | jest | 81 340 | 560 | 22 | APACHE-2.0 | `9b21407e7987` 2026-10-01 |
| S036 | flyteorg/flyteconsole | `packages/oss-console` | Flujos de ML | jest | 41 478 | 1057 | 55 | APACHE-2.0 | `04d6a334cb07` 2026-08-23 |
| S037 | apache/airflow | `airflow-core/src/airflow/ui` | Orquestación de datos | vitest | 89 202 | 1525 | 178 | APACHE-2.0 | `6f5d5d06b177` 2026-10-04 |
| S038 | amundsen-io/amundsen | `frontend/amundsen_application/static` | Catálogo de datos | jest | 30 371 | 1748 | 27 | APACHE-2.0 | `469c1b778340` 2026-09-10 |
| S039 | kubeflow/model-registry | `clients/ui/frontend` | Registro de modelos de ML | jest | 39 598 | 879 | 40 | APACHE-2.0 | `56b05282dcd5` 2026-10-02 |
| S040 | qdrant/qdrant-web-ui | `.` | Base de datos vectorial | vitest | 26 947 | 221 | 19 | APACHE-2.0 | `b2232842dad8` 2026-10-02 |
| S041 | aws/graph-explorer | `packages/graph-explorer` | Exploración de grafos | vitest | 48 529 | 2807 | 185 | APACHE-2.0 | `c671c2a359f3` 2026-10-04 |
| S042 | pinterest/querybook | `.` | Cuadernos SQL | jest | 82 774 | 325 | 20 | APACHE-2.0 | `3f26532bfc36` 2026-09-16 |
| S043 | VolkovLabs/business-table | `.` | Paneles de negocio (plugin Grafana) | jest | 20 667 | 836 | 28 | APACHE-2.0 | `4201aa055e62` 2025-09-29 |
| S044 | RedHatInsights/insights-inventory-frontend | `.` | Inventario de sistemas | jest | 39 375 | 1742 | 82 | APACHE-2.0 | `3a2b1bfa57bb` 2026-10-02 |
| S045 | project-koku/koku-ui | `apps/koku-ui-hccm` | Gestión de costos cloud | jest | 86 176 | 1550 | 47 | APACHE-2.0 | `0207f98fd6fa` 2026-10-01 |
| S046 | Enterprise-CMCS/macpro-mdct-mcr | `services/ui-src` | Reportes de salud pública (EE. UU.) | jest | 34 106 | 1274 | 45 | CC0-1.0 | `12d75c01fe28` 2026-10-02 |
| S047 | CMSgov/easi-app | `.` | Gobernanza TI pública (EE. UU.) | vitest | 82 339 | 1090 | 147 | APACHE-2.0 | `fa7ed3920447` 2026-10-02 |
| S048 | betagouv/mon-entreprise | `site` | Simulador para empresas (Francia) | vitest | 53 470 | 956 | 97 | MIT | `05cb5be511d3` 2026-10-02 |
| S049 | mosip/inji-web | `inji-web` | Identidad digital | jest | 11 036 | 978 | 12 | MIT | `a9f4f829d307` 2026-04-27 |
| S050 | mitodl/ocw-studio | `.` | Publicación de cursos | jest | 14 996 | 845 | 18 | BSD-3-CLAUSE | `4909ad7a0344` 2026-10-02 |
| S051 | ebi-uniprot/uniprot-website | `.` | Bioinformática (proteínas) | jest | 87 694 | 1992 | 38 | MIT | `1442948c7fa8` 2026-10-01 |
| S052 | hotosm/fAIr | `frontend` | Cartografía humanitaria con IA | vitest | 51 121 | 231 | 16 | AGPL-3.0 | `9eaaf4ec7854` 2026-10-02 |
| S053 | canonical/snapcraft.io | `.` | Tienda de paquetes | vitest | 32 382 | 960 | 86 | LGPL-3.0 | `734bd0eb5cbc` 2026-10-01 |
| S054 | Automattic/sensei | `.` | Cursos en línea (WordPress) | jest | 33 831 | 415 | 42 | LGPL-3.0 | `f93ac7c7aa4d` 2026-10-02 |
| S055 | pods-framework/pods | `.` | Contenido personalizado (WordPress) | jest | 35 514 | 512 | 16 | LGPL-3.0 | `07ed152f8cf4` 2026-09-13 |
| S056 | element-hq/element-call | `.` | Videollamadas | vitest | 34 846 | 826 | 75 | AGPL-3.0 (doble licencia con comercial) | `8835a6d75d36` 2026-10-04 |
| S057 | mozilla/pontoon | `translate` | Traducción colaborativa | vitest | 19 323 | 785 | 56 | BSD-3-CLAUSE | `87ee2de97968` 2026-09-25 |
| S058 | openedx/frontend-app-learner-portal-enterprise | `.` | Portal de aprendizaje corporativo | jest | 37 279 | 1546 | 166 | AGPL-3.0 | `3c21d1058c8f` 2026-09-21 |
| S059 | openmrs/openmrs-esm-patient-management | `packages/esm-service-queues-app` | Gestión de pacientes | vitest | 8 218 | 246 | 42 | MPL-2.0 | `e7b14cfb17e0` 2026-09-25 |
| S060 | jenkinsci/pipeline-graph-view-plugin | `.` | Visualización de pipelines CI | vitest | 9 953 | 189 | 13 | MIT | `9df19e6ceed2` 2026-10-04 |

La lista con el SHA completo de cada V0 está en `scripts/mine/bases-corpus-definitivo.txt`.

## Reservas (por orden de preferencia)

1. **GREEN:**
   - RedHatInsights/policies-ui-frontend
   - Altinity/clickhouse-grafana
   - argoproj/argo-workflows
   - Enterprise-CMCS/macpro-mdct-seds
   - VolkovLabs/business-variable
   - RedisGrafana/grafana-redis-app
   - litmuschaos/litmus
   - opendatahub-io/odh-dashboard (gen-ai)
   - grafana/metrics-drilldown
   - napari-hub
   - infinispan-console
2. **Suite lenta:** codecov/gazebo, osbuild/image-builder-frontend y neo4j/neo4j-browser.
3. **Con fallos conocidos:** kedro-viz, Signalen/frontend y distributed-load-testing-on-aws.

## Pasos siguientes

1. **Redactar las familias S021–S060 con 5 turnos cada una**: peticiones, tests ocultos y referencias. Se hará en tandas de 10, como S011–S020.
2. **Ampliar a 5 turnos** las familias del piloto que pasen al corpus definitivo.
3. **Por cada tanda:** calibrar, preparar las imágenes, ensayar, ejecutar mutantes y contexto, y hacer la revisión independiente.
4. **Particiones:** se asignarán por familia completa, manteniendo juntas las familias de una misma organización. S001–S020 pasan antes por el piloto.
