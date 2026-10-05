// After a new version is published, the old version's files are gone from the server. A page that
// still runs the old version (from the offline cache) then can't load the rest of the app: the
// map and every other section fail. When that happens, the cached old version is dropped and the
// site is loaded fresh, once a minute at most, so a real outage can't cause a reload loop.

import { lazy, type ComponentType } from 'react';

const KEY = 'crimealert_stale_build_reload';
const ONCE_PER_MS = 60 * 1000;
// Clearing the offline copy may not hang the reload
const CLEANUP_TIMEOUT_MS = 3000;
// A page still waiting this long after starting a fresh load shows the error instead
const RELOAD_TIMEOUT_MS = 15 * 1000;

/**
 * Added to the address of a fresh load, so no cache along the way can hand back the old page
 * (which would ask for the old, deleted files again); removed from the address bar on start.
 * index.html uses the same name.
 */
export const FRESH_PARAM = '_fresh';

/** The current address, marked as a fresh load. */
export function freshUrl(href = window.location.href): string {
  const url = new URL(href);
  url.searchParams.set(FRESH_PARAM, String(Date.now()));
  return url.toString();
}

/** Takes the fresh-load mark out of the address bar again. */
export function stripFreshParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(FRESH_PARAM)) return;
    url.searchParams.delete(FRESH_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // The address keeps the mark; the app ignores it
  }
}

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

/** Drops the offline copy of the site and loads it fresh, past every cache. */
export async function reloadFresh(reload: () => void = () => window.location.replace(freshUrl())) {
  const cleanup = (async () => {
    const sw = navigator.serviceWorker;
    if (sw) await Promise.all((await sw.getRegistrations()).map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  })().catch(() => {
    // Reloading is still the best we can do
  });
  await Promise.race([cleanup, new Promise((resolve) => setTimeout(resolve, CLEANUP_TIMEOUT_MS))]);
  reload();
}

/** True when it starts a fresh load; false when one was tried a moment ago (the error then shows). */
export function recoverFromStaleBuild(reload?: () => void): boolean {
  if (recentlyTried()) return false;
  markTried();
  void reloadFresh(reload);
  return true;
}

/**
 * Loads a page's file. When the file is gone, the site is loaded fresh and this keeps waiting for
 * that; if it never comes, the error shows (with its reload button) rather than loading forever.
 */
export function loadPage<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((error) => {
    if (recoverFromStaleBuild()) return new Promise<T>((_, reject) => setTimeout(() => reject(error), RELOAD_TIMEOUT_MS));
    throw error;
  });
}

/** React.lazy for a page, which loads the site fresh instead of failing when the page's file is gone. */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() => loadPage(load));
}

/** Vite reports a failed preload of a page's files here. */
export function watchForStaleBuild() {
  window.addEventListener('vite:preloadError', (event) => {
    if (recoverFromStaleBuild()) event.preventDefault();
  });
}
