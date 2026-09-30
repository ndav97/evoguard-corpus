# Tareas sin modelos — progreso (desde 2026-09-29)

Encargo del usuario (2026-09-28 22:43, hora de Lima): avanzar una por una las tareas que no necesitan modelos mientras él repite `scripts\real\ensayar-familias.cmd` en su PC. Si se agota la capacidad, este archivo indica dónde retomar.

Restricción mientras corre el ensayo en el PC: no tocar código que forme parte de la huella semi-real (`runner/real/sources.mjs`).

| # | Tarea | Estado | Commit PC | Notas |
|---|---|---|---|---|
| 1 | Revisión independiente de la equidad de los oráculos F002–F010 | HECHA | | 260 casos: 0 NOT_DERIVABLE y 41 AMBIGUOUS, todos resueltos y reverificados. Adaptador, planes F003/F009 y textos visibles corregidos. `docs/revision-equidad-oraculos-2026-09-29.md` |
| 2 | Prefijo de productos de F003 y recalibración | HECHA | | S0xx→A0xx; P ya lo usa F001. Fixture, casos, plan, página de calibración, hash del fixture y spec-lock actualizados |
| 3 | Verificar los 9 mutantes pendientes de F009 | HECHA | | Los 9 son detectados; declarados en `tests/fixtures/calibration/F009.json` (24 mutantes). Resto de familias: ningún mutante sin declarar |
| 4 | Ensayo de generación y auditoría en una familia nueva (F002) | HECHA | | `npm run pipeline:rehearse-family -- F002`: V0→V3 aceptadas en el primer intento, auditoría PASS 5/5 y FROZEN en copia desechable. `docs/verification/family-rehearsal-f002.json` |
| 5 | Herramienta de fuerza de los tests ocultos semi-reales | HECHA (la ejecuta el usuario) | | `npm run real:mutants -- S001 … S010` en el PC, **después** de terminar el ensayo. Probada con S900: 3/3 eliminados |
| 6 | Corrida conjunta de calibraciones | HECHA | | F002–F010: 72/72 con el adaptador nuevo (correctas, versión anterior, mutantes y estabilidad 5/5). `docs/verification/calibration-2026-09-29.json` |

## Resultado (2026-09-29)

Las seis tareas están terminadas. `npm test`: 204/204.

Pendiente para el usuario, en su PC:
- terminar `scripts\real\ensayar-familias.cmd`;
- **después**, `npm run real:mutants -- S001 S002 S003 S004 S005 S006 S007 S008 S009 S010`;
- revisar los mutantes sobrevivientes con Claude.

Pendiente humano: revisión de los enunciados T001–T003 del estrato semi-real.

## Segunda tanda (encargo del 2026-09-29 19:56, hora de Lima: «hagamos todos los pasos»)

| # | Tarea | Estado | Commit PC | Notas |
|---|---|---|---|---|
| 7 | Revisión sistemática de las 30 peticiones semi-reales (petición ↔ referencia ↔ tests ocultos) | HECHA | `44317d9`, `7eb49c1` | 0 altos, 11 medios y 10 bajos; 21 correcciones, verificadas en el PC (referencias pasan y ensayo de S005 en PASS). `docs/revision-peticiones-semi-reales-2026-09-29.md` |
| 8 | Scripts de análisis de la tesis (métricas por modelo y estrato) | HECHA | | `npm run analysis` → `analysis/` (tasks, attempts y calls en CSV; summary.json/.md; report.html con gráficos e intervalos de Wilson). Probado con los registros reales de F001 y con pruebas unitarias |
| 9 | Banco de modelos locales con tarea semi-real y contexto > 8 192 | HECHA (medición en el PC) | | Banco con `S001:V1` y `S005:V1`; niveles de contexto «directorio de la zona»; `npm run real:context` para medir en el PC. A 8k los repositorios grandes no cabían: se recomienda 32k |
| 10 | Mecanismo de revisión 2 de F001 (protocolo 1.1) | HECHA | | `npm run corpus:revision -- F001 --reason …` (aplicar cuando haya modelos). Ensayo en copia: revisión abierta, V0→V3 aceptadas, auditoría PASS y FROZEN |
| 11 | Borrador del capítulo de metodología | EN CURSO | | |

