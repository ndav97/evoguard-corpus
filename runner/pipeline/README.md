# Pipeline real (Paso 5)

Conecta el motor (`runner/execution/engine.mjs`) con contenedores, evaluación, oráculo aislado y persistencia.

| Módulo | Función |
|---|---|
| `workspace.mjs` | Workspaces sobre sandboxes Docker: `exec` (argv con límite de tiempo y salida), `snapshot` (parche binario sin recortar), `exportTree` (archivos regulares, sin enlaces, con límites), `commit` determinista de la referencia aceptada. |
| `evaluator.mjs` | Etapas del motor. `typecheck`, `build`, `development_tests`: comandos fijos del pipeline dentro del contenedor del candidato (no dependen de `package.json`); su salida es el único feedback visible. `independent_oracle`: el `dist/` se evalúa en un contenedor nuevo con rol `oracle-evaluator` (`runner/oracle/container.mjs`). `architecture`: análisis estático del árbol exportado (`architecture.mjs`). |
| `architecture.mjs` | Sin `useReducer`, efectos, `useSyncExternalStore`, red, almacenamiento del navegador ni import dinámico; solo paquetes `react`/`react-dom`; `package.json`/lock sin dependencias nuevas; fixture intacto e importado; `useState` presente. Componentes 5–20: solo métrica de auditoría. |
| `store.mjs` | Registros por tarea: `events.jsonl`, `calls.jsonl`, `attempts/<id>/{generation.json,patch.diff}`, `summary.json`; canal privado del evaluador aparte. Guarda referencias aceptadas (`reference.json`, `reference.patch`, `task.json`) sin sobrescribir. Bloquea registros con patrones de secreto. |
| `rehearse.mjs` | Ensayo integral instrumental (`npm run pipeline:rehearse`). |

Ubicaciones: ensayo en `.artifacts/rehearsals/<uuid>/` (fuera de Git, `experimental: false`); generación experimental en `runs/corpus-generation/F001/<V>/<uuid>/`, canal privado en `evaluator/runs/F001/<V>/<uuid>/` y referencias en `families/F001-product-catalog/generation/<V>/`.

## Aislamiento del oráculo

El candidato solo aporta su build estático. El oráculo se copia a un contenedor nuevo (misma imagen, sin red, raíz de solo lectura, usuario sin privilegios), que sirve el build en 127.0.0.1 y lo recorre con el Chromium de la imagen. El código del candidato nunca corre como proceso Node fuera de su propio sandbox, nunca en el host y nunca junto al oráculo; el contenedor de evaluación se destruye tras cada evaluación.

## Evolución (V1–V3)

`runner/sandbox/lineage.mjs` reconstruye la historia validada: scaffold V0 con el `TASK.json` que recibió V0 y, por cada versión previa, `task: Vk` (k>0) y `reference: Vk` aplicando su parche auditado. Cada commit debe reproducir el hash registrado. `runner/sandbox/seed-init.mjs` ejecuta esa reconstrucción dentro del contenedor (enviado desde el host; la imagen no cambia).

## Ensayo integral

```powershell
npm run pipeline:rehearse
```

Un guion (no un modelo) escribe candidatos de `tests/fixtures/rehearsal/`: error de tipos → reparación con feedback; búsqueda sin conjunción → rechazo del oráculo y reasignación; `useEffect` → rechazo de arquitectura; correcto → aceptado con commit. Después guarda esa V0 instrumental como referencia solo dentro del ensayo y reconstruye un workspace V1 comprobando historia, hashes y ausencia de información futura o de procedencia.
