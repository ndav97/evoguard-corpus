# Entorno inspeccionado antes de fijar dependencias
Fecha local: 2026-09-22 (America/Lima).

| Herramienta | Observación |
|---|---|
| SO | Microsoft Windows NT 10.0.26200.0 |
| Git | 2.55.0.windows.5; C:/Program Files/Git/cmd/git.exe |
| Node | v26.7.0; C:/nvm4w/nodejs/node.exe |
| npm | 11.19.0; C:/nvm4w/nodejs/npm.ps1 |
| Docker | Desktop 4.92.0 instalado y activo; CLI 29.8.0 por ruta directa; motor Linux devuelve HTTP 500 |
| Git autor inicial | Sin configuración; usuario proporcionó identidad para este repo |

No se instaló ni actualizó Git, Node, npm o Docker. No se infiere ausencia absoluta de Docker a partir de PATH.

## Revisión de Docker solicitada por el usuario
La inspección inicial solo comprobó el PATH de la sesión. La revisión encontró Docker en C:/Users/nsdav/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe. Esa carpeta sí figura en el PATH persistente del usuario, pero no en el heredado por esta sesión de Codex. No se modificó el PATH global ni el del usuario; se usó la ruta directa.

Docker Desktop 4.92.0 está instalado y sus procesos están activos. El cliente informa Docker 29.8.0 (build 88096ef), contexto desktop-linux. La consulta version devuelve Client válido, Server null y HTTP 500 al consultar el motor Linux en dockerDesktopLinuxEngine. Por tanto, instalado no equivale todavía a motor operativo.

La consulta wsl --list --verbose informa que WSL no está instalado. Es un indicio relevante para revisar el arranque del motor Linux, no una demostración de causa única del error 500. No se instalaron componentes de Windows, reiniciaron servicios ni ejecutaron contenedores durante esta revisión.

## Estado experimental
Las versiones npm se consultaron en el registro después de esta inspección. Se fijan dependencias del scaffold y las herramientas locales, **no se declara congelado el entorno experimental**.
La generación real requiere Linux reproducible, imagen por digest, versiones de runtime y navegador, caché offline de dependencias, mismas herramientas para todos los modelos y bloqueo de Internet externo.
El acceso a npm durante esta preparación no es una ejecución experimental.

Fuentes técnicas consultadas: [Vite](https://vite.dev/guide/) y [Ajv / JSON Schema](https://ajv.js.org/json-schema.html).
