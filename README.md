# EvoGuard Corpus
Infraestructura que construye el **corpus** de la tesis. El producto final de la tesis es **EvoGuard UI** (modelo de predicción de impacto y riesgo de regresión); este repositorio solo produce los datos con los que EvoGuard UI se entrena y evalúa.

**Desde el 2026-10-02 el corpus es solo semi-real** (`config/strata.json`):
- **Base:** repositorios públicos React/TypeScript fijados en un commit V0 verificado (`families-real/Sxxx-*`).
- **Cambios:** tres turnos T001–T003 por familia en el piloto, con tests ocultos y una implementación de referencia calibrada.
- **Piloto:** 20 familias (S001–S020).
- **Estrato sintético:** F001–F010 queda archivado en [`archive/sintetico/`](archive/sintetico/README.md).

## Uso local (Windows, con Docker Desktop)
```powershell
npm ci
npm run check                                 # validación + pruebas + build del scaffold
npm run corpus:validate                       # todas las familias (Fxxx archivadas, Sxxx activas)
scripts\real\calibrar-familias-reales.cmd -Familia S011    # calibra una familia nueva sobre su base instalada
scripts\real\preparar-imagenes.cmd -Familias S011          # imagen inmutable de la familia
scripts\real\ensayar-familias.cmd -Familias S011           # ensayo del pipeline sin modelos
npm run generation:preflight -- S011
npm run corpus:generate -- S011 all
npm run corpus:audit -- S011 --freeze
```
Guía detallada: [docs/estrato-semi-real.md](docs/estrato-semi-real.md). Autoría de familias nuevas: [docs/autoria-familias-semi-reales.md](docs/autoria-familias-semi-reales.md).

## Contenido
- config/models.json y runner/providers/: pool seleccionado, adaptadores reales y diagnóstico.
- runner/execution/, runner/protocol/ y runner/real/: motor de intentos, protocolo de acciones 1.1 y pipeline semi-real (imágenes, suite, oráculo de tests ocultos, control de alcance, auditoría).
- schema/: JSON Schema draft-07, versión 1.0.0, validación estricta.
- families-real/: estrato semi-real activo (S001–S020): manifiesto, peticiones, tests ocultos y parches de referencia por familia.
- archive/sintetico/: estrato sintético archivado (F001–F010 y sus oráculos).
- prompts/: instrucciones comunes, generación, evolución y reparación.
- templates/react-vite/ y docker/ (salvo docker/real/): scaffold y runtime del estrato sintético archivado, conservados por trazabilidad. docker/real/ es la instalación de las imágenes semi-reales.
- runs/: separación entre construcción de referencias y ejecuciones de π0.
- docs/: protocolo recuperado, decisiones operativas, entorno y verificación.

## Estado (2026-10-02)
- **S001–S010:** calibradas, con imágenes verificadas y ensayos del pipeline en PASS. Están listas para generar en cuanto se congelen los modelos.
- **S011–S020:** en redacción o calibración. Su progreso está en `docs/estado-del-proyecto-2026-10-02.md`.
- **Aún no hay referencias semi-reales generadas por modelos**, ni etiquetas de impacto o riesgo (π0).
- **Seguridad:** no ejecutar un agente experimental en la raíz de este repositorio. Los constructores trabajan solo dentro de contenedores sin red.
