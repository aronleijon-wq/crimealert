// Google AdSense (Auto ads) for free users only. The script is added when we know the visitor
// doesn't have Pro, and paused and removed again if they turn out to have it.

export const ADSENSE_CLIENT = 'ca-pub-3945855440160391';
const SCRIPT_ID = 'adsbygoogle-js';
const NO_ADS_CLASS = 'no-ads';

type AdsQueue = unknown[] & { pauseAdRequests?: 0 | 1 };
const adsWindow = () => window as Window & { adsbygoogle?: AdsQueue };

export type AdsDecision = 'show' | 'hide' | 'wait';

/**
 * Show ads to visitors who aren't signed in and to signed-in users whose subscription has been
 * checked and isn't Pro. Hide them from Pro. Wait while that is unknown, so Pro users never get
 * an ad while their subscription is being looked up.
 */
export function adsDecision(auth: { loading: boolean; signedIn: boolean; subscriptionChecked: boolean; isPremium: boolean }): AdsDecision {
  if (auth.loading) return 'wait';
  if (!auth.signedIn) return 'show';
  if (auth.isPremium) return 'hide';
  return auth.subscriptionChecked ? 'show' : 'wait';
}

let wanted = false;
let scheduled = false;

/**
 * Runs `fn` once the page has loaded and the browser is idle, so the ad script (several
 * hundred kB) doesn't compete with the app on a phone.
 */
function whenIdle(fn: () => void) {
  const idle = () => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 4000 });
    else window.setTimeout(fn, 1200);
  };
  if (document.readyState === 'complete') window.setTimeout(idle, 1500);
  else window.addEventListener('load', () => window.setTimeout(idle, 1500), { once: true });
}

function injectScript() {
  scheduled = false;
  if (!wanted || document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

export function showAds() {
  wanted = true;
  document.documentElement.classList.remove(NO_ADS_CLASS);
  const w = adsWindow();
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.pauseAdRequests = 0;
  if (document.getElementById(SCRIPT_ID) || scheduled) return;
  scheduled = true;
  whenIdle(injectScript);
}

export function hideAds() {
  wanted = false;
  document.documentElement.classList.add(NO_ADS_CLASS);
  const w = adsWindow();
  if (w.adsbygoogle) w.adsbygoogle.pauseAdRequests = 1;
  // Ads Google already placed on the page (in-page, anchor and vignette)
  document.querySelectorAll('ins.adsbygoogle, .google-auto-placed').forEach((el) => el.remove());
}
