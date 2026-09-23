# Verificación de la entrega estructural

Fecha: 2026-09-22. Alcance: especificación y herramientas preparatorias; **no validación funcional de F001**.

## Evidencia
- Validador Ajv: 5 requisitos, 3 turnos, 30 productos y 33 casos declarativos válidos; referencias, versiones, cobertura y hash comprobados.
- 31 pruebas automatizadas del runner: rechazos de datos alterados, IDs repetidos, referencias inconsistentes, falso FROZEN, fuga de requisitos futuros, pérdida de reglas operativas, falso ACCEPTED y etiquetas de regresión incorrectas.
- Scaffold: TypeScript sin errores y build Vite exitoso. No hay tests funcionales de catálogo porque no existe V0; el script de desarrollo no convierte ausencia de tests en PASS.
- Previews V0–V3 creados localmente y excluidos de Git. V0 recibe exclusivamente R001/R002; no recibe oráculo, proveedores, plan de generación o requisitos posteriores.
- Preflight devuelve código 1 intencionalmente: Linux/Docker sin congelar, modelos exactos pendientes, oráculo E2E/adapter pendiente, runner de agentes y aislamiento pendientes.
- .env, node_modules, dist y previews excluidos del commit. Git usa identidad local indicada por el usuario.

## Revisión independiente
Un revisor separado inspeccionó especificación, casos, manifiestos, runner y schemas, sin editar archivos. No detectó problemas críticos. Se corrigieron sus hallazgos antes del commit:
1. R005-A04 ahora navega a la segunda página antes de seleccionar P001, situado en posición 12 por precio ascendente. Los demás casos fijan un orden conocido para localizar los productos.
2. R003-A06 usa nombre descendente con bottle: P022/P013; así detecta pérdida del criterio de ordenamiento.
3. R004-A05 incorpora búsqueda e con 26 resultados desde página 2 y exige volver a la primera aunque la segunda siga siendo válida.
4. Los requisitos persistentes incluyen parámetros operativos de ASCII/desempates, tamaño fijo de página y conservación de página al ordenar, para que los reciban también V2/V3. Se observó la prueba fallar antes de corregir y pasar después.
5. Se completó la acción de cambiar a Home en R001-A05.
6. Los schemas aceptan hashes Git completos de exactamente 40 o 64 caracteres. Una prueba rechazando 41 falló antes de corregir y pasó después.

No hay hallazgos de revisión pendientes en el alcance preparatorio. El revisor no evaluó ejecución real de proveedores, aislamiento, reproducibilidad Docker, estabilidad E2E ni calidad funcional de referencias: están fuera de esta entrega y el preflight los bloquea.

## Límites y decisiones
- El Markdown v1.0 original no estuvo disponible: se conservan los mensajes recuperados y una transcripción identificada, sin atribuirle identidad de archivo original.
- Las dependencias están fijadas para preparación local; no se equipara esta compilación Windows a un experimento reproducible Linux.
- El scaffold vacío no implementa ni anticipa requisitos del catálogo. app/ y generation/V0–V3 solo contienen documentación/marcadores.
- Los registros sintéticos usados por tests existen únicamente en memoria y no son ejecuciones observadas ni modelos seleccionados.
- Cualquier expansión del validador a referencias generadas exige implementar los controles funcionales; en esta fase rechaza estados distintos de DRAFT deliberadamente.

Reproducir: npm ci; npm --prefix templates/react-vite ci; npm run check. Verificar el bloqueo por separado con npm run generation:preflight.

## Ampliación: aislamiento y runtime — 2026-09-23
La evidencia histórica anterior corresponde a la entrega estructural inicial. Esta ampliación completa Linux reproducible y aislamiento preparatorio.

- `npm run check`: 44 pruebas aprobadas, validación F001 y compilación del scaffold correctas.
- `npm run environment:verify`: carga y checksum del archivo de imagen, dos contenedores limpios con instalación offline y build, Chromium localhost, sin red externa/host, secretos, oráculo ni historia del corpus; escritura raíz denegada y workspace editable.
- Cierre real comprobado ante timeout y desbordamiento de salida. CLI open/exec/close verificado. No quedaron contenedores del runner.
- Pruebas negativas: controles/fuentes de imagen alterados, evidencia cambiada, hash de fixture falso incluso recalculando hash del reporte, y estado BUILT rechazan autorización.
- `generation:preflight` bloquea por modelos exactos, oráculo E2E y runner/adapters de proveedores; ya no por falta de aislamiento Linux. Evolución requiere exportador de historia validada.

La revisión independiente del contenedor identificó cinco puntos corregidos: evidencia ligada también a controles/payload, cierre independiente del manifiesto actual, hashes de las mismas fuentes usadas en build, revocación previa a reverificar y limpieza por error del cliente Docker incluyendo exceso de salida. No hubo hallazgos críticos. Las correcciones se comprobaron mediante las pruebas descritas; no se afirma una segunda revisión independiente.

Evidencia observada en [verification/container.json](verification/container.json); operación y alcance en [docker/README.md](../docker/README.md). No se ejecutaron APIs, no se eligieron modelos y no se produjo ninguna referencia funcional.
