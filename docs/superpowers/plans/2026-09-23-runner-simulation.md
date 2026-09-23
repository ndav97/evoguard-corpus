# Runner y ensayo simulado — plan de implementación

**Objetivo:** ejecutar y comprobar el ciclo de intentos, herramientas, validación y reasignación sin proveedores reales ni referencias funcionales.

**Diseño:** motor con adaptador por paso, workspace intercambiable y evaluador externo. El único modo público disponible es simulation. El ensayo usa Docker real y respuestas guionadas; el evaluador simulado nunca se presenta como oráculo funcional. Logs y parches se guardan en .artifacts/simulations, separados de runs experimentales.

**Especificación:** docs/protocol-v1.0.md, config/policy.json. Sin dependencias nuevas ni cambios a las fuentes del runtime ya verificado. Ejecución directa en este repositorio autorizado.

## Contratos y decisiones
- runTask({mode, packet, policy, initialProvider, adapter, workspaces, evaluator, emit}) devuelve estado simulado y eventos. Solo mode=simulation; rechaza otros modos antes de abrir recursos.
- adapter.next(context,{signal}) devuelve tool con argv, deliver o technical_failure. Contexto contiene packet vigente, mensajes visibles e intento; nunca resultados externos. Cada respuesta consume un ciclo, máximo 25 por intento.
- workspaces.open() devuelve exec(argv,{timeout}), snapshot() y close(). Una instancia por proveedor; misma instancia en reparaciones, nueva en fallback. Toda salida usa finally para limpieza.
- evaluator.check(stage, workspace,{signal}) devuelve PASS, FAIL con feedback visible solo para build/typecheck/development_tests, o INFRA_ERROR. Oracle/architecture son externos; FAIL reasigna sin feedback. Resultado desconocido es infraestructura, no aceptación.
- Tres intentos por proveedor, anillo circular hasta cinco asignaciones. Timeout/ciclos agotados reasignan sin continuar procesos inciertos. Error de infraestructura detiene toda la tarea. El límite temporal incluye llamadas, herramientas y validación por intento.
- Ningún ACCEPTED simulado habilita F001: estado SIMULATED_ACCEPTED y artifact_type=runner_simulation, sin modelo, tokens/costos ni commit experimental inventados.
- Capturar transcript visible, comandos/salidas, snapshots de cada intento y evaluaciones privadas fuera del workspace. No copiar entorno ni cabeceras. El coordinador es de confianza; los adaptadores futuros deberán respetar AbortSignal.

## Pasos
- [x] Escribir tests del motor: reparación conserva cambios, fallback no hereda, fallo de oracle privado, máximo tres/cinco/25, timeout, error de infraestructura, entrada inválida, limpieza y rechazo de modo real. Ejecutarlos antes de implementar.
- [x] Implementar runner/execution/engine.mjs y contratos documentados; pasar pruebas unitarias sin Docker ni red.
- [x] Implementar runner/simulation/cli.mjs con escenarios deterministas y workspace Docker real, registro JSONL/JSON y parches. Ensayar reparación, fallo de oracle y agotamiento.
- [x] Ejecutar suite completa, preflight bloqueado, revisar cambios independientemente y documentar evidencia real del ensayo. Commit con árbol limpio.

## Foco de revisión
No aceptar respuestas malformadas o checks omitidos; no repetir proveedores tras agotar el anillo; no reparar contra oracle; no dejar comandos activos tras timeout; no confundir evidencia de simulación con referencias del corpus. La ejecución de APIs, oráculo real, modelos y exportación de referencias V1–V3 permanece fuera del alcance.
