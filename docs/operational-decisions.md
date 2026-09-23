# Parámetros de materialización (2026-09-22)
Estas decisiones concretan detalles antes no fijados; no se atribuyen al texto literal del protocolo.
- JSON Schema draft-07, versión de esquema 1.0.0. Manifiestos YAML aceptan sintaxis JSON (subconjunto YAML 1.2).
- El fixture se fija por SHA-256 de bytes UTF-8/LF antes de generar V0; nombres/precios concretos creados ahora. No es una referencia funcional.
- En V0 el orden de presentación no se evalúa. En R003, comparación de nombres ASCII, case-insensitive; empate mantiene orden del fixture (precios incluyen empates). Modo inicial sin orden explícito conserva fixture.
- R004: controles de navegación observables; con cero resultados no hay siguiente/anterior válidos. Se permite indicador 0/0 o 1/1 vacío, sin exigir copy específico. Cambiar orden conserva número de página (no cambia cantidad de resultados).
- R005: selección observable incluso si el producto está en otra página; filtrar y mantenerlo conserva selección. Quitar el filtro no restaura una selección limpiada.
- No fijar selectores, nombres de componentes ni diseño. El adapter del oráculo se escribirá contra UI real y se auditará aparte; hoy hay escenarios declarativos completos y contrato, sin afirmar oráculo E2E implementado.
- Fallback recorre cada uno de cinco proveedores como máximo una vez por tarea; si todos fallan se registra bloqueo. Evita intentos ilimitados.
- Dependencias exactas/lockfiles para preparación local. Congelamiento experimental pendiente de Linux/Docker y navegador.
- Repo nuevo en carpeta evoguard-corpus dentro del proyecto, fuera de sources/. Un primer commit tras validar; no se crea worktree adicional para un repo sin historia.
- No se ejecutan modelos ni se serializan secretos. Los esquemas de generación/π0 describen registros futuros, no contienen observaciones ficticias.

## Ampliación autorizada: contenedor — 2026-09-23
- Runtime Linux verificado y archivado por SHA-256. El congelamiento integral del experimento permanece pendiente; no hay V0.
- Base Node oficial por digest y Chromium headless de Playwright 1.63.0. Reproducción exacta desde archivo, no promesa de builds idénticos contra repositorios apt cambiantes.
- Transferencia por stdin de allowlist, sin montajes del host. Git interior nuevo y determinista. V1–V3 se rechazan hasta implementar exportador de referencias válidas.
- Coordinador de modelos fuera del sandbox; no se exponen API keys ni se habilita red externa. Ningún modelo local fue seleccionado.
- Evidencia ligada a hashes del payload y controles; cambios invalidan la autorización. Cada reverificación revoca primero la evidencia anterior. Timeout/exceso de salida eliminan el contenedor propio.

## Motor ensayado sin proveedores — 2026-09-23
- El motor admite únicamente simulación. F001 sigue DRAFT; no se crean referencias, commits funcionales ni modelos seleccionados.
- Un ciclo es una respuesta del adaptador, incluida la entrega. Los 25 ciclos y timeout aplican por intento; el tiempo incluye herramientas, evaluación y captura de evidencia.
- Timeout, agotamiento de ciclos o technical_failure reasignan sin reparar un proceso incierto. Fallos visibles de build/typecheck/tests permiten intentos 2/3 en el mismo workspace. Oracle/arquitectura fallidos reasignan sin feedback privado. Fallos de infraestructura detienen la tarea.
- No se conserva aceptación si falla la captura o cierre. Un snapshot null por timeout indica evidencia no capturada, nunca parche válido.
- Los escenarios guionados usan Docker real, marcador instrumental, compilación real y evaluaciones funcionales simuladas. Se registran aparte en .artifacts/simulations; no confundir PASS del ensayo con validación funcional.
