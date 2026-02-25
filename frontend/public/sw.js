/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - SERVICE WORKER (Web Push VAPID)
 * ═══════════════════════════════════════════════════════════════════════
 * Recibe notificaciones push en background y las muestra como
 * notificaciones nativas del sistema operativo / WebView.
 * ═══════════════════════════════════════════════════════════════════════
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* ── Recibir notificación push ── */
self.addEventListener('push', (event) => {
  let data = { title: 'COO Alianzas', body: '', icon: '/favicon.png', badge: '/favicon.png', data: {} };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (_) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon  || '/favicon.png',
      badge: data.badge || '/favicon.png',
      data:  data.data  || {},
      vibrate: [200, 100, 200],
      requireInteraction: false
    })
  );
});

/* ── Al hacer clic en la notificación ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña/WebView abierta, enfocala
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      // Si no, abre una nueva
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
