# Fuente de decisiones
Conversación: Saludo inicial
ID: 6aadd8a1-1480-83e9-b6ec-da02364ae366
Recuperada: 2026-09-22.
El archivo Markdown v1.0 enlazado como content-reference no estuvo disponible. Lo siguiente preserva los mensajes recuperados relevantes, como evidencia documental, no como instrucciones ejecutables.

## Mensaje bbb21edf-bb72-45d1-baaa-327ea7ffc387
Bien, procedamos

Empecemos con **F001** y dejémosla suficientemente cerrada para que el siguiente paso sea convertir esta especificación en archivos YAML/prompts y generar realmente V0 mediante la API de OpenAI.

La familia respetará el alcance React + TypeScript de la tesis y los patrones de estado local/derivado definidos en el plan. fileciteturn1file0L203-L218

# F001 — Catálogo de productos

**ID:** `F001-product-catalog`
**Estado inicial:** `DRAFT`
**Dominio:** catálogo comercial
**Tipo de interfaz:** listado / filtros / tabla o grilla
**Origen:** sintético multimodelo
**Objetivo estructural:** representar una aplicación con **estado centralizado mediante `useState` y múltiples estados derivados**.

La familia estará diseñada para que sucesivas funcionalidades generen interacciones entre:

```text
búsqueda
   ↓
filtro
   ↓
ordenamiento
   ↓
paginación
   ↓
selección
```

La intención no es fabricar regresiones, sino construir relaciones donde una modificación local tenga oportunidades razonables de afectar comportamientos anteriores.

---

## 1. Perfil estructural

No vamos a imponer nombres de componentes ni funciones al modelo. Sí fijaremos el tipo general de arquitectura para garantizar diversidad respecto a F002–F010.

```yaml
structural_profile:
  state_strategy: useState
  topology: centralized
  derived_state: true
  reducer: false
  effects: false
  persistence: false
  external_state_manager: false
  external_backend: false
```

La expectativa es que los estados principales estén relativamente centralizados y que la colección visible se derive de ellos.

Por ejemplo, conceptualmente podría acabar existiendo algo parecido a:

```text
products
query
category
sort
page
selectedProduct
       │
       ▼
derived visible products
```

pero **esto no se mostrará al agente como diseño obligatorio**.

El modelo decidirá:

- cantidad de componentes;
- nombres;
- organización de archivos;
- funciones auxiliares;
- representación del estado;
- estructura visual.

Solo deberá mantenerse aproximadamente dentro del rango operativo de **5–20 componentes relevantes**.

---

# 2. Fixture

F001 usará un dataset estático y determinista.

Propongo **30 productos**.

Esto nos proporciona suficientes datos para que la paginación posterior sea real:

\[
30 > 10 + 10
\]

Cada producto tendrá exclusivamente:

```ts
type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
};
```

Usaremos IDs estables:

```text
P001
P002
...
P030
```

Cuatro categorías:

```text
Electronics
Home
Sports
Books
```

La distribución puede quedar:

| Categoría | Productos |
|---|---:|
| Electronics | 9 |
| Home | 8 |
| Sports | 7 |
| Books | 6 |
| **Total** | **30** |

Los nombres serán únicos, ASCII y suficientemente variados para no introducir problemas de locale.

Ejemplos:

```text
Wireless Mouse
Mechanical Keyboard
Desk Lamp
Coffee Grinder
Running Shoes
Yoga Mat
Clean Code
Design Patterns
```

El precio será siempre:

```text
number > 0
```

y algunos precios deberán estar intencionalmente fuera del orden original para verificar correctamente R003.

El fixture completo se congelará antes de generar V0.

---

# 3. Evolución completa de F001

La familia queda diseñada así:

| Versión | Solicitud | Nuevo requisito | Modelo principal |
|---|---|---|---|
| **V0** | Construcción inicial | R001 + R002 | ChatGPT/OpenAI |
| **T1 → V1** | Ordenamiento | R003 | Claude |
| **T2 → V2** | Paginación | R004 | Gemini |
| **T3 → V3** | Selección estable | R005 | Local A |

La versión exacta de cada modelo se congelará cuando iniciemos la generación real.

---

# 4. R001 — Búsqueda por nombre

### Definición

El usuario debe poder buscar productos utilizando parte de su nombre.

```yaml
id: R001
name: search_products_by_name
introduced_at: V0
status: active
```

### Semántica observable

La búsqueda será:

```text
case-insensitive
+
substring
+
trim de espacios externos
```

Por ejemplo:

```text
"mouse"
"MOUSE"
" mouse "
```

deben producir el mismo resultado.

Una consulta vacía equivale a no aplicar búsqueda.

### Criterios de aceptación

```yaml
acceptance:
  - una cadena parcial devuelve los productos cuyo nombre la contiene
  - la búsqueda no distingue mayúsculas de minúsculas
  - se ignoran espacios iniciales y finales de la consulta
  - una consulta vacía muestra todos los productos compatibles con los demás filtros
  - la búsqueda debe combinarse con el filtro de categoría
```

Importante: el último criterio comienza a crear interacción con R002.

---

# 5. R002 — Filtro por categoría

```yaml
id: R002
name: filter_products_by_category
introduced_at: V0
status: active
```

El usuario podrá elegir:

```text
All
Electronics
Home
Sports
Books
```

### Criterios de aceptación

```yaml
acceptance:
  - All no excluye productos por categoría
  - cada categoría muestra solamente productos pertenecientes a ella
  - cambiar la categoría actualiza inmediatamente la lista visible
  - búsqueda y categoría se aplican conjuntamente
  - un resultado vacío se representa correctamente sin mostrar productos incorrectos
```

La combinación esperada es:

\[
Visible =
Search(Product)
\cap
Category(Product)
\]

No le diremos al agente cómo implementar esa operación.

---

# 6. Estado que debe cumplir V0

Al finalizar V0:

```text
R001 ✅
R002 ✅
```

No debe existir todavía, como requisito funcional:

```text
ordenamiento
paginación
selección
```

Esto es importante.

**No informaremos a ChatGPT de T1, T2 ni T3 al generar V0.**

Queremos que la aplicación evolucione genuinamente. Si reveláramos desde el principio que posteriormente habrá selección, paginación y ordenamiento, el modelo podría preparar anticipadamente la arquitectura y reducir artificialmente el riesgo de los cambios posteriores.

---

# 7. T1 — Introducir ordenamiento

Claude recibirá **V0 ya validada**, pero no conocerá T2 ni T3.

La solicitud será aproximadamente:

> Permite ordenar los productos por nombre o precio. Para nombre debe poder utilizarse orden ascendente y descendente, y para precio de menor a mayor y de mayor a menor. El ordenamiento debe funcionar correctamente junto con la búsqueda y el filtro por categoría existentes.

Esto introduce:

```yaml
id: R003
name: sort_products
introduced_at: T001
status: active
```

### Criterios de aceptación

```yaml
acceptance:
  - permite ordenar por nombre ascendente
  - permite ordenar por nombre descendente
  - permite ordenar por precio ascendente
  - permite ordenar por precio descendente
  - el ordenamiento se aplica sobre los productos que cumplen búsqueda y categoría
  - cambiar búsqueda no desactiva el criterio de ordenamiento actual
  - cambiar categoría no desactiva el criterio de ordenamiento actual
```

Conceptualmente:

\[
Visible =
Sort(
Filter(
Search(Product)
))
\]

Aquí aparece nuestro primer acoplamiento interesante:

```text
search ─────┐
            ├──→ derived products → sort
category ───┘
```

Un agente podría implementar perfectamente R003 pero romper R001 o R002.

Ese sería un caso real de regresión, no uno fabricado.

---

# 8. Estado que debe cumplir V1-reference

```text
R001 ✅ búsqueda
R002 ✅ categoría
R003 ✅ ordenamiento
```

Solo si los tres pasan el oráculo independiente, V1 puede convertirse en versión de referencia.

Esto es coherente con el procedimiento previsto en el plan para que cada referencia satisfaga todos los requisitos activos. fileciteturn1file0L592-L603

---

# 9. T2 — Introducir paginación

Gemini recibirá V1.

Solicitud prevista:

> Muestra los productos en páginas de máximo 10 resultados. La paginación debe aplicarse sobre los resultados actuales después de considerar búsqueda, categoría y ordenamiento. Cuando una nueva búsqueda o categoría haga que la página actual deje de ser apropiada, vuelve a la primera página.

Nuevo requisito:

```yaml
id: R004
name: paginate_products
introduced_at: T002
status: active
```

### Semántica

El tamaño queda congelado en:

```text
PAGE_SIZE = 10
```

No es configurable.

La operación conceptual pasa a ser:

\[
Page(
Sort(
Filter(
Search(Product)
)))
\]

### Criterios de aceptación

```yaml
acceptance:
  - ninguna página muestra más de 10 productos
  - cuando existen más de 10 resultados es posible acceder a páginas posteriores
  - la paginación se calcula después de búsqueda y categoría
  - la paginación conserva el ordenamiento seleccionado
  - cambiar la búsqueda vuelve a la primera página
  - cambiar la categoría vuelve a la primera página
  - no es posible navegar a una página inexistente
  - con cero resultados no se muestra una página inválida
```

Un ejemplo útil para el oráculo:

```text
30 productos
↓
page 1 = 10
page 2 = 10
page 3 = 10
```

Después:

```text
page 3
↓
seleccionar Electronics
↓
9 resultados
↓
page = 1
```

Eso verifica una interacción real entre dos funcionalidades creadas en momentos diferentes.

---

# 10. Estado de V2-reference

V2 solamente será válida cuando:

```text
R001 ✅
R002 ✅
R003 ✅
R004 ✅
```

---

# 11. T3 — Introducir selección

Este será probablemente el turno estructuralmente más interesante de F001.

El modelo Local A recibirá V2.

Solicitud:

> Permite seleccionar un único producto de la lista. El producto seleccionado debe conservar su identidad cuando se cambia el ordenamiento o se navega entre páginas. Si una búsqueda o cambio de categoría excluye al producto seleccionado de los resultados actuales, la selección debe limpiarse.

Nuevo requisito:

```yaml
id: R005
name: stable_product_selection
introduced_at: T003
status: active
```

### Criterios de aceptación

```yaml
acceptance:
  - el usuario puede seleccionar un producto
  - solo existe un producto seleccionado a la vez
  - debe existir una indicación observable del producto seleccionado
  - ordenar los productos no cambia cuál producto está seleccionado
  - navegar entre páginas no cambia la identidad seleccionada
  - regresar a la página donde está el producto muestra nuevamente el mismo producto seleccionado
  - si búsqueda excluye al producto seleccionado, la selección se limpia
  - si categoría excluye al producto seleccionado, la selección se limpia
```

Observa que **no decimos**:

> utiliza `product.id`.

Eso sería imponer la solución.

Solo exigimos comportamiento.

Si el modelo decide implementar:

```ts
selectedIndex
```

puede parecer correcto inicialmente.

Pero:

```text
seleccionar Product A
↓
ordenar por precio
↓
índice sigue siendo 3
↓
ahora índice 3 = Product B
```

El oráculo detectará:

```text
R005 ❌
```

Eso es exactamente el tipo de relación estructural que queremos aprender posteriormente.

---

# 12. Grafo funcional esperado conceptualmente

Sin obligar al modelo a implementarlo exactamente así, F001 debería terminar exhibiendo relaciones aproximadamente de este tipo:

```text
                    products
                       │
        ┌──────────────┼───────────────┐
        │              │               │
      query         category         sort
        │              │               │
        └───────┬──────┘               │
                ▼                      │
        filteredProducts ──────────────┘
                │
                ▼
          sortedProducts
                │
             page
                │
                ▼
         visibleProducts
                │
                ├────────→ UI
                │
                ▼
          product selection
```

Este tipo de dependencia es muy útil para el extractor de grafos que plantea la tesis. fileciteturn1file0L625-L639

---

# 13. Matriz de interacciones funcionales

F001 nos dará varias relaciones interesantes:

| Cambio | Puede interactuar con |
|---|---|
| Search | Category, Pagination, Selection |
| Category | Search, Pagination, Selection |
| Sort | Search, Category, Pagination, Selection |
| Pagination | Search, Category, Sort, Selection |
| Selection | Sort, Pagination, Search, Category |

Eso no significa que todas deban producir regresiones.

Simplemente significa que existe una **dependencia conductual verificable**.

---

# 14. Tests de desarrollo

El agente implementador tendrá libertad para:

```text
crear tests
modificar tests existentes
ejecutarlos
usar sus fallos para reparar
```

Por ejemplo, Claude podría crear tests de R003.

Cuando posteriormente Gemini reciba V1, verá esos tests como parte normal del repositorio.

Gemini podrá modificarlos si el nuevo requisito realmente lo requiere, pero cualquier modificación también quedará registrada en su patch.

Esto reproduce bastante bien una evolución real del proyecto.

---

# 15. Oráculo independiente

Separadamente tendremos:

```text
oracle/F001/
```

conceptualmente:

```text
R001.search.spec
R002.category.spec
R003.sort.spec
R004.pagination.spec
R005.selection.spec
```

Estos archivos:

```text
NO estarán dentro del workspace del agente.
```

El modelo nunca podrá leerlos.

La suite independiente verificará comportamiento desde la perspectiva del usuario y no detalles de implementación.

---

# 16. Ejemplo importante de R005

El oráculo podría ejecutar conceptualmente:

```text
1. ordenar por precio ascendente
2. seleccionar Wireless Mouse
3. ordenar por nombre descendente
4. comprobar que Wireless Mouse sigue seleccionado
```

y otro:

```text
1. seleccionar Wireless Mouse
2. navegar a otra página
3. regresar
4. comprobar que Wireless Mouse continúa seleccionado
```

y otro:

```text
1. seleccionar Wireless Mouse
2. filtrar por Books
3. comprobar que no existe selección
```

Estos casos no le indican al modelo cómo resolver el problema.

Solo verifican la semántica que nosotros definimos previamente.

---

# 17. Política multimodelo concreta de F001

La asignación normal queda:

```text
V0  → ChatGPT
T1  → Claude
T2  → Gemini
T3  → Local A
```

Y definiremos como fallback circular:

```text
ChatGPT
   ↓
Claude
   ↓
Gemini
   ↓
Local A
   ↓
Local B
   ↓
ChatGPT
```

Por ejemplo, si Gemini falla T2 después de sus tres intentos:

```text
Gemini → FAIL
       ↓
registrar
       ↓
Local A
```

Local A empieza nuevamente desde:

```text
V1-reference
```

y **no** desde el parche defectuoso de Gemini.

---

# 18. Protocolo de generación de V0

Para ChatGPT será:

```text
F001 specification
      +
fixture
      +
constraints
      +
R001
      +
R002
      ↓
 ChatGPT API
      ↓
intento 1
      ↓
build + tests propios
      ↓
si falla
      ↓
repair 1
      ↓
si falla
      ↓
repair 2
```

Cuando el modelo declare terminada su solución:

```text
workspace del agente
      │
      X ← sin acceso
      │
independent oracle
```

Si pasa:

```text
V0 = VALIDATED
```

Si posteriormente pasa auditoría:

```text
V0 = AUDITED
```

---

# 19. Prompt base para V0

Todavía no es el prompt técnico final para la API, pero su contenido queda conceptualmente cerrado:

```markdown
Eres un agente de desarrollo trabajando sobre una aplicación
React + TypeScript.

Tu tarea es construir una aplicación web de catálogo de productos.

Debes cumplir los requisitos funcionales R001 y R002 proporcionados.

Restricciones:
- React
- TypeScript
- componentes funcionales
- estado local de React con useState
- no useReducer para esta aplicación
- no Redux, Zustand ni gestores externos de estado
- no backend
- no autenticación
- no APIs externas
- usar exclusivamente el fixture proporcionado
- no añadir nuevas dependencias salvo que sea estrictamente necesario
- mantener una estructura razonablemente modular

Puedes:
- crear y modificar archivos
- crear tus propias pruebas
- ejecutar las pruebas
- ejecutar typecheck/build
- usar el navegador local

No conoces requisitos futuros.

Entrega una aplicación funcional que cumpla todos los requisitos
actualmente indicados.
```

Después incorporaremos R001, R002 y el fixture.

---

# 20. Información que NO recibirá

En V0 ChatGPT no verá:

```text
R003
R004
R005
T1
T2
T3
oráculo independiente
soluciones futuras
```

Claude en T1 tampoco verá T2 ni T3.

Gemini en T2 tampoco verá T3.

Esto será una regla general del corpus:

> **cada agente conoce solamente el pasado y el presente de la evolución, nunca el futuro.**

Eso es metodológicamente importante.

---

# 21. Ground truth de impacto en F001

Supongamos que Gemini implementa correctamente T2.

Compararemos:

```text
V1-reference
       ↓
reference patch
       ↓
V2-reference
```

El futuro extractor mapeará el parche contra el grafo previo.

Podría resultar:

```text
Catalog component     impact=1
filteredProducts      impact=1
sort state            impact=0
pagination state      creation
Pagination component  creation
Search component      impact=0
```

No definiremos esas etiquetas manualmente de antemano.

Surgirán de la solución de referencia validada.

---

# 22. Ground truth de riesgo

Después, independientemente, π0 recibirá por ejemplo:

```text
V2-reference
+
T3
```

y producirá una edición.

El oráculo evalúa:

```text
R001
R002
R003
R004
R005
```

Supongamos:

```text
R001 ✅
R002 ✅
R003 ✅
R004 ❌
R005 ✅
```

Entonces:

```text
R004 = regression
```

porque:

```text
antes de T3:
R004 estaba vigente + pasaba

después de T3:
R004 sigue vigente + falla
```

Es justamente la definición de regresión establecida en la metodología. fileciteturn1file0L259-L287

---

# 23. Criterios para congelar F001

F001 solamente podrá pasar:

```text
AUDITED
   ↓
FROZEN
```

cuando:

```text
V0 pasa R001–R002
V1 pasa R001–R003
V2 pasa R001–R004
V3 pasa R001–R005
```

y además:

```text
oráculo estable 5/5
fixture congelado
commits registrados
patches registrados
prompts registrados
modelos registrados
intentos registrados
tests registrados
sin servicios externos
sin modificaciones funcionales humanas
perfil estructural auditado
procedencia completa
```

Solo después podrá utilizarse F001 en ejecuciones experimentales.

---

## F001 queda conceptualmente cerrada

Tenemos ahora exactamente lo que buscábamos:

```text
F001
├── dominio definido
├── perfil estructural
├── fixture
├── V0
│   ├── R001
│   └── R002
├── T1 / R003
├── T2 / R004
├── T3 / R005
├── criterios de aceptación
├── interacción funcional
├── estrategia de tests
├── oráculo
├── rotación multimodelo
├── fallback
├── reglas de información
└── criterios de congelamiento
```

El siguiente paso ya es mucho más práctico: **convertir F001 a la estructura real del dataset (`family.yaml`, `requirements/*.yaml`, `turns/*.yaml`, fixture, prompts y esquemas) y preparar el scaffold React+TypeScript+Vite desde el cual ChatGPT generará V0**. Ahí empieza efectivamente la construcción del corpus.

## Mensaje bbb2107a-2db0-4831-9e3d-9abcccf45caa
Si, todo con lo recomendado.
Antes de pasar a la siguiente etapa, quisiera saber de que forma esta metodología ayudará a que posteriormente generemos el modelo predictivo

Esta metodología está pensada justamente para que el corpus no sea solo una colección de proyectos React, sino un conjunto de entrenamiento útil para los **dos predictores principales de EvoGuard UI**: impacto y riesgo de regresión.

La conexión completa sería esta:

```text
Construcción multimodelo del corpus
            ↓
versiones React+TS controladas
            ↓
grafo previo Gt
            ↓
solicitud qt
            ↓
───────────┬────────────
           │
           │
           ▼
   ETIQUETA DE IMPACTO
   desde parche correcto
           │
           │
           ▼
     MODELO DE IMPACTO

y paralelamente:

versión correcta + qt
        ↓
      π0 fijo
        ↓
ediciones reales del agente
        ↓
oráculo independiente
        ↓
qué requisitos anteriores fallaron
        ↓
 ETIQUETAS DE RIESGO
        ↓
 MODELO DE RIESGO
```

## 1. Para el predictor de impacto

Supongamos que tenemos:

```text
V1
+
solicitud:
"Agregar paginación de 10 productos"
```

Antes del cambio extraemos el grafo:

```text
ProductCatalog
├── query
├── category
├── filteredProducts
├── ProductTable
└── ProductRow
```

Después uno de nuestros modelos genera la **solución de referencia correcta**:

```text
V1 → V2-reference
```

Y del parche podemos observar qué elementos realmente tuvieron que cambiar.

Por ejemplo:

```text
ProductCatalog       → 1
filteredProducts     → 1
ProductTable         → 1
CategoryFilter       → 0
SearchInput          → 0

creación:
currentPage
paginatedProducts
Pagination
```

Ese parche nos proporciona el **ground truth de impacto**.

Entonces cada muestra de entrenamiento podrá parecerse conceptualmente a:

\[
(G_t,q_t) \rightarrow y_{impact}
\]

donde:

- \(G_t\) = grafo de componentes y estado antes del cambio;
- \(q_t\) = solicitud textual;
- \(y_{impact}\) = entidades que realmente fue necesario modificar/crear/eliminar.

Eso está directamente alineado con el diseño actual de tu plan: las etiquetas de impacto se obtienen mapeando el parche de referencia contra las entidades de la versión previa. fileciteturn1file0L602-L606

---

# 2. Para el predictor de riesgo

Aquí está la parte más interesante.

Tenemos una versión correcta:

```text
V2
```

con requisitos:

```text
R001 búsqueda
R002 filtro
R003 ordenamiento
R004 paginación
```

Ahora llega:

```text
T3:
"Permitir seleccionar un producto y
mantener la selección al ordenar"
```

Le damos esa tarea a nuestro agente de referencia:

```text
π0
```

El agente modifica el proyecto como lo haría un desarrollador actual:

```text
código
+
sus propios tests
```

y entrega su solución.

Luego **nosotros ejecutamos el oráculo independiente**.

Supongamos:

```text
R001 ✅
R002 ✅
R003 ❌
R004 ✅
R005 ✅
```

Entonces tenemos una observación real:

```text
R003 → regresión
```

y generamos:

```text
risk(R003) = 1
```

mientras:

```text
risk(R001) = 0
risk(R002) = 0
risk(R004) = 0
```

Así cada ejemplo para el segundo modelo sería aproximadamente:

\[
(G_t,q_t,R_i) \rightarrow y_{risk}
\]

con:

\[
y_{risk}\in\{0,1\}
\]

Tu plan ya define precisamente que un requisito elegible es aquel que antes estaba vigente y pasando, y que recibe etiqueta positiva cuando deja de cumplirse después de la edición. fileciteturn1file0L607-L612

---

# 3. ¿Por qué necesitamos las soluciones de referencia?

Porque necesitamos separar dos preguntas distintas:

> **¿Qué debería haberse tocado?**

de:

> **¿Qué terminó rompiendo el agente?**

La solución de referencia responde la primera.

π0 responde la segunda.

Ejemplo:

```text
Solicitud
"Agregar selección"
```

Solución correcta:

```text
debería modificar:
Table
Row
selection state
```

Eso genera impacto.

Pero π0 hace:

```text
usa array index como ID
```

y después de ordenar:

```text
selecciona otra fila
```

Eso genera riesgo/regresión.

Son dos targets diferentes.

---

# 4. La construcción multimodelo ayuda a evitar que el predictor aprenda “el estilo de ChatGPT”

Este es uno de los beneficios más importantes de la decisión de tu docente.

Si ChatGPT generara todas las aplicaciones, podríamos terminar con patrones recurrentes como:

```text
src/components/
src/types/
src/data/
```

o determinado estilo de:

```ts
const [items, setItems] = useState(...)
```

Entonces el predictor podría aprender accidentalmente regularidades propias de un generador.

Al utilizar:

```text
ChatGPT
Claude
Gemini
Local A
Local B
```

obtenemos variación en:

```text
descomposición de componentes
nombres
estructura de archivos
manejo de estado
helpers
funciones
hooks
forma de pasar props
forma de calcular estado derivado
```

Pero todos continúan satisfaciendo los mismos requisitos funcionales.

Así obligamos al futuro modelo a prestar más atención a:

```text
estructura
+
dependencias
+
solicitud
```

y menos a características estilísticas superficiales.

---

# 5. La rotación de modelos evita una confusión peligrosa

Supongamos que hiciéramos:

```text
catálogos → ChatGPT
formularios → Claude
tablas → Gemini
```

El predictor podría aprender indirectamente:

```text
"cuando el código parece Claude,
es probablemente un formulario"
```

Eso sería contaminación del dataset.

La rotación:

```text
V0 → ChatGPT
T1 → Claude
T2 → Gemini
T3 → Local
```

distribuida entre familias ayuda a romper esa correlación.

---

# 6. La diversidad de arquitecturas mejora la generalización

También por eso decidimos variar:

```text
useState centralizado
useReducer
estado distribuido
estado derivado
useEffect
localStorage
```

El grafo de EvoGuard debe funcionar con relaciones como:

```text
component → component
component → prop
component → state
handler → state update
effect → dependency
derived state → source state
```

Si las diez aplicaciones fueran:

```text
App
 ↓
List
 ↓
Item
```

el modelo podría rendir muy bien en nuestro dataset y fallar al salir de él.

La diversidad estructural es la que hará que el aprendizaje tenga sentido.

Tu extractor ya está planteado precisamente alrededor de nodos como componentes, funciones, props, estados y efectos, y aristas de renderizado, paso de props, lectura/escritura, llamadas y dependencias de efectos. fileciteturn1file0L625-L639

---

# 7. Los dos requisitos iniciales + tres turnos producen contexto histórico

Esto también es importante.

No queremos entrenar únicamente:

```text
aplicación vacía
→
agregar función
```

Queremos:

```text
V0
R1 R2

↓ T1

V1
R1 R2 R3

↓ T2

V2
R1 R2 R3 R4

↓ T3

V3
R1 R2 R3 R4 R5
```

Cuanto más avanza el episodio, más oportunidades aparecen de interacción.

Por ejemplo:

```text
T1 introduce sort
T2 introduce pagination
T3 introduce selection
```

El riesgo de T3 puede depender de algo introducido dos turnos antes.

Eso es exactamente el fenómeno de **evolución funcional** que la tesis quiere modelar.

---

# 8. Los oráculos independientes hacen confiables las etiquetas

Sin ellos tendríamos un problema grave.

Si el mismo agente:

```text
implementa
+
decide sus tests
```

podría producir:

```text
código incorrecto
+
test incorrecto
=
PASS
```

Para entrenar un predictor eso sería terrible porque terminaríamos poniendo:

```text
risk = 0
```

a un caso que realmente sí rompió un requisito.

El oráculo independiente evita esa contaminación.

Por eso no es solamente una decisión de evaluación: es una decisión de **calidad de las etiquetas del machine learning**.

---

# 9. Los tres intentos también tienen una función estadística

No solo buscan realismo.

Si dejáramos que un agente repare indefinidamente:

```text
intento 1
intento 2
...
intento 17
PASS
```

prácticamente desaparecerían muchas regresiones.

Nuestro target dejaría de representar:

> riesgo al implementar un cambio

y se acercaría a:

> riesgo después de darle tiempo ilimitado para corregirse.

Al congelar:

```text
máximo 3 intentos
```

definimos una política reproducible.

Eso permite interpretar las etiquetas correctamente.

---

# 10. Mantener π0 fijo es fundamental al principio

Este punto es especialmente importante.

Supongamos:

```text
ChatGPT rompe R3 10%
Claude rompe R3 30%
Local A rompe R3 60%
```

Si mezclamos todos sin controlar el modelo, entonces:

```text
risk(R3)
```

mezclaría:

```text
riesgo estructural
+
capacidad del agente
```

Por eso inicialmente usamos:

```text
π0 fijo
```

Así la variable que queremos aprender es aproximadamente:

\[
P(\text{regresión}\mid G_t,q_t,R_i,\pi_0)
\]

con π0 constante.

Eso hace el problema mucho más limpio.

Después de demostrarlo, una futura extensión podría modelar:

\[
P(\text{regresión}\mid G_t,q_t,R_i,\pi)
\]

donde el agente también sea entrada.

Pero eso ya sería una investigación adicional.

---

# 11. Las repeticiones permiten pasar de una etiqueta binaria a una señal de riesgo

Supongamos que ejecutamos π0 tres veces en el corpus definitivo.

Para R003:

```text
run1 → falla
run2 → pasa
run3 → falla
```

Tenemos:

```text
1
0
1
```

La frecuencia observada sería:

\[
\hat p=\frac{2}{3}
\]

No debemos interpretarla como una probabilidad perfecta —tu plan ya la trata como una estimación ruidosa—, pero proporciona más información que un único resultado.

Podremos entrenar/evaluar el modelo mediante métricas como:

```text
Average Precision
Brier Score
```

que ya contempla el plan. fileciteturn1file0L523-L536

---

# 12. Los splits por familia evitan una fuga enorme

Esto será fundamental cuando pasemos del corpus piloto al definitivo.

No podemos hacer:

```text
F001-T1 → train
F001-T2 → validation
F001-T3 → test
```

porque el modelo ya habría visto prácticamente la misma aplicación.

Debemos hacer:

```text
F001 completa → train

F002 completa → train

...

F051 completa → test
```

Tu plan ya establece que todas las variantes de una misma familia deben permanecer en una única partición. fileciteturn1file0L423-L434

Eso permitirá afirmar que el modelo funciona en **familias no vistas**, no simplemente en futuros commits de aplicaciones conocidas.

---

# 13. Qué dataset terminaríamos teniendo

Conceptualmente tendremos una tabla de transiciones:

```text
family
episode
turn
previous_commit
request
graph
active_requirements
reference_patch
impact_labels
π0_run
regression_labels
generator_model
editor_model
metadata
```

Pero para entrenar probablemente derivaremos dos datasets.

### Dataset A — Impacto

Una fila por:

```text
turno × entidad del grafo
```

Ejemplo:

```text
F001 T02 ProductCatalog    impact=1
F001 T02 SearchInput       impact=0
F001 T02 ProductTable      impact=1
...
```

### Dataset B — Riesgo

Una fila por:

```text
turno × requisito previamente activo × ejecución
```

Ejemplo:

```text
F001 T03 R001 run1 risk=0
F001 T03 R002 run1 risk=0
F001 T03 R003 run1 risk=1

F001 T03 R001 run2 risk=0
...
```

O podemos agregar ejecuciones para obtener una frecuencia por requisito.

---

# 14. Y finalmente llegamos a EvoGuard

En inferencia tendríamos:

```text
Una aplicación que nunca vimos
          +
una solicitud nueva
          ↓
 extractor TS/TSX
          ↓
        grafo
          ↓
 ┌────────┴────────┐
 ▼                 ▼
Impact Model    Risk Model
 ▼                 ▼
componentes      requisitos
probablemente    probablemente
afectados        vulnerables
```

Por ejemplo:

```text
Solicitud:
"Agregar ordenamiento por precio"

IMPACTO

ProductCatalog      0.93
ProductTable        0.89
ProductRow          0.62
SearchInput         0.08

RIESGO

R001 búsqueda       0.18
R002 filtro         0.72
R003 selección      0.84
```

Entonces EvoGuard podría decirle al agente:

```text
Inspecciona especialmente:
- ProductTable
- ProductRow

Preserva especialmente:
- R002 filtrado
- R003 selección
```

Y esa información constituye los brazos:

```text
G → impacto

E → impacto + riesgo
```

que después compararemos contra el baseline textual.

---

## En resumen

Cada decisión metodológica que acabamos de cerrar tiene una función directa en el futuro modelo:

| Decisión | Qué protege/mejora |
|---|---|
| Generación multimodelo | diversidad de código |
| Rotación de modelos | evita sesgo modelo↔tipo de app |
| Arquitecturas distintas | generalización estructural |
| Requisitos controlados | ground truth funcional |
| Soluciones de referencia | etiquetas de impacto |
| π0 fijo | target de riesgo consistente |
| Oráculo independiente | etiquetas fiables |
| Máximo 3 intentos | política reproducible |
| Fixtures deterministas | repetibilidad |
| Familias independientes | generalización |
| Split por familia | evita data leakage |
| Congelamiento | evita modificar benchmark según resultados |

Por eso esta parte de la tesis no es simplemente “preparar datos”. **Estamos diseñando el mecanismo que define exactamente qué aprenderá el modelo.** Si ese mecanismo estuviera mal planteado, después podríamos construir una red neuronal sofisticada pero entrenarla sobre etiquetas contaminadas o un problema mal definido.

Con lo acordado hasta ahora, la transición **corpus → grafo → etiquetas → entrenamiento → EvoGuard** queda metodológicamente bastante coherente.

## Mensaje 5562f32d-e131-4c6f-98be-eab79398dc53
Procedamos con el siguiente bloque

Sí. Este es el último bloque metodológico grande antes de diseñar F001–F010. Conviene cerrarlo con bastante precisión porque aquí definimos **qué significa exactamente “un agente intenta resolver un cambio”**.

Para mantener el enfoque que acabamos de establecer —simular razonablemente el trabajo cotidiano de un programador asistido por IA, pero conservar control experimental— te propongo estas decisiones. En cada punto pongo mi recomendación; puedes responder `1A, 2A...` o corregir directamente lo que quieras.

| # | Decisión | Opciones / recomendación |
|---|---|---|
| **1** | **Acceso al repositorio** | **A — Recomendado:** el agente tiene acceso a todo el repositorio de la familia en su versión actual, no solo a archivos preseleccionados. Puede explorar libremente el código como lo haría un desarrollador. B: entregarle solo archivos seleccionados. |
| **2** | **Información funcional entregada** | **A — Recomendado:** código actual + solicitud del turno + catálogo completo de requisitos actualmente vigentes. Así sabe qué comportamiento debe preservar. B: solo código + solicitud actual. |
| **3** | **Historial Git** | **A — Recomendado:** puede consultar `git log`, `git diff`, commits anteriores pertenecientes a la evolución ya ocurrida, pero nunca ramas/versiones futuras ni soluciones de referencia futuras. B: solo snapshot actual sin historia. |
| **4** | **Tests visibles** | **A — Recomendado:** puede leer, modificar, crear y ejecutar las pruebas de desarrollo del repositorio. Esto incluye las generadas por modelos anteriores. |
| **5** | **Oráculo independiente** | **A — Recomendado:** permanece completamente fuera del workspace del agente. Se ejecuta solamente por el evaluador. Si falla, el agente no recibe casos, stack traces ni código del oráculo. El fallo se registra. |
| **6** | **Qué ocurre si el agente pasa sus tests pero falla el oráculo independiente** | **A — Recomendado:** esa salida se considera inválida y ese modelo falla esa tarea; no se le permite ajustar el código contra el oráculo. Se aplica la política de reasignación. B: decirle genéricamente “falló validación” y darle otra oportunidad. Recomiendo A porque protege mucho mejor el ground truth. |
| **7** | **Terminal y herramientas locales** | **A — Recomendado:** acceso a terminal, lectura/escritura/búsqueda de archivos, `npm`, build, TypeScript, tests, lint, Playwright y navegador local. Esto reproduce bastante bien un coding agent moderno. |
| **8** | **Git como herramienta** | **A — Recomendado:** permitir `status`, `diff`, `log`, `show`, etc., pero el agente no necesita crear commits. El pipeline experimental crea automáticamente los commits finales para mantener consistencia. |
| **9** | **Navegador** | **A — Recomendado:** puede abrir y manipular la aplicación en `localhost`, incluyendo Playwright/devtools automatizados. B: sin navegador. |
| **10** | **Internet externa durante la tarea** | **A — Recomendado:** no permitir navegación web externa durante el experimento principal. Así ChatGPT, Claude, Gemini y los locales reciben capacidades instrumentales comparables. Puede existir posteriormente un experimento complementario con web. B: permitir búsquedas en Internet. |
| **11** | **Dependencias npm nuevas** | **A — Recomendado:** dependencias congeladas. El agente puede ejecutar `npm install`/`npm ci` sobre el lockfile, pero no añadir paquetes nuevos salvo que la solicitud explícitamente lo requiera. En el piloto probablemente ninguna los requerirá. B: libertad total para instalar paquetes. |
| **12** | **Estado de una reparación** | **A — Recomendado:** intento 2 e intento 3 continúan sobre el código producido en el intento anterior; no empiezan desde cero. Es equivalente a un desarrollador corrigiendo su implementación. |
| **13** | **Reasignación a otro modelo después de 3 fallos** | **A — Recomendado:** el nuevo modelo empieza desde la versión correcta **anterior al turno**, no desde el parche fallido del modelo precedente. El fracaso anterior queda almacenado aparte. B: heredar el código fallido. |
| **14** | **Límite por intento** | Propongo no limitar por tokens idénticos porque los proveedores contabilizan y razonan de manera diferente. **A — Recomendado:** mismo máximo de ciclos agente↔herramientas y un timeout amplio únicamente de seguridad. Sugiero inicialmente **25 ciclos de agente por intento**, recalibrables con el piloto. |
| **15** | **Timeout** | **A — Recomendado:** no utilizar el tiempo real como criterio principal de igualdad porque perjudicaría artificialmente a los modelos locales. Usar un hard timeout de seguridad, por ejemplo 30 min para API y 60 min para local, registrando la duración real. B: mismo timeout estricto para todos. |
| **16** | **Costo máximo** | **A — Recomendado:** registrar el costo pero no introducir todavía un corte monetario por tarea; primero medimos el piloto y después fijamos presupuesto definitivo. |
| **17** | **Plantilla tecnológica común** | **A — Recomendado:** nosotros proporcionamos un scaffold mínimo React+TS+Vite con dependencias congeladas. Los modelos construyen la aplicación encima. Compartir configuración de Vite/TS/Vitest no convierte las apps en una misma familia; lo importante será que no compartan implementación funcional sustantiva. |
| **18** | **Versiones concretas del stack** | **A — Recomendado:** usar versiones estables vigentes al iniciar la generación real y congelar las versiones exactas en el lockfile y manifiesto, en vez de fijarlas hoy antes de ejecutar el piloto. |
| **19** | **Sistema de ejecución** | **A — Recomendado:** Linux mediante Docker/contenedor reproducible. Las mismas imágenes base para modelos API y locales; únicamente el runtime de inferencia local queda fuera cuando corresponda. |
| **20** | **Lint/formatting** | **A — Recomendado:** TypeScript/build son obligatorios; lint puede formar parte de validación técnica pero no debe invalidar una solución únicamente por estilo si el comportamiento es correcto. Formatter tampoco forma parte del ground truth. |
| **21** | **Estabilidad del oráculo** | **A — Recomendado:** antes de congelar una familia, ejecutar cada oráculo **5 veces** sobre las versiones de referencia desde un entorno limpio. Si cualquiera presenta resultados inconsistentes, la familia no puede congelarse hasta corregir el problema. |
| **22** | **Criterio mínimo para declarar una versión correcta** | **A — Recomendado:** build/typecheck correcto + todos los requisitos activos pasan el oráculo independiente + datos reproducibles + ausencia de servicios externos no permitidos + restricciones arquitectónicas cumplidas. |
| **23** | **Criterio para declarar una familia `FROZEN`** | **A — Recomendado:** V0–V3 validados; oráculos estables; requisitos y solicitudes congelados; procedencia/modelos/prompts registrados; commits y patches almacenados; fixtures deterministas; sin correcciones funcionales humanas; auditoría estructural aprobada. |
| **24** | **Qué hacer si encontramos un error después de `FROZEN`** | **A — Recomendado:** nunca sobrescribir. Crear una nueva revisión (`F001-r2` o versión del corpus), documentar la causa y excluir la versión defectuosa de futuras evaluaciones. |
| **25** | **Control de pseudo-replicación entre familias** | **A — Recomendado:** tres controles: procedencia independiente + perfil estructural de cada familia + análisis automático de similitud. El análisis cuantitativo sirve para marcar casos a revisión, no para decidir por sí solo. |
| **26** | **Familias creadas con el mismo scaffold** | **A — Recomendado:** no considerarlas relacionadas únicamente por `package.json`, Vite, configs, helpers de testing o boilerplate común. La similitud se calculará principalmente sobre código funcional propio. |
| **27** | **Si dos familias terminan siendo demasiado parecidas** | **A — Recomendado:** no intentar diferenciarlas cosméticamente. Una se rediseña antes de congelarla o ambas se consideran una sola familia. |
| **28** | **Auditoría humana antes de congelar** | **A — Recomendado:** revisar el 100 % de las 10 familias del piloto. En el corpus definitivo podremos utilizar el muestreo de auditoría previsto en la metodología. |

Hay tres decisiones de esta tabla que considero particularmente importantes para conservar el realismo que buscas.

**Acceso completo al repositorio.** No le daría al agente solo `ProductTable.tsx` porque eso favorecería artificialmente a EvoGuard: un desarrollador actual con Cursor, Claude Code, Codex o herramientas similares normalmente puede explorar el proyecto. Por eso el baseline textual debería tener el repositorio completo y decidir por sí mismo qué inspeccionar.

**Herramientas reales, pero sin Internet externa.** Le permitiría terminal, búsqueda, tests, build, browser local y Playwright. Eso hace que la tarea sea genuinamente agentic. Lo único que restringiría en el experimento principal sería Internet, porque no podríamos garantizar equivalencia entre un modelo local, ChatGPT, Gemini y Claude si unos tienen navegadores/repositorios externos y otros no.

**El oráculo independiente nunca entra en el ciclo de desarrollo.** El agente trabaja exactamente como proponías: implementa, crea tests y los ejecuta. Cuando dice que terminó, nuestro sistema ejecuta independientemente la validación. Si descubre que el agente escribió tests insuficientes, justamente eso cuenta como una solución incorrecta. Es esencial porque después ese mismo resultado determinará si existió una regresión.

También haría una pequeña precisión respecto a los **3 intentos** que ya cerramos. Los definiría como tres ciclos de entrega:

```text
VERSIÓN PREVIA CORRECTA
        │
        ▼
   Intento 1
código + tests del agente
        │
  build/tests visibles
        │
        ├── falla → feedback → Intento 2
        │
        ├── falla → feedback → Intento 3
        │
        └── termina
               │
               ▼
      ORÁCULO INDEPENDIENTE
               │
        ┌──────┴──────┐
       PASS           FAIL
        │              │
   referencia      fallo registrado
                         │
                         ▼
                  reasignar modelo
```

Es decir, **el oráculo no es un cuarto test que usamos para ayudarle a depurar**. Es quien finalmente juzga la entrega.

Si aceptas las opciones recomendadas, prácticamente podemos responder `A en todos`, salvo que quieras cambiar los puntos **6, 10, 11, 14, 15 o 21**, que son donde hay alternativas metodológicas reales. Con esto quedaría cerrado el protocolo general y el siguiente paso ya sería diseñar formalmente las **10 familias F001–F010**.
