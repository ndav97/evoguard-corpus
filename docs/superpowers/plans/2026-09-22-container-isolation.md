# Contenedor reproducible y aislamiento — ejecución autorizada

El usuario autorizó preparar el contenedor Linux y aislamiento tras completar la especificación; sin generar V0, invocar APIs ni elegir modelos. Se implementa directamente sobre el repositorio limpio. La validación experimental de F001 permanece DRAFT.

## Diseño
Imagen oficial Node 26.7.0 bookworm-slim fijada por digest, dependencias npm exactas con lockfiles y Chromium headless de Playwright 1.63.0 incluido. La imagen final se identifica por su SHA-256 local, se guarda en un archivo Docker con checksum y se usa por ID, nunca por tag mutable. No se promete que reconstruir capas con timestamps o repositorios apt produzca el mismo ID: la ejecución reproducible usa el artefacto guardado y su inventario de paquetes del sistema.

Decisión operativa: se sustituyó la base Playwright noble después de dos descargas MCR truncadas (unexpected EOF). Node oficial permite mantener la versión del equipo e instalar únicamente Chromium headless y sus dependencias durante la preparación. No cambia el aislamiento ni habilita Internet durante experimentos.

El host prepara un payload por allowlist con scaffold neutro, fixture y packet V0. Se transmite por stdin a un proceso dentro del contenedor; no se monta ninguna ruta del host. El contenedor ejecuta usuario no root, red none, rootfs read-only, capacidades eliminadas, no-new-privileges, límites de memoria/CPU/PIDs y tmpfs privado para workspace y temporales. No publica puertos ni hereda variables del host. Browser y aplicación comparten localhost dentro del contenedor. Las APIs futuras permanecerán en el coordinador externo.

Git nuevo y sin remotos dentro del workspace, solo un commit de scaffold. Nunca copiar .git del corpus. No hay referencias V0–V3; rechazar lanzamiento de V1–V3 hasta disponer de un exportador auditado de historia válida. Las reparaciones futuras usarán el mismo contenedor y una reasignación uno nuevo. Ningún resultado de infraestructura cuenta como generación.

## Entregables y comprobaciones
- [x] docker/: Dockerfile, lockfile de herramientas y scripts internos neutros. Contexto de build por allowlist sin oracle/fixtures/prompts/futuro.
- [x] runner/sandbox/: construcción, exportación, carga de artefacto, creación/ejecución/cierre de contenedor, inventario y comandos reproducibles. Evitar shell del host y opciones Docker controladas por el agente.
- [x] config/container.json: digest base, ID imagen final, checksum archivo, entradas con hashes, versiones observadas y estado verificado; validar antes de iniciar sesiones.
- [x] Pruebas: rechazo de enlaces, traversal, futuro, versiones no disponibles, imagen mutable, payload/evidencia alterados y nombres ajenos al runner. Checksum del artefacto comprobado durante la verificación real.
- [x] Pruebas reales: npm ci offline, typecheck/build, Chromium contra localhost, Git sin historia del corpus, red externa/host/socket/rootfs denegados, workspace editable, secretos ausentes, limpieza de recursos del runner.
- [x] Repetir en contenedor limpio y cargar artefacto exportado, guardar reporte; revisión independiente y comprobaciones del corpus antes del commit.

## Límites
Docker comparte el kernel de la VM WSL2; no es una garantía contra vulnerabilidades del kernel. El aislamiento es la política instrumental del experimento, sin afirmar protección absoluta. Chromium solo navega a la aplicación local. El proveedor no está implementado en este paso. No se crea ningún resultado funcional, etiqueta o referencia.
