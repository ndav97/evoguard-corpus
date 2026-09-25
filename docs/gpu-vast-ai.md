# Modelos locales en una GPU alquilada de Vast.ai

Guía para ejecutar el banco de modelos locales (y luego la generación del corpus) con Ollama en una GPU de Vast.ai. El pipeline sigue en tu Windows (Docker, oráculo, registros); en la GPU alquilada solo corre Ollama, y se accede a él por un túnel SSH cifrado que lo expone en `127.0.0.1:11435` de tu equipo. Nada del corpus, del oráculo ni tus claves viaja a la instancia: solo los prompts de las tareas y las respuestas del modelo.

## 1. Una sola vez: cuenta y clave SSH
1. Crea la cuenta en https://cloud.vast.ai y añade crédito (con 10–20 USD sobra para el banco).
2. En PowerShell genera una clave (si no tienes una): `ssh-keygen -t ed25519` (Enter en todo).
3. Copia la clave pública (`Get-Content $HOME\.ssh\id_ed25519.pub`) y pégala en https://cloud.vast.ai/manage-keys/. Solo se aplica a instancias creadas **después** de añadirla.

## 2. Alquilar la instancia
En *Search*:
- **GPU**: 1× RTX 3090 o RTX 4090 (24 GB). Para los candidatos de 30B/32B hacen falta los 24 GB.
- **Disk**: 100 GB (los siete candidatos suman ~75 GB).
- **Template**: una imagen base de CUDA/Ubuntu (p. ej. *NVIDIA CUDA*) o la plantilla de Ollama. El script de preparación instala Ollama si falta.
- **Filtros recomendados**: *Reliability* ≥ 98 %, conexión ≥ 200 Mbps de bajada (descargas de modelos), preferir instancias con **Direct SSH**.
- *Rent*. Cuando esté *Running*, pulsa **Connect** y copia la línea `ssh -p PUERTO root@IP` (usa la de *Direct SSH* si aparece).

Costo: se cobra por hora mientras la instancia existe (unos 0,10–0,50 USD/h según la oferta). Una instancia **detenida** sigue cobrando el disco; al terminar, **destrúyela** (*Destroy*).

## 3. Preparar la instancia (desde la carpeta evoguard-corpus)
```powershell
.\scripts\vast\prepare.ps1 -SshHost IP -SshPort PUERTO
```
Copia `scripts/vast/setup-instance.sh`, comprueba la GPU, instala y arranca Ollama **solo en 127.0.0.1** de la instancia (sin exposición pública) y descarga los modelos de `config/local-bench.json`. Para descargar solo algunos: `-Models qwen3-coder:30b,devstral:24b`.

## 4. Abrir el túnel (en otra ventana, déjala abierta)
```powershell
.\scripts\vast\tunnel.ps1 -SshHost IP -SshPort PUERTO
```
Reconecta solo si se corta. Tu Ollama local puede seguir abierto: el túnel usa el puerto 11435.

## 5. Ejecutar el banco
Con Docker Desktop abierto:
```powershell
# Filtro rápido: una tarea para todos los candidatos
.\scripts\vast\bench.ps1 -Tasks V1
# Completo para los mejores
.\scripts\vast\bench.ps1 -Models qwen3coder30-32k,devstral24-32k -Tasks V0,V1,V2,V3
```
Lista de candidatos: `npm run bench:local -- --list`. Antes de alquilar puedes comprobar el cableado con `npm run bench:selftest` (Ollama simulado; no usa GPU).

El banco repite las tareas de F001 partiendo de sus **referencias congeladas** (V0 desde el scaffold; V1–V3 desde la referencia anterior), con el mismo pipeline de la generación real: contenedor aislado, protocolo 1.1, hasta 3 intentos con reparación visible, oráculo en contenedor propio y control de arquitectura. Un solo modelo por tarea, sin reasignación. Antes de cada candidato mide su tokenizador para fijar el estimador de contexto. Los resultados **no** entran al corpus: registros en `.artifacts/bench/`, resumen versionado en `docs/verification/local-bench/` (commit automático) y log en `.artifacts/bench-*.log`.

Duración orientativa: 5–30 min por tarea y modelo (tope 3 h por tarea: 3 intentos de 1 h). El filtro rápido de 7 candidatos ronda 1–3 h.

## 6. Elegir los modelos locales del pool
Criterio (decidido para el proyecto; ajustable con evidencia):
1. **Aceptación**: al menos 3 de 4 tareas aceptadas (V0–V3), sin ninguna ayuda especial.
2. **Sin errores de infraestructura** atribuibles al modelo (contexto, salida truncada).
3. **Comportamiento**: sin bucles persistentes; usa las acciones (lee, escribe, `run_checks`).
4. **Costo/tiempo**: mediana por llamada y duración por tarea compatibles con el tope de 1 h por intento.
5. **Diversidad**: dos modelos de familias distintas (p. ej. Qwen y Mistral/Devstral) para `local_a` y `local_b`, igual que ahora (Qwen y Granite).

Si ningún candidato cumple, se documenta y se decide entre subir de GPU (48 GB) o ampliar la lista.

## 7. Después de elegir
1. Actualizar `config/models.json` (`local_a`/`local_b`: modelo, contexto, salida, digest observado) como **nuevo congelamiento**, con la decisión en `docs/operational-decisions.md`.
2. Ajustar `config/context.json` (presupuesto = nuevo contexto) y recalibrar con el túnel abierto: `$env:EVOGUARD_OLLAMA_PORT=11435; npm run context:calibrate -- --write`.
3. Repetir `npm run environment:verify` y `npm run pipeline:rehearse`; el preflight debe quedar despejado.
4. Para generar con la GPU alquilada basta tener el túnel abierto y `EVOGUARD_OLLAMA_PORT=11435` en la sesión.
5. **Destruir la instancia** al terminar cada sesión de trabajo.

## Referencias
- Conexión SSH y reenvío de puertos: https://docs.vast.ai/guides/instances/connect/ssh.md
- Plantilla de Ollama en Vast.ai: https://docs.vast.ai/ollama-webui.md
- Modelos de Ollama para agentes de código (VRAM y contexto): https://www.morphllm.com/best-ollama-models
