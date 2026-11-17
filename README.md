# David Orihuela Entrenador Online · Gestión de clientes

Aplicación web para gestionar los clientes de asesoría online: cuotas mensuales, progreso físico y cobros.

Identidad: logo del hexágono con «DO» (la D como botón de play), en degradado azul eléctrico → cian → menta («Glaciar») sobre fondo pizarra, y solo esos tonos en toda la app; tipografías Anton, Barlow Condensed y Archivo, y el lema «Lo simple funciona.» (app, cuestionario, PDF de la dieta, icono y vista previa de WhatsApp).

## Funcionalidades

- **Resumen**: cobrado en el mes frente a lo previsto, lo que falta por cobrar (y lo vencido), clientes activos y en pausa, altas del mes, gráfico de ingresos de los últimos 6 meses, **próximos pagos** (vencidos o que vencen en los próximos 5 días).
- **Clientes**: ficha con contacto, importe habitual, fecha del próximo pago, lesiones/patologías (destacadas en un aviso) y notas. Estados activo / en pausa / baja, búsqueda y accesos directos a WhatsApp y email.
- **Progreso**: registra el peso en cada revisión; gráfico de evolución y cambio respecto a la revisión anterior y al inicio.
- **Pagos**: los pagos caen el mismo día del mes que la fecha de alta de cada cliente. Lista de clientes con un botón **Pago** que abre un desplegable para indicar la cantidad y cuántos meses paga (1, 2, 3 o 6); la fecha del siguiente pago se calcula sola. La app avisa 5 días antes en el resumen y, si se activan, con notificaciones del navegador. Se puede deshacer un pago guardado por error.
- **Seguimientos y revisiones**: desde la fecha de alta del cliente, a los 15 días toca un **seguimiento** y al mes una **revisión mensual**, y así cada mes. Dos días antes aparece en el panel: el nombre abre directamente su chat de WhatsApp y la casilla lo marca como hecho.
- **Rutina**: rutina de entrenamiento de cada cliente organizada por días, con ejercicios (series, repeticiones, carga, descanso y notas) que se pueden añadir, editar, reordenar y borrar. Se envía al cliente por WhatsApp ya formateada o se copia como texto.
- **Dieta**: objetivo de calorías y reparto de macronutrientes (gramos, kcal, % y g/kg) con gráfico circular. Después se elige el número de comidas (3 a 7, con nombre editable) y en cada una se añaden alimentos de los bloques de equivalencia; la app reparte el objetivo del día entre las comidas y calcula los gramos de cada alimento para cuadrarlo. Los alimentos del mismo tipo (proteína, hidratos o grasa) son **opciones** equivalentes, no se suman: la primera cuadra los macros de la comida y las demás llevan los gramos que dan **las mismas calorías** (o, si se prefiere, el mismo macronutriente: se cambia con el selector «Equivalencias por», también en los bloques). La proteína en polvo (suero, isolate) nunca entra en las equivalencias: va aparte como «Añadido» (30 g por defecto, editable) y se descuenta de lo que cubren los demás alimentos. Las cantidades se redondean de 10 en 10 g (proteínas e hidratos) y de 5 en 5 g (grasas). Las cantidades que se cambian a mano quedan fijadas (candado) y el resto se reajusta. En cada comida se puede marcar «Verdura libre» (hasta 150 g de cualquier verdura). Resumen del día con barras de progreso e indicaciones en texto libre. Todo está en una sola ficha. En los objetivos se indica la actividad y las calorías de mantenimiento (se estiman con Mifflin-St Jeor a partir del peso, altura, edad y sexo de la ficha) y la app muestra el déficit o superávit. Hay un apartado de suplementación (una línea por suplemento). Al final se descarga en PDF con diseño para mandárselo al cliente: portada, «Tu plan» (calorías, mantenimiento, déficit y tabla de macros), una página por comida con cantidades, opciones y verdura libre, cada alimento crudo con su peso aproximado ya cocinado, el plato saludable para improvisar (½ proteína, ¼ verdura, ¼ hidrato), agua y suplementación, e indicaciones o se copia como texto, y un botón elimina toda la dieta (se puede deshacer).
- **Sin rutina / Sin dieta**: dos avisos en el panel con los clientes activos sin rutina (o con la rutina sin ejercicios) y sin dieta, con un botón para ir directamente a crearla.
- **Cuestionario**: preguntas básicas para conocer al cliente (objetivo, salud, experiencia, disponibilidad, hábitos…). Desde su ficha se le envía por WhatsApp un **enlace** a un formulario (`cuestionario.html`) que rellena desde el móvil sin registrarse; sus respuestas llegan solas a su ficha y aparecen en el panel («Cuestionarios respondidos») hasta que se marcan como revisadas. También se pueden enviar las preguntas como texto y apuntar las respuestas a mano. Las preguntas se editan en Ajustes. Requiere la regla de `firestore.rules` en Firebase.
- **Formularios** (menú principal): al pulsar «Cuestionario inicial» o «Enviar por WhatsApp» se abre WhatsApp con el enlace del cuestionario ya escrito para elegir a quién mandárselo, aunque todavía no sea cliente (también se puede indicar antes su nombre y teléfono, o copiar el enlace). El formulario pide primero su nombre y teléfono. Las respuestas llegan a Formularios y al panel; con «Crear cliente» se da de alta con sus respuestas ya en la ficha.
- **Fotos**: fotos de progreso de cada cliente (desde la galería o la cámara), agrupadas por fecha, con visor, descarga y borrado. Se comprimen y se guardan en el navegador; con la sesión de Google iniciada se suben también a la nube, cada una aparte.
- **Tareas pendientes**: anotaciones por cliente con fecha límite opcional; las pendientes salen también en el panel principal y se marcan como hechas con un toque.
- **Biblioteca de ejercicios**: catálogo de ejercicios por grupo muscular y patrón, con material, series, repeticiones, descanso, tempo, notas y enlace a vídeo, más las pautas de cada grupo. Búsqueda (sin importar tildes) y filtro por grupo. Los ejercicios de los PDF no se pueden editar (los añadidos a mano sí); los cambios hechos a un ejercicio dentro de una rutina solo afectan a esa rutina. Al añadir un ejercicio de la biblioteca a una rutina, se rellenan solas sus series, repeticiones, descanso y notas. Incluye 208 ejercicios de serie: bíceps y tríceps de los PDF y un catálogo de musculación (mancuernas, barra, máquinas de discos, máquinas guiadas y poleas) para pecho, espalda, hombros, cuádriceps, isquiotibiales, glúteos, aductores, gemelos, abdomen y antebrazo, agrupados por patrón o énfasis con sus pautas. Están en `js/library-data.js`. Cada ejercicio lleva una **ilustración 3D** (figura anatómica gris, sin fotos de personas) en posición inicial y final con su máquina o material, y los **músculos que trabaja** marcados (rojo = principales, naranja = secundarios) con un mapa muscular de frente y de espaldas. Se dibuja en el propio navegador con three.js (`js/vendor/three.min.js`, licencia MIT) a partir de las plantillas de movimiento de `js/avatars.js` y los músculos de `js/muscles.js`; si el dispositivo no tiene WebGL se muestra un muñeco animado. Los ejercicios añadidos a mano toman la ilustración del más parecido por nombre o la que se elija.
- **Biblioteca de alimentos**: alimentos por categoría con cantidad de referencia, calorías, proteínas, carbohidratos y grasas. Búsqueda y filtro por categoría; se pueden añadir a mano. Incluye 197 alimentos básicos (sin verduras) (carnes y pescados en crudo y cocinados) para una dieta sana (sin alcohol ni ultraprocesados) con valores medios por 100 g (tablas BEDCA/USDA, contrastadas con el etiquetado de marca blanca en España), en `js/foods-data.js`; no se pueden editar.
- **Bloques de equivalencia** (dentro de la biblioteca de alimentos): grupos de alimentos parecidos en macros y calorías (carnes magras, embutidos y fiambres, pescado blanco, huevos, lácteos con menos y con más grasa, quesos curados y en lonchas (cuentan como grasa), proteína en polvo, cereales, fruta, frutos secos…). Cada bloque tiene una cantidad de referencia (p. ej. 25 g de proteína) y la app calcula cuántos gramos de cada alimento la aportan. Se pueden editar y crear bloques nuevos.
- **Ajustes**: tu nombre, moneda, cuota por defecto, tema oscuro/claro, exportar/importar copia de seguridad (JSON) y exportar clientes a CSV (Excel).

- **Vista previa en WhatsApp**: al enviar el enlace del cuestionario, WhatsApp muestra una tarjeta negra con el degradado de la marca, tu logo, «Cuestionario inicial» y el lema (`img/og-cuestionario.jpg`, etiquetas Open Graph de `cuestionario.html`). La dirección de la imagen apunta a `https://aleuhiro7.github.io/Aplicacionweb/`; si publicas la app en otra dirección, cámbiala allí.

## Cómo usarla

No necesita instalación ni servidor: abre `index.html` en el navegador.

Para probarla rápido, pulsa **«Cargar datos de ejemplo»** en el panel o en Ajustes.

### Publicarla en Internet (gratis) con GitHub Pages

1. En GitHub: *Settings → Pages*.
2. En *Source* elige *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`.
3. En un minuto estará disponible en `https://<tu-usuario>.github.io/Aplicacionweb/`. Desde el móvil puedes «Añadir a pantalla de inicio».

## Tus datos

Los datos se guardan **en el navegador del dispositivo** (`localStorage`); no se envían a ningún servidor. Por eso:

- Cada dispositivo/navegador tiene sus propios datos. Para pasarlos de uno a otro, usa *Exportar copia* e *Importar copia*.
- Si borras los datos de navegación, se pierden. **Exporta una copia de seguridad con regularidad.**

## Estructura

```
index.html        Estructura de la página y navegación
css/styles.css    Estilos (adaptados a móvil, tema claro y oscuro)
js/utils.js       Fechas, formato de moneda, utilidades
js/store.js       Almacenamiento y cálculos (bonos, pendientes, ingresos)
js/ui.js          Formularios modales, confirmaciones, avisos y gráficos
js/views.js       Pantallas y acciones
js/app.js         Arranque y navegación
```

HTML, CSS y JavaScript puro, sin dependencias ni compilación.
