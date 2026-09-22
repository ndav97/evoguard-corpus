# Evaluación independiente
Los casos se definen antes de generar la aplicación. Este directorio solo pertenece al evaluador.
F001 contiene un caso por criterio de aceptación (33 casos) y un contrato de adapter de UI; no contiene un oráculo E2E operativo todavía.
Tras V0 se implementará el adapter y las pruebas contra controles reales, sin importar lógica funcional de la app. Después se verificarán versiones correctas y mutantes conocidos y se comprobará estabilidad 5/5 por referencia desde entorno limpio.
El fallo del oráculo se registra solo en evaluator/runs y causa reasignación; no se expone al agente para reparación.
No llamar a un conjunto sin adapter como PASS ni producir métricas de riesgo antes de referencias válidas.
