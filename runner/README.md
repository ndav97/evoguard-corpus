# Runner preparatorio
Implementado: validación de esquemas e integridad, preview por versión, preflight y sandbox Linux verificado. `sandbox/` construye, archiva, verifica, abre, ejecuta comandos y cierra contenedores. Consulta [operación](../docker/README.md).

No implementado: llamadas de proveedores, ciclo de agentes, persistencia de runs reales y evaluación E2E. Las interfaces en agents/ y logging/ documentan esos contratos. La generación sigue bloqueada.

packet:preview permite inspeccionar texto/datos y nunca lanza modelos. No es una barrera de aislamiento. El sandbox recibe un payload por allowlist y crea un Git nuevo sin remotos; no monta rutas del host ni copia .git del corpus. V1–V3 quedan bloqueados hasta disponer de exportador auditado de historia de referencias validadas.

Un timeout o exceso de salida durante exec cierra el contenedor propio para no dejar procesos interiores activos. El cierre CLI usa la identidad de la sesión guardada localmente, aunque cambie el manifiesto de imagen.
