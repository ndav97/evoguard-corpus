# Entorno inspeccionado antes de fijar dependencias
Fecha local: 2026-09-22 (America/Lima).

| Herramienta | Observación |
|---|---|
| SO | Microsoft Windows NT 10.0.26200.0 |
| Git | 2.55.0.windows.5; C:/Program Files/Git/cmd/git.exe |
| Node | v26.7.0; C:/nvm4w/nodejs/node.exe |
| npm | 11.19.0; C:/nvm4w/nodejs/npm.ps1 |
| Docker | Desktop 4.92.0; cliente y motor 29.8.0 operativos en Linux/WSL2; hello-world ejecutado correctamente |
| Git autor inicial | Sin configuración; usuario proporcionó identidad para este repo |

No se instaló ni actualizó Git, Node, npm o Docker. No se infiere ausencia absoluta de Docker a partir de PATH.

## Revisión de Docker solicitada por el usuario
La inspección inicial solo comprobó el PATH de la sesión. La revisión encontró Docker en C:/Users/nsdav/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe. Esa carpeta sí figura en el PATH persistente del usuario, pero no en el heredado por esta sesión de Codex. No se modificó el PATH global ni el del usuario; se usó la ruta directa.

Docker Desktop 4.92.0 está instalado y sus procesos están activos. El cliente informa Docker 29.8.0 (build 88096ef), contexto desktop-linux. La consulta version devuelve Client válido, Server null y HTTP 500 al consultar el motor Linux en dockerDesktopLinuxEngine. Por tanto, instalado no equivale todavía a motor operativo.

La consulta wsl --list --verbose informa que WSL no está instalado. Es un indicio relevante para revisar el arranque del motor Linux, no una demostración de causa única del error 500. No se instalaron componentes de Windows, reiniciaron servicios ni ejecutaron contenedores durante esta revisión.

## Instalación de WSL para reparar Docker
Posteriormente, el usuario pidió dejar Docker operativo. Se confirmó virtualización de firmware habilitada e hipervisor presente. Una consulta elevada encontró VirtualMachinePlatform y Microsoft-Windows-Subsystem-Linux deshabilitados.

Se ejecutó wsl --install --no-distribution con autorización administrativa de Windows: instaló WSL 2.7.14, habilitó VirtualMachinePlatform y terminó con exit 0 indicando reinicio requerido. La consulta posterior wsl --version confirmó 2.7.14.0 y kernel 6.18.33.2-2. El registro Component Based Servicing/RebootPending existe.

No se instaló una distribución de usuario, no se reinició automáticamente y aún no se verificó ejecución de contenedores. Estado actual: **reinicio de Windows pendiente, seguido de verificación del motor Docker**. La observación HTTP 500 anterior se conserva como antecedente, no como una medición posterior a reiniciar.

Tras reiniciar: abrir Docker Desktop, esperar inicio del motor, comprobar docker version y docker info, y ejecutar docker run --rm hello-world para verificar un contenedor Linux real. Solo después actualizar el estado como operativo. Referencia: [instalación de WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands).

## Verificación posterior al reinicio
El reinicio eliminó la condición RebootPending. Docker Desktop no estaba iniciado; al iniciarlo, el cliente y servidor respondieron correctamente: Engine 29.8.0, OS linux, arquitectura amd64, kernel 6.18.33.2-microsoft-standard-WSL2. El comando docker ya se resuelve desde el PATH de esta sesión.

Se ejecutó docker run --rm hello-world: descargó la imagen oficial, creó y ejecutó el contenedor, mostró Hello from Docker! y terminó con código 0. El contenedor se eliminó automáticamente; la imagen queda en caché. Digest verificado: hello-world@sha256:5e23090353324d887c48ad5e5c56d294eab81588df9605b07d1afe895f9cc8f8. WSL muestra docker-desktop en estado Running y versión 2.

**Estado actual: Docker operativo.** Las observaciones anteriores son el historial del diagnóstico y reparación. Esta prueba comprueba instalación/descarga/ejecución; no congela la imagen experimental del corpus ni implementa su aislamiento.

## Estado experimental
Las versiones npm se consultaron en el registro después de esta inspección. Se fijan dependencias del scaffold y las herramientas locales, **no se declara congelado el entorno experimental**.
La generación real requiere Linux reproducible, imagen por digest, versiones de runtime y navegador, caché offline de dependencias, mismas herramientas para todos los modelos y bloqueo de Internet externo.
El acceso a npm durante esta preparación no es una ejecución experimental.

Fuentes técnicas consultadas: [Vite](https://vite.dev/guide/) y [Ajv / JSON Schema](https://ajv.js.org/json-schema.html).

## Runtime Linux verificado — 2026-09-23
Se construyó y archivó la imagen experimental de infraestructura con base oficial Node 26.7.0 bookworm-slim fijada por digest. npm 11.19.0, Git 2.39.5, Playwright 1.63.0 y Chromium headless 153.0.8010.12 se observaron dentro de dos contenedores limpios. Identificadores, hashes y evidencia completos en `config/container.json` y `docs/verification/container.json`.

El archivo local `.artifacts/evoguard-runtime.tar` ocupa 415340032 bytes y está excluido de Git. Su carga, instalación de dependencias offline, compilación y navegador localhost pasaron. La red externa/host, escritura en raíz y acceso a archivos/secretos del host se comprobaron bloqueados. También se verificó cierre ante timeout y exceso de salida; no quedaron contenedores de verificación activos.

Dos descargas de la base MCR Playwright fallaron por truncamiento. Se usó Node oficial; la descarga inicial de sus capas se completó por el host con hashes verificados y Docker confirmó después el digest oficial. La instalación posterior de paquetes y navegador durante build funcionó. Esto pertenece a preparación, no a una ejecución experimental.

Estado actual: **RUNTIME_VERIFIED**. `experimental_frozen` continúa false: faltan proveedores/modelos y evaluación independiente para habilitar generación. F001 sigue DRAFT. Instrucciones de reproducción y límites en [docker/README.md](../docker/README.md).
