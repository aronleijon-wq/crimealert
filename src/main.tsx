import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { startMonitoring } from './lib/monitoring';
import { stripFreshParam, watchForStaleBuild } from './lib/staleBuild';
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
    // A new version is downloaded in the background and waits. The browser switches to it once
    // every tab and the installed app are closed, so a page never mixes two versions; switching
    // while a page loads used to delete files it still needed. A page that runs into missing
    // files anyway loads the site fresh (lib/staleBuild).
    registerSW({
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
        console.info('[PWA] Ny version nedladdad – används nästa gång appen öppnas');
      },
      onOfflineReady() {
        console.info('[PWA] Offline-stöd klart');
      },
      onRegisterError(error) {
        console.error('[PWA] Service worker kunde inte registreras', error);
      },
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

stripFreshParam();
startMonitoring();
watchForStaleBuild();
// The outer boundary also catches a failure in the app's providers, which would otherwise leave an empty page
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
