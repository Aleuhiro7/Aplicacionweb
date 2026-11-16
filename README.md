# David Orihuela Coach · Gestión de clientes

Aplicación web para gestionar los clientes de asesoría online: cuotas mensuales, progreso físico y cobros.

## Funcionalidades

- **Resumen**: cobrado en el mes frente a lo previsto, lo que falta por cobrar (y lo vencido), clientes activos y en pausa, altas del mes, gráfico de ingresos de los últimos 6 meses, estado de las cuotas del mes y avisos (cuotas vencidas, clientes sin actualizar su progreso en 14 días).
- **Clientes**: ficha con contacto, cuota mensual y día de cobro, lesiones/patologías (destacadas en un aviso) y notas. Estados activo / en pausa / baja, búsqueda y accesos directos a WhatsApp y email.
- **Progreso**: registra peso, % de grasa y perímetros en cada revisión; gráfico de evolución, diferencias respecto a la primera medición e IMC.
- **Pagos**: cobra la cuota del mes con un clic (importe y concepto ya rellenados), registra otros pagos y marca pendientes como cobrados.
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
