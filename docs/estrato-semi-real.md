# Estrato semi-real: guía de uso (Windows)

Familias `families-real/S001–S010`. Cada una parte de un repositorio público real fijado en su commit V0; los modelos generan V1–V3 a partir de las peticiones T001–T003. Decisiones y diseño: `docs/operational-decisions.md` (sección del 2026-09-27) y `docs/diseno-integracion-semi-real.md`.

## Una sola vez (sin modelos)

Todos los pasos siguientes necesitan Docker Desktop, y los scripts lo abren si hace falta.

| Paso | Comando | Qué hace | Resultado |
|---|---|---|---|
| 1. Imágenes | `scripts\real\preparar-imagenes.cmd` | Clona cada repositorio por su SHA e instala dependencias (con red). Después verifica sin red la suite dos veces, los parches de referencia y la zona del cambio. Ocupa 0,5–2 GB por familia. | `config\real-bases.json` (todas en `VERIFIED`) |
| 2. Ensayo por familia | `scripts\real\ensayar-familias.cmd` | Ejecuta el pipeline completo sin modelos (V1→V3) con las referencias de calibración. En V1 también comprueba tres rechazos: borrar un test, no cambiar nada y código roto seguido de una reparación. | `docs\verification\real-rehearsal-sxxx.json` |
| 3. Preflight | `npm run generation:preflight -- S001` | Lista lo que falta para generar esa familia. | «preflight despejado» |

| 4. Fuerza de los tests ocultos | `npm run real:mutants -- S001 S002 … S010` (opcional `--max=N`, por defecto 8 mutantes por turno) | Aplica las referencias de calibración y comprueba que los tests ocultos de cada turno pasan. Después introduce mutantes, uno a uno, en las líneas que añade la referencia: cambia operadores y textos de la interfaz, borra sentencias y altera retornos. Cada mutante se ejecuta solo contra los tests ocultos de ese turno. **No ejecutar a la vez que el ensayo**, porque ambos limpian los contenedores del estrato. | `docs\verification\real-mutants-sxxx.json` (puntuación y mutantes sobrevivientes para revisión) |

Para trabajar solo con algunas familias: `-Familias S010,S005`. El ensayo del pipeline con la familia de prueba (`npm run real:rehearse -- --mini`) ya está en `docs\verification\real-pipeline-rehearsal.json`. Hay que repetirlo solo si cambia el código del runner semi-real; el preflight lo indica.

## Con modelos disponibles

Requisitos previos: los mismos que en el estrato sintético (`config\models.json` congelado, contexto calibrado y `.env` con la clave).

```
npm run generation:preflight -- S001
npm run corpus:generate -- S001 all          # V1, V2 y V3; commit por versión
npm run corpus:audit -- S001 --freeze        # historia, alcance, suite y oráculo ×5; FROZEN si todo pasa
```

- **Registros:** `runs\corpus-generation\S001\` (públicos) y `evaluator\runs\S001\` (privados del evaluador).
- **Referencias aceptadas:** `families-real\S001-*\generation\V1..V3\`.

## Qué ve y qué no ve el modelo

| Ve | No ve |
|---|---|
| La petición del turno | Los tests ocultos (`oracle\`) |
| El repositorio en su estado actual (V0 más las referencias aceptadas) | Los parches de referencia |
| La zona del cambio | `family.yaml` |
| La salida de la suite del repositorio (`run_checks`) | Los resultados del oráculo y del control de alcance |

No puede modificar tests existentes, dependencias ni configuración del runner, del build o del linter.
