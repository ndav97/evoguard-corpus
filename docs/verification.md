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

## Motor y ensayo simulado — 2026-09-23
- Suite completa: 58 pruebas aprobadas, validación F001 y build del scaffold correctos.
- Ensayo Docker: reparación (2 intentos/1 workspace), fallo simulado de oracle y reasignación (2/2), agotamiento técnico (15/5) y timeout de comando real (5/5). Total 24 intentos y 13 contenedores cerrados; sin recursos del runner remanentes.
- Build y typecheck reales en el contenedor. Agente, tests de desarrollo, oráculo y arquitectura guionados; no se generó código de catálogo. Los parches contienen un marcador instrumental.
- Pruebas negativas cubren ciclos, respuesta/evaluación inválidas, error de infraestructura, logger fallido, snapshot/cierre fallidos y rechazo de modo real. El preflight conserva bloqueo de generación.
- Revisión independiente: se corrigieron aceptación prematura ante timeout del snapshot y clasificación de timeout de comando. En ambos casos se observó una prueba fallar y pasar tras la corrección. Se repitió el ensayo con el código corregido; no se afirma segunda revisión independiente.

Resumen y hashes: [verification/runner-simulation.json](verification/runner-simulation.json). Trazas completas en `.artifacts/simulations/c103f65d-bdde-4745-a8eb-793989ca179d/`, fuera de Git y separadas de runs experimentales. Las pruebas de infraestructura no validan R001–R005.

## Adaptadores y conectividad — 2026-09-23
- Suite completa: 71 pruebas aprobadas, validación estructural y build correctos. Solicitudes por proveedor, acciones estrictas, salida incompleta, campos privados, credenciales ausentes y digest/contexto locales incorrectos comprobados.
- Transporte HTTP probado contra servidor local real: cancelación durante lectura, límite de 2 MiB y rechazo de redirecciones. Los tests comerciales usan respuestas controladas; no demuestran acceso a cuentas.
- Qwen2.5-Coder 7B y Granite 3.3 8B pasaron smoke real con Ollama, petición instrumental sin F001 ni ejecución de herramientas. Metadatos completos en verification/provider-connectivity.json.
- OpenAI/Anthropic/Google: credenciales ausentes, conectividad no probada. Se conserva este pendiente explícito.
- Revisión independiente detectó pérdida de uso observado en respuestas truncadas/rechazadas; se reprodujo en una prueba fallida y se corrigió extrayendo modelo/tokens antes de validar terminación. No hubo hallazgos críticos. La prueba pasa en los cuatro transportes; no se afirma segunda revisión independiente.

No se generó V0 ni se habilitó generación experimental. Los parámetros preparatorios y el manejo de contexto aún requieren cierre antes del piloto.

## Rutas Synterolink
75 pruebas aprobadas, validación F001 y build correctos. Pruebas añadidas para los tres endpoints, headers nativos, clave específica/común, no reutilización de claves directas, rechazo de hosts/rutas no autorizados y registro del intermediario. El diagnóstico encontró claves Synterolink ausentes en la sesión; no se probó conectividad comercial real. La evidencia de conectividad anterior conserva su carácter histórico y no demuestra acceso a Synterolink.

## Conectividad autenticada Synterolink
Tras configurar el usuario .env, GPT-5.6 Sol y Gemini pasaron la primera comprobación. Sonnet respondió HTTP 200/modelo claude-sonnet-5, pero envolvió el JSON en Markdown y fue rechazado por el parser. Un diagnóstico acotado confirmó ese formato; no se registraron claves ni razonamiento interno.

Se incluyó el contrato de respuesta en el mensaje visible común de los cinco adaptadores; pruebas de envío fallaron antes y pasaron después del cambio. No se relajó el parser. La comprobación final autenticada pasó para openai/anthropic/google; evidencia en [verification/synterolink-connectivity.json](verification/synterolink-connectivity.json). Suite completa: 75 PASS y build correcto. No se envió F001 ni se ejecutaron acciones propuestas por los modelos. Generación experimental todavía bloqueada.

## Oráculo F001 — calibración instrumental — 2026-09-24
- 33/33 casos con plan ejecutable y hash de especificación; caso modificado o desconocido rechazado.
- Página de calibración correcta: V0 10/10, V1 17/17, V2 25/25, V3 33/33 PASS. Una V0 no satisface V1 (7 casos R003 FAIL).
- Controles negativos: 17 mutantes (mayúsculas, recorte, conjunción, categoría, vacío con productos, orden descendente invertido, orden perdido al buscar, página de 9, orden que reinicia página, búsqueda/categoría sin reinicio, navegación fuera de rango, índice NaN, selección múltiple, por índice, no limpiada y restaurada) rechazados por los casos previstos.
- Estabilidad V3: 5/5 ejecuciones con veredictos idénticos.
- Puente con runner simulado: FAIL del oráculo → reasignación con workspace nuevo; ningún ID de caso ni observación en el contexto del constructor ni en eventos; fallo de apertura → INFRA_ERROR.
- Suite completa: 102 pruebas, 97 PASS; 5 FAIL del manifiesto de contenedor (`BUILT`, sin verificación vigente). Build no ejecutado en esta comprobación.

Esta evidencia calibra el evaluador; no valida ninguna aplicación F001 ni habilita generación.

## Contrato de interfaz observable — 2026-09-24
- `tests/contract.test.mjs`: los 5 controles con nombre del adapter coinciden en rol y nombre con el `ui_contract`, y viceversa; R002/R003/R005 fijan valores de opciones, `role="status"` y `aria-pressed`.
- Packet por versión: V0 recibe «Buscar» y «Categoría»; V1 añade «Orden»; V2 «Anterior»/«Siguiente»; V3 la selección. Ningún texto de contrato de R003–R005 aparece en el packet V0.
- Oráculo sin cambios de comportamiento: las pruebas de calibración siguen pasando.
- Pendiente: reverificar el contenedor porque cambió el payload verificado.

## Política de contexto — 2026-09-24
- 115/115 pruebas (incluye `tests/context.test.mjs`, 9). Evidencia del contenedor vigente.
- Calibración pendiente en el equipo del usuario: `npm run context:calibrate` (informe) y `-- --write` (fija `bytes_per_token` y escribe `docs/verification/context-calibration.json`). Ensayo del script contra un Ollama simulado: flujo correcto de lectura, cálculo y escritura; sin valor probatorio sobre los tokenizadores.

## Calibración de contexto — 2026-09-24
- Evidencia: `docs/verification/context-calibration.json` (Ollama 0.32.15, 16 mediciones). Mínimo 3,3149 B/token (granite3.3:8b, JSON); qwen2.5-coder:7b 3,6418.
- Estimador: 3,31 B/token × 0,8. Margen real frente al núcleo V3 de Granite: 4261 estimados contra 3101 medidos.
- Se mantiene el factor 0,8 porque contenidos no medidos (hashes, lockfiles, código minificado) pueden tener proporciones menores; el control posterior `CONTEXT_ESTIMATE_VIOLATION` detecta subestimaciones.

## Pipeline real (Paso 5) — 2026-09-24
- Entorno: Linux de Claude con Docker y la imagen archivada del usuario (hash del archivo verificado). `environment:verify` PASS con los nuevos archivos verificados.
- Oráculo en contenedor aislado: página de calibración V3 33/33 PASS (~8,5 s); mutante de conjunción V0 7/10 FAIL; sin contenedores remanentes.
- Ensayo integral `npm run pipeline:rehearse` (43769398-211a-4adb-9c26-2d7a65536e8a): reparación, rechazo del oráculo, rechazo de arquitectura, aceptación con commit, registros `generation.json` válidos contra el esquema, canal privado separado y reconstrucción de V1 con hashes reproducibles.
- `tests/pipeline.test.mjs` (10) sin Docker: arquitectura, evaluador, linaje y auditoría, modos del motor y persistencia.
