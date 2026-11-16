# David Orihuela Coach · Gestión de clientes

Aplicación web para llevar el día a día de un entrenador personal: clientes, agenda de sesiones, progreso físico y cobros.

## Funcionalidades

- **Panel**: sesiones de hoy y de los próximos 7 días, ingresos del mes, cobros pendientes y avisos (bonos a punto de agotarse, clientes sin sesiones programadas).
- **Clientes**: ficha con datos de contacto, objetivo, nivel, tarifa, lesiones/patologías (destacadas en un aviso) y notas. Búsqueda, filtros activo/inactivo y accesos directos a WhatsApp y email.
- **Agenda semanal**: programa sesiones (con repetición semanal), márcalas como completadas, canceladas o «no asistió», y recibe un aviso si se solapan.
- **Progreso**: registra peso, % de grasa y perímetros; gráfico de evolución, diferencias respecto a la primera medición e IMC.
- **Pagos**: cobros pagados o pendientes, **bonos de sesiones** (descuento automático de las sesiones consumidas) y, opcionalmente, un cobro pendiente automático al completar cada sesión.
- **Ajustes**: moneda, tarifa y duración por defecto, tema claro/oscuro, exportar/importar copia de seguridad (JSON) y exportar clientes a CSV (Excel).

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
