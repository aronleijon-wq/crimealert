const DEFAULT_NOTIFICATION = {
  title: 'CrimeAlert',
  body: 'En ny händelse finns tillgänglig.',
  icon: '/pwa-192x192.png',
  badge: '/pwa-192x192.png',
  tag: 'crimealert',
  data: { url: '/' },
  vibrate: [200, 100, 200],
  requireInteraction: true,
};

async function broadcastToClients(type, payload = {}) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach((client) => {
    client.postMessage({ source: 'sw-push', type, payload, ts: Date.now() });
  });
}

function buildNotification(data = {}) {
  return {
    title: data.title || DEFAULT_NOTIFICATION.title,
    options: {
      body: data.body || DEFAULT_NOTIFICATION.body,
      icon: data.icon || DEFAULT_NOTIFICATION.icon,
      badge: data.badge || DEFAULT_NOTIFICATION.badge,
      tag: data.tag || DEFAULT_NOTIFICATION.tag,
      data: data.data || DEFAULT_NOTIFICATION.data,
      vibrate: data.vibrate || DEFAULT_NOTIFICATION.vibrate,
      requireInteraction: data.requireInteraction ?? DEFAULT_NOTIFICATION.requireInteraction,
      renotify: true,
    },
  };
}

self.addEventListener('install', (event) => {
  console.info('[sw-push] install');
  event.waitUntil(broadcastToClients('SW_INSTALL', { state: 'install' }));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.info('[sw-push] activate');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      broadcastToClients('SW_ACTIVE', { state: 'active', scope: self.registration.scope }),
    ])
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'PING_SW') {
    event.source?.postMessage({
      source: 'sw-push',
      type: 'PONG_SW',
      payload: {
        state: self.registration.active ? 'active' : 'unknown',
        scope: self.registration.scope,
      },
      ts: Date.now(),
    });
  }
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.info('[sw-push] pushsubscriptionchange');
  event.waitUntil(broadcastToClients('PUSH_SUBSCRIPTION_CHANGED', { state: 'changed' }));
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      console.warn('[sw-push] Kunde inte tolka push payload som JSON', error);
      payload = {
        title: DEFAULT_NOTIFICATION.title,
        body: event.data.text() || DEFAULT_NOTIFICATION.body,
      };
    }
  }

  const notification = buildNotification(payload);
  console.info('[sw-push] push mottagen', notification);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notification.title, notification.options),
      broadcastToClients('PUSH_RECEIVED', {
        title: notification.title,
        body: notification.options.body,
        tag: notification.options.tag,
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  console.info('[sw-push] notificationclick');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(url);
          }
          return client.focus();
        }
      }

      return clients.openWindow(url);
    })
  );
});
