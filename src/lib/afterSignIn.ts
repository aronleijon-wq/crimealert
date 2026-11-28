// Where to go after signing in or making an account: back to the page that asked for it (the
// account gate on Statistik and Brottsatlas), not the start page. Kept in localStorage for half
// an hour, so it survives Google's and Apple's sign-in pages and an e-mail confirmation link.
const KEY = 'ca-after-sign-in';
const TTL_MS = 30 * 60 * 1000;

/** A path on this site, never another site ("//evil.se") or the sign-in page itself */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/^\/(auth|app-login|reset-password)\b/.test(raw)) return null;
  return raw.length > 300 ? null : raw;
}

/** The sign-up page, coming back to `next` */
export const signupUrl = (next: string) => `/auth?mode=signup&next=${encodeURIComponent(next)}`;
export const signinUrl = (next: string) => `/auth?next=${encodeURIComponent(next)}`;

export function rememberNext(raw: string | null | undefined, now = Date.now()) {
  const path = safeNext(raw);
  if (!path) return;
  try { localStorage.setItem(KEY, JSON.stringify({ path, at: now })); } catch { /* private mode */ }
}

/** The page to return to, once: null when none or older than half an hour */
export function takeNext(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    return typeof at === 'number' && now - at <= TTL_MS ? safeNext(path) : null;
  } catch {
    return null;
  }
}
