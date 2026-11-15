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

/**
 * Reloads every open page that runs an older build. Pages answer which build they run
 * (src/lib/appVersion.ts); a page that doesn't answer is older than that code, and a page that
 * answers with another build is old too. Pages already on this build are left alone.
 */
async function reloadOldPages() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!windows.length) return;
  // The build that is live (the one this service worker came with)
  let live = '';
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) live = (await res.json()).build || '';
  } catch (e) { /* offline: pages that answer are left to check for themselves */ }
  const current = new Set();
  const listen = (event) => {
    const data = event.data || {};
    // A page that answers is new enough to check for itself; it is left alone when it runs the
    // live build, or when the live build can't be read
    if (data.type === 'CA_BUILD' && event.source && (!live || data.build === live)) current.add(event.source.id);
  };
  self.addEventListener('message', listen);
  windows.forEach((client) => {
    try { client.postMessage({ type: 'CA_WHICH_BUILD' }); } catch (e) { /* closed */ }
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  self.removeEventListener('message', listen);
  await Promise.all(windows.map(async (client) => {
    if (current.has(client.id)) return;
    const url = new URL(client.url);
    if (url.origin !== self.location.origin) return;
    try {
      console.info('[sw-push] reloading an old page', url.pathname);
      await client.navigate(client.url);
    } catch (e) {
      console.warn('[sw-push] could not reload a page', e);
    }
  }));
}

self.addEventListener('install', (event) => {
  console.info('[sw-push] install');
  // A new version takes over at once (the old version's files are removed when it activates),
  // and then reloads the open pages that run an older build (reloadOldPages).
  self.skipWaiting();
  event.waitUntil(broadcastToClients('SW_INSTALL', { state: 'install' }));
});

self.addEventListener('activate', (event) => {
  console.info('[sw-push] activate');
  const activated = Promise.all([
    self.clients.claim(),
    broadcastToClients('SW_ACTIVE', { state: 'active', scope: self.registration.scope }),
  ]);
  event.waitUntil(activated);
  // Only once this version is active: a page reloading earlier would wait for it to activate,
  // which would wait for the page (and nothing would happen)
  activated.then(() => reloadOldPages()).catch((e) => console.warn('[sw-push] reloading old pages failed', e));
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
