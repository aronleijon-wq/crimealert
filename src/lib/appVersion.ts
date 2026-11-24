// Keeps everyone on the newest version of the site. Each build has its own id, and the build that
// is live on the server says its id in /version.json. A page that finds a newer build loads it at
// once, unless the visitor is typing in a field: then it waits until they leave the field or the
// tab, so nothing they write is lost. Open pages ask again every few minutes, and the service
// worker (public/sw-push.js) reloads pages that run an older build, including pages so old that
// they have none of this code.
import { reloadFresh } from './staleBuild';

/** This build's id (vite.config.ts); "dev" when running locally */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

/** The event the iPhone app sends on the document when it comes back from the background */
export const APP_RESUMED = 'crimealert-app-resumed';

/** How often an open, visible page asks whether a newer build is live */
const CHECK_EVERY_MS = 5 * 60 * 1000;
const TRIED_KEY = 'ca_reloaded_for_build';

/** The id of the build that is live, or null when it can't be read */
export async function liveBuild(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { build?: unknown };
    return typeof body.build === 'string' && body.build ? body.build : null;
  } catch {
    return null;
  }
}

/** Whether the visitor is writing something: a text field or editable area with focus and content */
export function isTyping(doc: Document = document): boolean {
  const el = doc.activeElement as (HTMLElement & { value?: unknown }) | null;
  if (!el) return false;
  if (el.isContentEditable) return (el.textContent ?? '').trim().length > 0;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return typeof el.value === 'string' && el.value.trim().length > 0;
  if (tag === 'INPUT') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    const text = ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].includes(type);
    return text && typeof el.value === 'string' && el.value.trim().length > 0;
  }
  return false;
}

/**
 * Reloads now, unless the visitor is typing: then when they leave the field or the tab.
 * `doc` is for tests.
 */
export function reloadWhenSafe(reload: () => void, doc: Document = document) {
  if (doc.visibilityState === 'hidden' || !isTyping(doc)) {
    reload();
    return;
  }
  const later = () => {
    if (doc.visibilityState !== 'hidden' && isTyping(doc)) return;
    doc.removeEventListener('visibilitychange', later);
    doc.removeEventListener('focusout', later, true);
    reload();
  };
  doc.addEventListener('visibilitychange', later);
  // After the field has lost focus (focusout fires before activeElement changes)
  doc.addEventListener('focusout', () => setTimeout(later, 0), true);
}

/** Whether a reload for this build was already tried in this visit, so a stale server can't cause a loop */
function alreadyTried(build: string): boolean {
  try {
    if (sessionStorage.getItem(TRIED_KEY) === build) return true;
    sessionStorage.setItem(TRIED_KEY, build);
  } catch {
    // Without storage we still try once per page
  }
  return false;
}

/** Asks the server which build is live, and moves to it when it is newer than this one */
export async function checkForNewVersion(fetcher: typeof fetch = fetch, reload: () => void = () => void reloadFresh()) {
  const live = await liveBuild(fetcher);
  if (!live || live === BUILD_ID || alreadyTried(live)) return false;
  reloadWhenSafe(reload);
  return true;
}

/** Checks soon after the page opens, every few minutes while it is shown, and when the visitor returns */
export function watchForNewVersion() {
  if (BUILD_ID === 'dev') return;
  let last = Date.now();
  const check = () => {
    last = Date.now();
    void checkForNewVersion();
  };
  // At once: a page opened from an old saved copy (an e-mail link on a phone, say) must not
  // show old prices and offers for long
  check();
  setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, CHECK_EVERY_MS);
  const onReturn = () => {
    if (document.visibilityState === 'visible' && Date.now() - last >= 60 * 1000) check();
  };
  document.addEventListener('visibilitychange', onReturn);
  // The iPhone app keeps the page in memory while it is in the background, and its web view does
  // not always say the page became visible again. The app says so itself when it comes back
  // (ios/App/App/AppDelegate.swift, from 1.6), and Capacitor sends "resume" on the document.
  document.addEventListener(APP_RESUMED, onReturn);
  document.addEventListener('resume', onReturn);
  // A page brought back from the browser's back/forward memory
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) check();
  });
}

/** The message the service worker sends to ask a page which build it runs, and the answer */
export const BUILD_QUESTION = 'CA_WHICH_BUILD';
export const BUILD_ANSWER = 'CA_BUILD';

/**
 * Answers the service worker's question about this page's build, so it only reloads pages that
 * run an older one. When a new service worker takes over, the page checks the live build itself.
 */
export function followServiceWorkerUpdates(sw: ServiceWorkerContainer) {
  sw.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type !== BUILD_QUESTION) return;
    (event.source as ServiceWorker | null)?.postMessage({ type: BUILD_ANSWER, build: BUILD_ID });
  });
  // Messages wait until this is called
  sw.startMessages?.();
  const hadController = Boolean(sw.controller);
  sw.addEventListener('controllerchange', () => {
    // The first install has no old version to leave
    if (hadController) void checkForNewVersion();
  });
}
