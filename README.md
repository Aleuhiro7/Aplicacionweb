# David Orihuela Coach · Gestión de clientes

Aplicación web para gestionar los clientes de asesoría online: cuotas mensuales, progreso físico y cobros.

## Funcionalidades

- **Resumen**: cobrado en el mes frente a lo previsto, lo que falta por cobrar (y lo vencido), clientes activos y en pausa, altas del mes, gráfico de ingresos de los últimos 6 meses, **próximos pagos** (vencidos o que vencen en los próximos 5 días).
- **Clientes**: ficha con contacto, importe habitual, fecha del próximo pago, lesiones/patologías (destacadas en un aviso) y notas. Estados activo / en pausa / baja, búsqueda y accesos directos a WhatsApp y email.
- **Progreso**: registra el peso en cada revisión; gráfico de evolución y cambio respecto a la revisión anterior y al inicio.
- **Pagos**: los pagos caen el mismo día del mes que la fecha de alta de cada cliente. Lista de clientes con un botón **Pago** que abre un desplegable para indicar la cantidad y cuántos meses paga (1, 2, 3 o 6); la fecha del siguiente pago se calcula sola. La app avisa 5 días antes en el resumen y, si se activan, con notificaciones del navegador. Se puede deshacer un pago guardado por error.
- **Seguimientos y revisiones**: desde la fecha de alta del cliente, a los 15 días toca un **seguimiento** y al mes una **revisión mensual**, y así cada mes. Dos días antes aparece en el panel: el nombre abre directamente su chat de WhatsApp y la casilla lo marca como hecho.
- **Rutina**: rutina de entrenamiento de cada cliente organizada por días, con ejercicios (series, repeticiones, carga, descanso y notas) que se pueden añadir, editar, reordenar y borrar. Se envía al cliente por WhatsApp ya formateada o se copia como texto.
- **Dieta**: de momento, un texto libre con el plan de alimentación de cada cliente (se ampliará más adelante).
- **Sin rutina / Sin dieta**: dos avisos en el panel con los clientes activos sin rutina (o con la rutina sin ejercicios) y sin dieta, con un botón para ir directamente a crearla.
- **Cuestionario**: preguntas básicas para conocer al cliente (objetivo, salud, experiencia, disponibilidad, hábitos…). Desde su ficha se le envía por WhatsApp un **enlace** a un formulario (`cuestionario.html`) que rellena desde el móvil sin registrarse; sus respuestas llegan solas a su ficha y aparecen en el panel («Cuestionarios respondidos») hasta que se marcan como revisadas. También se pueden enviar las preguntas como texto y apuntar las respuestas a mano. Las preguntas se editan en Ajustes. Requiere la regla de `firestore.rules` en Firebase.
- **Fotos**: fotos de progreso de cada cliente (desde la galería o la cámara), agrupadas por fecha, con visor, descarga y borrado. Se comprimen y se guardan en el navegador; con la sesión de Google iniciada se suben también a la nube, cada una aparte.
- **Tareas pendientes**: anotaciones por cliente con fecha límite opcional; las pendientes salen también en el panel principal y se marcan como hechas con un toque.
- **Biblioteca de ejercicios**: catálogo de ejercicios por grupo muscular y patrón, con material, series, repeticiones, descanso, tempo, notas y enlace a vídeo, más las pautas de cada grupo. Búsqueda (sin importar tildes) y filtro por grupo. Los ejercicios de los PDF no se pueden editar (los añadidos a mano sí); los cambios hechos a un ejercicio dentro de una rutina solo afectan a esa rutina. Al añadir un ejercicio de la biblioteca a una rutina, se rellenan solas sus series, repeticiones, descanso y notas. Los ejercicios de serie están en `js/library-data.js`.
- **Biblioteca de alimentos**: alimentos por categoría con cantidad de referencia, calorías, proteínas, carbohidratos y grasas. Búsqueda y filtro por categoría; se pueden añadir a mano. Incluye 230 alimentos básicos (carnes y pescados en crudo y cocinados) para una dieta sana (sin alcohol ni ultraprocesados) con valores medios por 100 g (tablas BEDCA/USDA, contrastadas con el etiquetado de marca blanca en España), en `js/foods-data.js`; no se pueden editar.
- **Ajustes**: tu nombre, moneda, cuota por defecto, tema oscuro/claro, exportar/importar copia de seguridad (JSON) y exportar clientes a CSV (Excel).

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
