# Adaptadores del pool elegido

Objetivo autorizado: registrar GPT-5.6 Sol, Claude Sonnet 5, Gemini 3.1 Pro, Qwen2.5-Coder 7B y Granite 3.3 8B; implementar transporte y diagnóstico sin generar F001/V0.

Diseño: HTTP nativo de Node, sin nuevas dependencias. Un protocolo JSON de acciones común, validado antes de devolver argv al motor. Responses API, Messages API, Gemini generateContent y Ollama chat. Las credenciales permanecen en el host. URLs fijas, redirects prohibidos, límite de tamaño y cancelación/timeout; errores sanitizados sin cuerpos ni headers privados. Sin reintentos automáticos que consuman tokens fuera de los límites del runner.

config/models.json registra selección y parámetros preparatorios separados de provenance.models, que conserva uso experimental inexistente. Identificadores verificados en documentación oficial; no se sustituyen modelos. Locales por tag más digest comprobado antes de inferencia. Contexto 8192 con límite conservador de bytes de entrada y reserva para salida, sin truncamiento silencioso; planificación de contexto experimental pendiente.

Cada llamada registra por callback metadatos permitidos: proveedor/modelo solicitado y observado, parámetros, inicio/duración, tokens disponibles y costo null. No registrar razonamiento interno ni claves. El puente reconstruye exclusivamente el packet e historial visible del motor; no acepta campos privados adicionales en la serialización.

- [x] Tests de solicitudes y parsing para los cuatro transportes/cinco modelos; rechazo de salida incompleta, JSON inválido, metadata faltante, redirección y credencial ausente.
- [x] Implementar transporte, protocolo, factory por proveedor y dispatcher compatible con next(context,{signal,timeout}).
- [x] Diagnóstico de selección, claves presentes/ausentes y metadatos Ollama; smoke explícito solo con saludo instrumental, sin ejecutar acciones. Registrar digest/cuanti­zación/runtime locales.
- [x] Suite completa, revisión independiente y evidencia de conectividad real disponible. Actualizar documentación/preflight y commit. Comercial sin claves queda pendiente honestamente.

Decisiones operativas: JSON estructurado común en vez de tool calling nativo específico; razonamiento comercial explícito pero no equiparado entre proveedores; parámetros todavía no congelados para piloto. El runner público continúa solo en simulación, y no se conectan estos adaptadores a un comando de generación.
