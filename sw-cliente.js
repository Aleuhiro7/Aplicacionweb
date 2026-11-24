/* Service worker de la app de entrenamiento del cliente (cliente.html).
 * Solo sirve para los avisos de fin de descanso: el servidor los manda cuando el descanso termina y aquí se
 * muestran como notificación del móvil (suena y vibra aunque la app esté en segundo plano o el móvil bloqueado).
 * No guarda nada en caché: la app se sigue cargando siempre de internet como hasta ahora. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.some((w) => w.visibilityState === 'visible' && w.focused);
    const title = data.titulo || '¡Descanso terminado!';
    if (visible) {
      // La app está delante y ya está sonando su propia alarma: aviso mudo que se quita enseguida.
      await self.registration.showNotification(title, { tag: 'cz-descanso', silent: true });
      const list = await self.registration.getNotifications({ tag: 'cz-descanso' });
      list.forEach((n) => n.close());
      return;
    }
    await self.registration.showNotification(title, {
      body: data.texto || 'Vuelve a la app para la siguiente serie.',
      tag: 'cz-descanso',
      renotify: true,
      requireInteraction: true,
      vibrate: [600, 200, 600, 200, 600, 200, 1000],
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png',
      data: { id: data.id },
      actions: [{ action: 'parar', title: 'Parar avisos' }, { action: 'abrir', title: 'Abrir' }],
    });
  })());
});

/* Parar los avisos repetidos de ese descanso (el servidor deja de mandarlos). */
const FN = 'https://europe-west1-aplicacionweb7.cloudfunctions.net/avisoDescanso';
function stopNotices(n) {
  const id = n && n.data && n.data.id;
  if (!id) return Promise.resolve();
  return fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { accion: 'cancelar', id } }) }).catch(() => {});
}
// Quitar la notificación (deslizarla) también para los avisos.
self.addEventListener('notificationclose', (event) => event.waitUntil(stopNotices(event.notification)));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'parar') { event.waitUntil(stopNotices(event.notification)); return; }
  event.waitUntil((async () => {
    await stopNotices(event.notification);
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = wins.find((w) => /cliente\.html/.test(w.url));
    if (app) return app.focus();
    return self.clients.openWindow('cliente.html#entreno');
  })());
});
