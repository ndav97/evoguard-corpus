# Piloto semi-real — 10 bases seleccionadas (27/09/2026)

Seleccionadas entre las 34 bases V0 verificadas. Criterios:
- Todas en verde: sin fallos conocidos.
- Un repo por organización.
- 10 dominios distintos.
- 6 con vitest y 4 con jest.
- Paquete de la app entre ~6 000 y ~37 000 líneas.

| Familia | Repo | Paquete | V0 | Licencia | Dominio | Líneas | Tests | Suite | Runner |
|---|---|---|---|---|---|---|---|---|---|
| S001 | kopia/htmlui | `.` | `047971b3a2e8` | Apache-2.0 | Copias de seguridad | 8 082 | 495 | 31 s | vitest |
| S002 | openedx/frontend-app-gradebook | `.` | `0793239862a7` | AGPL-3.0 | Educación (calificaciones) | 5 926 | 411 | 34 s | jest |
| S003 | authelia/authelia | `web` | `efd4558de68a` | Apache-2.0 | Autenticación | 16 354 | 1 564 | 69 s | vitest |
| S004 | medplum/medplum | `packages/app` | `2a810b6f7eaf` | Apache-2.0 | Salud (FHIR) | 11 430 | 469 | 118 s | vitest |
| S005 | mozilla/fx-private-relay | `frontend` | `8c18bed5018c` | MPL-2.0 | Privacidad (alias de correo) | 22 128 | 526 | 16 s | jest |
| S006 | morpheus65535/bazarr | `frontend` | `5dedccf28966` | GPL-3.0 | Multimedia (subtítulos) | 28 066 | 625 | 76 s | vitest |
| S007 | plausible/analytics | `assets` | `37e352c73dc5` | AGPL-3.0 | Analítica web | 26 768 | 521 | 14 s | jest |
| S008 | wger-project/react | `.` | `48179fe670b6` | AGPL-3.0 | Entrenamiento y nutrición | 34 106 | 1 120 | 54 s | vitest |
| S009 | gethomepage/homepage | `.` | `d001910e86f2` | GPL-3.0 | Panel de servicios | 33 434 | 1 755 | 203 s | vitest |
| S010 | argoproj/argo-cd | `ui` | `bba10dd8861c` | Apache-2.0 | DevOps (despliegue continuo) | 37 391 | 384 | 8 s | jest |

**Reservas**, en orden: mozilla/pontoon, navidrome/navidrome, jaegertracing/jaeger-ui, openmrs/openmrs-esm-form-builder y mozilla/treeherder. Si una base no se puede calibrar, se reemplaza por la primera reserva disponible de otra organización.

**Estado:**
- S001 está redactada (T001–T003, tests ocultos y referencia), pendiente de calibrar.
- S002–S010 se redactan después de validar S001, que sirve de plantilla.

## Ampliación a 20 familias (02/10/2026)

**Motivo:** el corpus pasa a ser solo semi-real (`config/strata.json`).

**Criterios:**
- Mismos que en el primer lote: base válida (GREEN o GREEN_WITH_KNOWN_FAILURES), un repositorio por organización (sin repetir las de S001–S010) y dominios distintos.
- Gestor de paquetes npm, pnpm o yarn.
- Tests ejecutables directamente con `npx vitest run` / `npx jest`.

| Familia | Repo | Paquete | V0 | Licencia | Dominio | Líneas | Tests | Suite | Runner |
|---|---|---|---|---|---|---|---|---|---|
| S011 | jaegertracing/jaeger-ui | `packages/jaeger-ui` | `1608a0014a89` | Apache-2.0 | Observabilidad (trazas) | 38 424 | 3 754 | 179 s | vitest |
| S012 | navidrome/navidrome | `ui` | `6b05189190a9` | GPL-3.0 | Música | 32 776 | 761 | 61 s | vitest |
| S013 | traefik/traefik | `webui` | `f08964179357` | MIT | Proxy inverso | 7 586 | 161 | 46 s | vitest |
| S014 | glific/glific-frontend | `.` | `8388dbfcce95` | AGPL-3.0 | Mensajería para ONG | 64 696 | 2 260 | 375 s | vitest |
| S015 | gregrickaby/viewer-for-reddit | `.` | `259ed474ffda` | MIT | Lector de foros sociales | 19 482 | 1 617 | 118 s | vitest |
| S016 | kawalcovid19/wargabantuwarga.com | `.` | `28efab953964` | MIT | Información de salud pública | 8 814 | 363 | 15 s | jest |
| S017 | Automattic/studio | `apps/ui` | `673311d4f5fe` | GPL-2.0 | Desarrollo local de WordPress | 42 213 | 921 | 124 s | vitest |
| S018 | processing/p5.js-web-editor | `.` | `b5464d7af83b` | LGPL-2.1 | Programación creativa | 31 560 | 460 | 32 s | jest |
| S019 | usememos/memos | `web` | `68db65243a16` | MIT | Notas personales | 55 879 | 1 727 | 121 s | vitest |
| S020 | openmrs/openmrs-esm-form-builder | `.` | `50b68474e131` | MPL-2.0 | Formularios clínicos | 9 587 | 118 | 30 s | vitest |

**Descartadas en este lote:**
- moollaza/repo-remover (bun);
- BearStudio/start-ui-web (tests en modo navegador);
- kafbat/kafka-ui (tests que dependen de código generado que no está en el repositorio);
- hotosm/tasking-manager (tests solo con `craco test`).

**Desviaciones:**
- Runners: 7 vitest y 3 jest en el lote (13/7 en total), porque no quedaban bases jest válidas de organizaciones nuevas.
- S014, S017 y S019 superan las ~37 000 líneas del primer lote.
- S020 comparte el área de salud con S004.

**Estado:** S011–S020 en DRAFT, pendientes de calibrar en el PC.
