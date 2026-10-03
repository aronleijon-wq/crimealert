// After a new version is published, the old version's files are gone from the server. A page that
// still runs the old version (from the offline cache) then can't load the rest of the app: the
// map and every other section fail. When that happens, the cached old version is dropped and the
// site is loaded fresh, once a minute at most, so a real outage can't cause a reload loop.

import { lazy, type ComponentType } from 'react';

const KEY = 'crimealert_stale_build_reload';
const ONCE_PER_MS = 60 * 1000;

const recentlyTried = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < ONCE_PER_MS;
  } catch {
    return false;
  }
};
const markTried = () => {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ }
};

/** Drops the offline copy of the site and loads it fresh. */
export async function reloadFresh(reload: () => void = () => window.location.reload()) {
  try {
    const sw = navigator.serviceWorker;
    if (sw) await Promise.all((await sw.getRegistrations()).map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  } catch {
    // Reloading is still the best we can do
  }
  reload();
}

/** True when it starts a fresh load; false when one was tried a moment ago (the error then shows). */
export function recoverFromStaleBuild(reload?: () => void): boolean {
  if (recentlyTried()) return false;
  markTried();
  void reloadFresh(reload);
  return true;
}

/** React.lazy for a page, which loads the site fresh instead of failing when the page's file is gone. */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((error) => {
      // Keep showing the loading state until the fresh load takes over
      if (recoverFromStaleBuild()) return new Promise<{ default: T }>(() => {});
      throw error;
    }),
  );
}

/** Vite reports a failed preload of a page's files here. */
export function watchForStaleBuild() {
  window.addEventListener('vite:preloadError', (event) => {
    if (recoverFromStaleBuild()) event.preventDefault();
  });
}
