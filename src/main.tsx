import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { startMonitoring } from './lib/monitoring';
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
    // A new version is downloaded in the background and switched to while the page is hidden
    // (the visitor has left the app or tab), so a visit is never reloaded halfway through
    let updateReady = false;
    let switching = false;
    const applyUpdateIfHidden = () => {
      if (!updateReady || switching || document.visibilityState !== 'hidden') return;
      switching = true;
      updateSW(true);
    };
    // Reload onto the new version once it has taken over (here or from another tab); the first
    // install, which only starts controlling the page, needs no reload
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (switching || hadController) window.location.reload();
    });
    const updateSW = registerSW({
      // Register after the page has loaded, so the service worker's downloads don't compete with it
      immediate: false,
      onRegisteredSW(swUrl, registration) {
        console.info('[PWA] Service worker registrerad', {
          swUrl,
          scope: registration?.scope,
          active: Boolean(registration?.active),
          waiting: Boolean(registration?.waiting),
          installing: Boolean(registration?.installing),
        });
        // Leta efter ny version varje halvtimme
        setInterval(() => registration?.update?.(), 30 * 60 * 1000);
      },
      onNeedRefresh() {
        console.info('[PWA] Ny version nedladdad – byter när sidan är dold');
        updateReady = true;
        applyUpdateIfHidden();
      },
      onOfflineReady() {
        console.info('[PWA] Offline-stöd klart');
      },
      onRegisterError(error) {
        console.error('[PWA] Service worker kunde inte registreras', error);
      },
    });
    document.addEventListener('visibilitychange', applyUpdateIfHidden);

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

startMonitoring();
createRoot(document.getElementById('root')!).render(<App />);
