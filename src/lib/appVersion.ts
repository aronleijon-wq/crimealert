// Keeps everyone on the newest version of the site. Each build has its own id, and the build that
// is live on the server says its id in /version.json. A page that finds a newer build loads it:
// at once when the page has just opened or is hidden, otherwise the next time the visitor leaves
// the tab, so nobody is reloaded in the middle of what they are doing. A visitor who comes back
// after a month gets the new site within seconds instead of the copy their browser kept.
import { reloadFresh } from './staleBuild';

/** This build's id (vite.config.ts); "dev" when running locally */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

const OPENED_AT = Date.now();
/** A page this new has hardly been used, so it can be reloaded at once */
const JUST_OPENED_MS = 30 * 1000;
/** How often an open page asks again, when the visitor comes back to it */
const CHECK_EVERY_MS = 10 * 60 * 1000;
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

/**
 * Reloads now if the page has just opened or is hidden, otherwise the next time it is hidden.
 * `now` and `doc` are for tests.
 */
export function reloadWhenSafe(reload: () => void, now = Date.now(), doc: Document = document) {
  if (doc.visibilityState === 'hidden' || now - OPENED_AT < JUST_OPENED_MS) {
    reload();
    return;
  }
  const onHide = () => {
    if (doc.visibilityState !== 'hidden') return;
    doc.removeEventListener('visibilitychange', onHide);
    reload();
  };
  doc.addEventListener('visibilitychange', onHide);
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

/** Checks soon after the page opens, and again when the visitor returns to the tab */
export function watchForNewVersion() {
  if (BUILD_ID === 'dev') return;
  let last = Date.now();
  setTimeout(() => void checkForNewVersion(), 2000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < CHECK_EVERY_MS) return;
    last = Date.now();
    void checkForNewVersion();
  });
}

/**
 * When a new version of the service worker takes over (it does so as soon as it is installed),
 * this page reloads when it is safe, so it doesn't keep running the old version.
 */
export function followServiceWorkerUpdates(sw: ServiceWorkerContainer) {
  const hadController = Boolean(sw.controller);
  sw.addEventListener('controllerchange', () => {
    // The first install has no old version to leave
    if (hadController) reloadWhenSafe(() => window.location.reload());
  });
}
