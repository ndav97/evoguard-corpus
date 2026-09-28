# Diseño: integración del estrato semi-real (S001–S010) en el runner

Estado: aprobado e implementado el 2026-09-27 (fases R1–R5; commits `787f88f`, `263f3a3`, `44db59b`, `3a331dd` y documentación). Guía de uso: `docs/estrato-semi-real.md`. Parte de lo que ya existe (`families-real/`, `scripts/real/calibrar.mjs` y la caché de bases del volumen `evoguard-bases`) y del pipeline sintético (motor, protocolo 1.1, proveedores, registros y auditoría). El objetivo es que un modelo genere V1–V3 de cada familia semi-real con **las mismas garantías** que en el estrato sintético:
- aislamiento;
- oráculo oculto;
- reparación solo con feedback visible;
- linaje reproducible;
- auditoría.

## 1. Qué cambia respecto del estrato sintético

| Aspecto | Sintético (F) | Semi-real (S) |
|---|---|---|
| V0 | La genera un modelo desde el scaffold | **Commit real** fijado (no se genera) |
| Versiones generadas | V0–V3 (4 por familia) | **V1–V3** (3 por familia; T001–T003) |
| Petición | Requisitos + `ui_contract` + fixture | `turns/T00n.md` (texto con literales de UI) |
| Entorno | Imagen común, scaffold de 7 archivos | **Imagen por familia**: repositorio en V0 + dependencias instaladas + Node de la versión que pide el repo |
| Comprobaciones visibles | `tsc`, build y vitest del scaffold | Comandos propios de cada familia: la suite del repositorio y, si existe, el typecheck |
| Oráculo | Playwright contra el build en un contenedor aparte | En un contenedor aparte: **tests ocultos T1..Tn** (fail-to-pass y preservación) + **suite completa** sin regresiones (pass-to-pass, salvo `known_failures`) |
| Control estructural | Reglas del `structural_profile` | **Control de alcance**: sin cambios de dependencias ni lockfile, sin modificar ni borrar tests existentes, sin tocar la configuración del runner, sin acceso a red |

## 2. Decisiones propuestas

1. **Una imagen Docker inmutable por familia** (`evoguard-real-Sxxx`, fijada por digest).
   - **Qué contiene:** el repositorio en el commit V0 (solo ese commit, sin remotos), `node_modules` ya instalado y la versión de Node que pide el repositorio.
   - **Cómo se construye:** una sola vez, con red, a partir de la caché verificada (`npm run real:prepare -- Sxxx`). Se registra en `config/real-bases.json`: digest, commit, versión de Node, hash del lockfile y resultado de la suite en la imagen, dos ejecuciones sin red.
   - **Por qué imagen y no el volumen compartido:** el volumen es mutable y está compartido; la imagen da reproducibilidad y aislamiento.
   - **Coste:** unos 0,5–2 GB por familia.
2. **Contenedores con el mismo aislamiento que hoy**: sin red, sin privilegios, uid 1000 y límites de CPU, memoria y procesos.
   - **Excepción:** la raíz no será de solo lectura. El repositorio y sus dependencias no caben en el tmpfs, así que se trabaja sobre la capa escribible del contenedor, que se destruye al terminar.
   - Esta excepción se documenta y el verificador de entorno la comprueba.
3. **El constructor ve:**
   - el repositorio (código y tests existentes);
   - la petición del turno;
   - una vista inicial acotada al `focus` de la familia;
   - la salida de sus comprobaciones visibles.

   **Nunca ve:** los tests ocultos, los parches de referencia ni el `family.yaml`. El historial git se reduce a V0 más los commits de las referencias aceptadas.
4. **Linaje igual que en F:** Vn parte de V0 + los parches **aceptados** de T1..Tn−1, generados por modelos, no las referencias de calibración. Cada commit se reproduce por hash.
5. **Oráculo en contenedor aparte**, creado desde la misma imagen:
   - aplica el parche del candidato respecto de V0;
   - copia los tests ocultos T1..Tn en `hidden_tests_dir`;
   - ejecuta la suite con informe JSON.

   El resultado **PASS** exige tres condiciones:
   - todos los tests ocultos T1..Tn pasan;
   - la suite no tiene regresiones fuera de `known_failures`;
   - ningún archivo de test falla al compilar.

   Al constructor solo le llega PASS o FAIL, sin detalle, igual que en F.
6. **Rotación:** `S00n` asigna a `Vv` (v = 1..3) el proveedor `ring[(n−1+v) mod 5]`. Así cada proveedor genera 6 de los 30 artefactos semi-reales y se mantiene equilibrado junto con los 40 sintéticos.
7. **Contexto de los modelos locales:** misma política, con una vista inicial del `focus` más el árbol del paquete. Con repositorios reales, 8 192 tokens es justo, así que el banco de Vast.ai debe medir también una tarea semi-real. Si no alcanza, se sube la ventana (16k–32k) antes de generar.
8. **Registros:** mismo formato. `runs/corpus-generation/Sxxx/Vn/<tarea>/`, `evaluator/runs/Sxxx/...` y referencias en `families-real/Sxxx/generation/Vn/`. Los esquemas `family_id` admiten `^[FS]\d{3}$`.

## 3. Fases de implementación

| Fase | Entrega | Verificación |
|---|---|---|
| R1 | Cargador y validador de `families-real/` (esquema de `family.yaml`, turnos, tests y parches, plan de rotación); paquete de turno semi-real | Tests unitarios; `npm run corpus:validate` incluye S001–S010 |
| R2 | `real:prepare`: imagen por familia desde la caché y lock `config/real-bases.json` | La suite pasa dos veces sin red dentro de la imagen |
| R3 | Workspace semi-real, comprobaciones visibles, oráculo en contenedor y control de alcance | Ensayo instrumental: la referencia de calibración como «constructor» → ACCEPTED; un mutante → FAIL; un candidato que borra un test → FAIL de alcance |
| R4 | `corpus:generate -- Sxxx`, `corpus:audit -- Sxxx` y preflight por familia semi-real | Ensayo completo T1–T3 de una familia con constructor instrumental |
| R5 | Documentación (decisiones, verificación) y guía de uso en Windows | Revisión |

Para desarrollar y probar en la nube se usa una familia con suite corta (S010 argo-cd, 8 s, o S005 fx-private-relay, 16 s). Las demás imágenes se construyen en tu PC con la caché que ya existe.

## 4. Riesgos
- **Disco:** 10 imágenes de 0,5–2 GB.
- **Tiempo:** suites de hasta 203 s (S009) × 2 ejecuciones en la auditoría.
- **Tests existentes durante la generación:** el constructor podría romper tests existentes y repararlos solo con el feedback visible. Es aceptable: es lo mismo que en SWE-bench.
- **Enunciados:** los redactó Claude y están pendientes de revisión humana; un enunciado ambiguo invalida el turno.
