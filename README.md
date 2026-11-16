# David Orihuela Coach · Gestión de clientes

Aplicación web para gestionar los clientes de asesoría online: cuotas mensuales, progreso físico y cobros.

## Funcionalidades

- **Resumen**: cobrado en el mes frente a lo previsto, lo que falta por cobrar (y lo vencido), clientes activos y en pausa, altas del mes, gráfico de ingresos de los últimos 6 meses, **próximos pagos** (vencidos o que vencen en los próximos 5 días) y clientes sin actualizar su peso.
- **Clientes**: ficha con contacto, importe habitual, fecha del próximo pago, lesiones/patologías (destacadas en un aviso) y notas. Estados activo / en pausa / baja, búsqueda y accesos directos a WhatsApp y email.
- **Progreso**: registra el peso en cada revisión; gráfico de evolución y cambio respecto a la revisión anterior y al inicio.
- **Pagos**: los pagos caen el mismo día del mes que la fecha de alta de cada cliente. Lista de clientes con un botón **Pago** que abre un desplegable para indicar la cantidad y cuántos meses paga (1, 2, 3 o 6); la fecha del siguiente pago se calcula sola. La app avisa 5 días antes en el resumen, en la campana y, si se activan, con notificaciones del navegador. Se puede deshacer un pago guardado por error.
- **Seguimientos y revisiones**: desde la fecha de alta del cliente, a los 15 días toca un **seguimiento** y al mes una **revisión mensual**, y así cada mes. Dos días antes aparece en el panel: el nombre abre directamente su chat de WhatsApp y la casilla lo marca como hecho.
- **Fotos**: fotos de progreso de cada cliente (desde la galería o la cámara), agrupadas por fecha, con visor, descarga y borrado. Se comprimen y se guardan en el navegador; con la sesión de Google iniciada se suben también a la nube, cada una aparte.
- **Tareas pendientes**: anotaciones por cliente con fecha límite opcional; las pendientes salen también en el panel principal y se marcan como hechas con un toque.
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
