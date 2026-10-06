// Errors, loading times and page views from real visitors, sent to the database without
// cookies or anything that identifies the visitor. Only on crimealert.se; admins see the
// summary on /admin.

const ENABLED = typeof window !== 'undefined' && /(^|\.)crimealert\.se$/.test(window.location.hostname);
const VITAL_SAMPLE = 0.25;
const MAX_ERRORS_PER_PAGE_LOAD = 5;

type Device = 'mobile' | 'desktop';
export const deviceType = (): Device =>
  window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches ? 'mobile' : 'desktop';

/** "/kommun/malmo" → "/kommun/:slug", "/handelse/612345" → "/handelse/:id": pages, not people. */
export function pagePattern(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (/^\/kommun\/[^/]+$/.test(clean)) return '/kommun/:slug';
  if (/^\/kommun\/[^/]+\/[^/]+$/.test(clean)) return '/kommun/:slug/:month';
  if (/^\/guider\/[^/]+$/.test(clean)) return '/guider/:slug';
  if (/^\/handelse\/[^/]+$/.test(clean)) return '/handelse/:id';
  return clean.length > 80 ? clean.slice(0, 80) : clean;
}

async function rpc(name: string, args: Record<string, unknown>) {
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(args),
    });
  } catch {
    // Monitoring never gets in the visitor's way
  }
}

let lastViewed = '';
/** Counts a page view; the same address twice in a row (a re-render) counts once. */
export function trackPageView(path: string) {
  if (!ENABLED || path === lastViewed) return;
  lastViewed = path;
  void rpc('track_page_view', { _page: pagePattern(path), _device: deviceType() });
}

const reported = new Set<string>();
/** Sends an error once per page load, and at most a few per page load. */
export function reportError(error: unknown, source = '') {
  if (!ENABLED) return;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? 'Okänt fel');
  // Noise from browser extensions, aborted requests and a dropped connection
  if (/ResizeObserver loop|chrome-extension:|moz-extension:|AbortError/i.test(message)) return;
  if (/^TypeError: (Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)$/.test(message)) return;
  if (reported.has(message) || reported.size >= MAX_ERRORS_PER_PAGE_LOAD) return;
  reported.add(message);
  const stack = error instanceof Error ? error.stack ?? '' : '';
  void rpc('log_client_event', {
    _kind: 'error', _page: pagePattern(window.location.pathname), _name: message.slice(0, 300),
    _value: null, _detail: `${source}\n${stack}`.trim().slice(0, 1000), _device: deviceType(),
  });
}

function sendVital(name: string, value: number) {
  void rpc('log_client_event', {
    _kind: 'vital', _page: pagePattern(window.location.pathname), _name: name,
    _value: Math.round(name === 'CLS' ? value * 1000 : value) / (name === 'CLS' ? 1000 : 1), _detail: null, _device: deviceType(),
  });
}

/** Loading time of the first page: largest paint, first paint, server time, layout shift and responsiveness. */
function observeVitals() {
  if (Math.random() >= VITAL_SAMPLE || typeof PerformanceObserver === 'undefined') return;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  const observe = (type: string, onEntry: (entry: PerformanceEntry) => void, options: PerformanceObserverInit = {}) => {
    if (!supported.includes(type)) return;
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true, ...options });
    } catch { /* unsupported */ }
  };
  observe('largest-contentful-paint', (e) => { lcp = e.startTime; });
  observe('layout-shift', (e) => {
    const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
    if (!shift.hadRecentInput) cls += shift.value;
  });
  observe('event', (e) => { inp = Math.max(inp, e.duration); }, { durationThreshold: 40 } as PerformanceObserverInit);
  observe('paint', (e) => { if (e.name === 'first-contentful-paint') sendVital('FCP', e.startTime); });
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && nav.responseStart > 0) sendVital('TTFB', nav.responseStart);

  let sent = false;
  const flush = () => {
    if (sent || document.visibilityState !== 'hidden') return;
    sent = true;
    if (lcp) sendVital('LCP', lcp);
    sendVital('CLS', cls);
    if (inp) sendVital('INP', inp);
  };
  document.addEventListener('visibilitychange', flush);
}

// Where a visit comes from: the site that linked here, or the utm_source an ad or ChatGPT adds
const SOURCES: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'chatgpt'],
  [/(^|\.)perplexity\.ai$/, 'perplexity'],
  [/(^|\.)claude\.ai$/, 'claude'],
  [/^gemini\.google\.com$/, 'gemini'],
  [/(^|\.)copilot\.microsoft\.com$/, 'copilot'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)(facebook\.com|fb\.com|instagram\.com)$/, 'meta'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)flashback\.org$/, 'flashback'],
  [/(^|\.)(x\.com|twitter\.com)$|^t\.co$/, 'x'],
  [/(^|\.)youtube\.com$/, 'youtube'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'linkedin'],
];
// Coming back from signing in or paying is not a new visit
const NOT_A_SOURCE = /(^|\.)(crimealert\.se|stripe\.com|supabase\.co|lovable\.app|lovableproject\.com)$|^accounts\.google\.[a-z.]+$/;
const UTM_ALIASES: Record<string, string> = { 'chatgpt.com': 'chatgpt', openai: 'chatgpt', facebook: 'meta', fb: 'meta', instagram: 'meta', ig: 'meta' };

/** "chatgpt", "google", "meta", "direkt" or the linking site; null for a step inside the site. */
export function visitSource(href: string, referrer: string): string | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const utm = (url.searchParams.get('utm_source') ?? '').trim().toLowerCase().replace(/[^a-z0-9.-]/g, '').replace(/^[.-]+/, '').slice(0, 40);
  if (utm) return UTM_ALIASES[utm] ?? utm;
  if (!referrer) return 'direkt';
  let host: string;
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 'direkt'; }
  if (!host) return 'direkt';
  if (host === url.hostname.replace(/^www\./, '') || NOT_A_SOURCE.test(host)) return null;
  for (const [pattern, name] of SOURCES) if (pattern.test(host)) return name;
  return host.replace(/[^a-z0-9.-]/g, '').slice(0, 40) || null;
}

/** Counts where this visit came from, once per page load; reloads and going back don't count. */
function trackVisitSource() {
  if (navigator.webdriver) return; // crawlers rendering the page, not visitors
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav && nav.type !== 'navigate') return;
  const source = visitSource(window.location.href, document.referrer);
  if (source) void rpc('track_visit_source', { _source: source });
}

/** Starts listening for errors and measuring the page load. */
export function startMonitoring() {
  if (!ENABLED) return;
  trackVisitSource();
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, `${event.filename ?? ''}:${event.lineno ?? ''}`));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'));
  observeVitals();
}
