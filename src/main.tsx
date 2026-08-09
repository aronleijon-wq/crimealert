import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

if ('serviceWorker' in navigator) {
  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
      console.info('[PWA] Service workers avregistrerade i preview/iframe');
    });
  } else {
    let reloading = false;
    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(swUrl, registration) {
        console.info('[PWA] Service worker registrerad', {
          swUrl,
          scope: registration?.scope,
          active: Boolean(registration?.active),
          waiting: Boolean(registration?.waiting),
          installing: Boolean(registration?.installing),
        });
        // Leta efter ny version direkt och varje halvtimme
        registration?.update?.();
        setInterval(() => registration?.update?.(), 30 * 60 * 1000);
      },
      onNeedRefresh() {
        console.info('[PWA] Ny version hittad – uppdaterar automatiskt');
        updateSW(true);
      },
      onOfflineReady() {
        console.info('[PWA] Offline-stöd klart');
      },
      onRegisterError(error) {
        console.error('[PWA] Service worker kunde inte registreras', error);
      },
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });


    navigator.serviceWorker.ready
      .then((registration) => {
        console.info('[PWA] Service worker aktiv', {
          scope: registration.scope,
          active: Boolean(registration.active),
          waiting: Boolean(registration.waiting),
          installing: Boolean(registration.installing),
        });
      })
      .catch((error) => {
        console.error('[PWA] Service worker blev inte redo', error);
      });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.source === 'sw-push') {
        console.info('[PWA] Meddelande från service worker', event.data);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
