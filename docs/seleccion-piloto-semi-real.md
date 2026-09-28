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
