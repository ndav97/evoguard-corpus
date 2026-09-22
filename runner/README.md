# Runner preparatorio
Implementado: validación de esquemas e integridad, preview de entradas por versión, preflight de generación.
No implementado en este alcance: llamadas de proveedor, ejecución de agentes, aislamiento Docker, persistencia de runs reales y evaluación E2E. Las interfaces en agents/ y logging/ documentan esos contratos.
packet:preview permite inspeccionar texto/datos y nunca lanza procesos de modelos. El runner experimental deberá crear un repositorio aislado a partir del scaffold (V0) o referencia anterior, montar solo ese repo y su historia pasada saneada. No copiar .git del corpus.
Un packet no es una barrera de seguridad: no iniciar generación hasta implementar y verificar el aislamiento y completar el preflight.
