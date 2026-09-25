# Runtime Linux e aislamiento

Estado: verificado el 2026-09-23. F001 continúa DRAFT; estas pruebas no generan V0 ni evalúan requisitos del catálogo.

## Reproducir el entorno guardado

Desde la raíz del repositorio, con Docker Desktop operativo y las dependencias del runner instaladas:

```powershell
npm run environment:verify
```

El comando verifica el SHA-256 de `.artifacts/evoguard-runtime.tar`, carga la imagen y ejecuta dos contenedores limpios. Comprueba instalación npm offline, TypeScript/Vite, Chromium contra localhost, aislamiento y cierre ante timeout/exceso de salida. Guarda evidencia en `docs/verification/container.json`. Cada verificación comienza invalidando el estado anterior; si falla, no autoriza nuevas sesiones.

El archivo de imagen queda fuera de Git por tamaño. Para reproducir en otro equipo hay que transferirlo junto con este repositorio, conservar su ruta y comprobarlo con el comando anterior. Un clon de Git solo no contiene el runtime.

Si no se conserva el archivo, `npm run environment:build` construye otro candidato usando la base oficial fijada en `base.json`; requiere Internet durante preparación. Después ejecutar `npm run environment:verify`. Reconstruir desde repositorios apt no garantiza bytes idénticos: registrar y auditar el nuevo identificador. La reproducción exacta utiliza la imagen archivada, no una reconstrucción.

## Sesiones preparatorias

```powershell
$session = node runner/sandbox/cli.mjs open | ConvertFrom-Json
try {
    node runner/sandbox/cli.mjs exec $session.name node --version
} finally {
    node runner/sandbox/cli.mjs close $session.name
}
```

La sesión abre un scaffold neutro con insumos iniciales R001/R002; no implementa V0. Cerrar elimina su workspace efímero. Los registros de identidad en `.artifacts/sessions/` permiten cerrar incluso si el manifiesto cambió. No hay exportación de resultados implementada.

## Política comprobada

- Linux amd64, usuario 1000 sin privilegios, raíz de solo lectura, capacidades eliminadas y no-new-privileges.
- Red externa deshabilitada; aplicación y Chromium se comunican por localhost interior. No hay puertos publicados, bind mounts, secretos del host ni socket Docker accesible.
- Workspace y temporales en tmpfs; 2 CPU, 4 GiB de RAM, 256 procesos y 512 MiB de memoria compartida.
- Contexto de construcción mínimo: Dockerfile, inicializador y manifiestos npm. Sin corpus, oráculo, fixtures ni prompts en la imagen.
- Payload inicial exacto de 10 archivos; Git nuevo con un commit determinista de scaffold, sin remotos ni historia del corpus. V1–V3 bloqueados.
- Caché npm y herramientas ya disponibles sin Internet. Inventario de paquetes del sistema en `/opt/evoguard/system-packages.txt` dentro de la imagen.
- Cambiar controles o payload invalida la evidencia; cambiar fuentes de imagen exige reconstruir.

La API de proveedores futura se ejecutará en el coordinador externo; no está implementada. Docker utiliza el kernel de la VM WSL2. La prueba del navegador cubre únicamente el scaffold local; no constituye un oráculo E2E de F001.

Fuentes: [Node oficial](https://hub.docker.com/_/node), [Playwright: navegadores](https://playwright.dev/docs/browsers), [Docker: ejecución](https://docs.docker.com/engine/containers/run/).

## Inicialización desde el host (2026-09-24)

`runner/sandbox/seed-init.mjs` sustituye en ejecución a `/opt/evoguard/init.mjs` de la imagen: el host lo envía en cada apertura (como la sonda de verificación) para admitir el seed evolutivo sin reconstruir la imagen. Produce el mismo commit base V0 (`f12bfa0…`). Está incluido en las entradas de verificación, igual que `runner/sandbox/lineage.mjs`. El contenedor de evaluación del oráculo usa la misma imagen y aislamiento con el rol `oracle-evaluator`.
