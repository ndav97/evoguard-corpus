# Motor de intentos

`runTask(options)` implementa el ciclo de agentes con dependencias inyectadas. Modos: `simulation` (guionado, solo V0, estados `SIMULATED_*`), `rehearsal` (contenedores y evaluación reales con adaptador instrumental; ver `runner/pipeline/README.md`) y `experimental` (generación real; exige `preflightBlockers: []`). Solo el modo experimental puede producir referencias del corpus. Al aceptar fuera de simulación, el motor crea un commit determinista del pipeline (`reference: Vn`) y lo registra como `candidate_commit`.

## Interfaces ejecutables

- `adapter.next(context, {signal, timeout})`: recibe copia del packet, proveedor, intento, ciclo e historial visible. Devuelve `{type:'tool',argv:[...]}`, `{type:'deliver'}` o `{type:'technical_failure'}`. No recibe el workspace, evaluador ni eventos privados. Debe respetar AbortSignal; el motor descarta respuestas tardías.
- `workspaces.open()`: devuelve `exec(argv, {signal,timeout})`, `snapshot({signal,timeout})` y `close()`. `exec` devuelve `{status:'PASS'|'FAIL'|'TIMEOUT'|'INFRA_ERROR',output:string}`. `snapshot` devuelve un parche textual. `close` debe detener todos los procesos de la asignación; no basta cancelar la llamada cliente.
- `evaluator.check(stage, workspace, {signal,timeout})`: devuelve `{status,feedback?}`. Stages: typecheck, build, development_tests, independent_oracle, architecture. Solo los tres primeros pueden dar feedback de reparación. El evaluador conserva sus detalles privados fuera del workspace.
- `emit(event)`: escritura síncrona del registro del coordinador; un fallo detiene la tarea. No enviar este registro completo al agente: incluye resultados externos. El adaptador recibe exclusivamente su historial visible.

El contrato histórico `agents/contracts.ts` describe una futura llamada monolítica de proveedor; no es la interfaz por paso del motor actual. Los adaptadores de `providers/` implementan next y metadatos de llamadas. Aún se requiere verificar acceso comercial, integrar registro/exportación de candidatos y auditoría antes de habilitar generación.

## Semántica

Tres intentos por proveedor; máximo 25 respuestas del adaptador por intento, incluyendo entrega. El presupuesto por intento incluye llamadas, herramientas, evaluación y captura de evidencia. API: 1800 segundos; local: 3600. Solo las simulaciones pueden reducirlo mediante `simulationTimeoutMs`; no permite ampliarlo.

Fallos técnicos de validación permiten hasta dos reparaciones en el mismo workspace e historial visible. Fallos del oráculo o arquitectura, límite de ciclos, timeout y entrega `technical_failure` reasignan a un workspace nuevo. No se repara usando feedback privado. Al agotar el anillo de cinco proveedores se devuelve SIMULATED_BLOCKED. Error de transporte, evaluación desconocida, fallo de almacenamiento o limpieza detiene por infraestructura.

Una aceptación exige los cinco controles PASS y snapshot guardado. El resultado global solo se conserva como aceptado si el cierre también funciona. Snapshot null en un timeout significa que no se pudo capturar evidencia antes de cancelar; no representa un candidato preservado.

## Ensayo reproducible

```powershell
npm run runner:simulate
```

Requiere la imagen Linux verificada localmente. Usa contenedores reales y compilación/TypeScript reales; respuestas del agente, tests de desarrollo, oráculo y arquitectura son guionados. Se escribe únicamente un marcador instrumental en cada workspace, nunca lógica de F001. El ensayo cubre reparación, rechazo externo/reasignación, agotamiento y timeout de comando real.

Los resultados llevan `artifact_type: runner_simulation`, se guardan bajo `.artifacts/simulations/<uuid>/` y están excluidos de Git. Cada escenario conserva eventos JSONL, evaluación privada JSONL, intentos y parches en JSON; summary.json se escribe solo si todas las comprobaciones pasan. Un error deja los logs ya escritos, sin resumen PASS. La ausencia de métricas de modelo es intencional: no hubo tokens ni costo observado de un proveedor.

Los archivos del host, secretos y socket Docker no se montan. El comando del agente se ejecuta dentro del sandbox; nunca se interpola en un shell del host. Los adaptadores/evaluador son código de confianza. Esta entrega no garantiza la corrección de adaptadores futuros ni sustituye el oráculo E2E de F001.
