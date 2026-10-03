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

/** Starts listening for errors and measuring the page load. */
export function startMonitoring() {
  if (!ENABLED) return;
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, `${event.filename ?? ''}:${event.lineno ?? ''}`));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'));
  observeVitals();
}
