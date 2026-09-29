# Protocolo de acciones del constructor — versión 1.1

Adoptado el 2026-09-25 (decisión de Claude con autorización del usuario). Sustituye al formato 1.0 (`{type: tool|deliver|technical_failure, argv}`), que se sigue aceptando por compatibilidad. F001 (FROZEN) se generó con 1.0 y así consta en sus registros.

## Motivo
En la ejecución real de F001, Qwen2.5-Coder 7B y Granite 3.3 8B nunca intentaron escribir código: repitieron `echo …` y `npm install` durante 22–24 ciclos y produjeron ~31 tokens por respuesta, con el contexto lejos del límite. Con 1.0 la única forma de crear un archivo era meter todo el código escapado dentro de un comando de shell en un JSON. Los modelos grandes lo resuelven; los pequeños se refugian en la acción trivial más segura. 1.1 da affordances explícitas a los cinco modelos por igual: no se revela nada del oráculo ni se ayuda a ningún modelo en particular.

## Acciones
Una única respuesta JSON por turno, con esquema plano y todas las claves obligatorias (`type, path, content, find, replace, argv`); las que el tipo no usa van `""` o `[]`. Esquema plano porque funciona igual con la salida estricta de OpenAI, Anthropic y Gemini y con la gramática JSON de Ollama.

| `type` | Campos | Efecto (siempre dentro del contenedor del candidato) |
|---|---|---|
| `read_file` | `path` | Muestra el archivo (máx. 20 000 caracteres, con aviso si se recorta). |
| `list_files` | `path` (`""` = raíz) | Árbol con tamaños; omite `node_modules`, `.git`, `dist`, `coverage`. |
| `write_file` | `path`, `content` | Crea o reemplaza el archivo (máx. 96 000 B). |
| `edit_file` | `path`, `find`, `replace` | Reemplaza una aparición exacta y única de `find`; si falta o se repite, falla con explicación. |
| `run_checks` | — | Ejecuta los tres comandos visibles del pipeline (typecheck, build, Vitest) y muestra sus salidas. |
| `tool` | `argv` | Comando como en 1.0 (`["sh","-lc","…"]` para shell). |
| `deliver` / `technical_failure` | — | Entregar / rendirse. |

Rutas protegidas (no se escriben ni editan): `TASK.json`, `fixtures/`, `.git/`, `node_modules/`, `dist/`. Rutas absolutas, con `..` o que salgan del repositorio por enlaces se rechazan.

## Otros cambios del runner
- **Vista inicial del workspace**: primer mensaje de cada asignación (`source: workspace`) con el árbol de archivos y el contenido de `src/` hasta 24 000 B. Para los modelos locales la política de contexto la conserva hasta 6 000 B y, si no cabe, deja solo el árbol.
- **Detección de bucles**: si la misma acción se repite 3 veces seguidas, el constructor recibe un aviso visible para cambiar de estrategia (no bloquea).
- **Una sola fuente de comandos visibles**: `config/protocol.json` (`check_commands`) alimenta tanto `run_checks` como las etapas typecheck/build/development_tests del evaluador.
- **Ollama `keep_alive` 15 min** (antes 0): el modelo local permanece cargado entre ciclos; en F001 cada llamada tardaba ~15 s por la recarga. No es un parámetro de inferencia congelado; la calibración de contexto sigue usando `keep_alive: 0`.
- **Salida de los proveedores**: se registra `protocol_version`, `action_type` y `normalization` por llamada.

## Normalización acotada de la respuesta
Se aceptan (a) espacios alrededor y (b) un único bloque de código Markdown que envuelve **todo** el objeto JSON (```` ```json … ``` ````). Es un artefacto de formato de transporte sin cambio de contenido; se registra como `normalization: markdown_fence` para poder medirlo. Desde el 2026-09-28 también se acepta (c) un preámbulo de prosa seguido del objeto, suelto (`prose_prefix`) o en bloque (`prose_prefix_fence`). El preámbulo tiene como máximo 2 000 caracteres, sin llaves ni bloques de código; el objeto empieza en línea propia y llega hasta el final. La prosa se descarta y su longitud se registra en `discarded_chars` (motivo y evidencia en `operational-decisions.md`, 2026-09-28). Cualquier otro texto alrededor del JSON sigue siendo `INVALID_ACTION_JSON`: texto después del objeto, varios objetos, JSON dentro de la prosa o pseudo-llamadas XML. Cuando una respuesta se rechaza, `calls.jsonl` guarda `rejected_output` (longitud, SHA-256, primeros 2 000 y últimos 500 caracteres con posibles secretos redactados).

## Configuración
`config/protocol.json` (límites y comandos) y `config/context.json` (`history.workspace_bytes`). Implementación: `runner/protocol/actions.mjs` (esquema, análisis y validación) y `runner/protocol/execute.mjs` (ejecución en el contenedor, vista del workspace). Ambos, junto con el motor, el adaptador y la política de contexto, forman parte de la huella que exige repetir `npm run pipeline:rehearse` antes de generar.

## Límite conocido para los locales
Con la ventana actual de 8 192 tokens, el núcleo de V3 más la vista del workspace ocupa ~5 000 de 6 656 tokens estimados: queda poco historial. Ampliar contexto y salida (4 096) es el objetivo del banco de prueba en GPU alquilada (punto 3), junto con la posible elección de otros modelos locales.
