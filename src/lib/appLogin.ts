// Signing in to the iPhone app with Google or Apple happens in Apple's sign-in sheet, a Safari
// window of its own (CrimeAlertAuthPlugin in ios/App/App/AppDelegate.swift). The sheet opens
// /app-login, which marks this window and signs in. Wherever the sign-in returns to, the site then
// passes the session, or why there is none, on to crimealert://auth, which only the sheet that the
// app opened receives. The sheet never stays on the website: if the hand-over doesn't close it,
// a button does.
import { supabase } from '@/integrations/supabase/client';

const FLAG = 'ca-app-login';
// The mark is also kept in localStorage, in case the sign-in's round trip through Google or Apple
// loses sessionStorage. The sheet's storage is its own and thrown away when it closes; the time
// limit covers /app-login opened anywhere else.
const MAX_AGE_MS = 15 * 60 * 1000;
// A return without a session still gets a moment, in case the session arrives after the page
const NO_SESSION_WAIT_MS = 5000;

export function startAppLogin() {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* localStorage below */ }
  try { localStorage.setItem(FLAG, String(Date.now())); } catch { /* sessionStorage above */ }
}

/** Whether this window is the app's sign-in sheet, after /app-login */
export function inSignInSheet(now = Date.now()): boolean {
  try { if (sessionStorage.getItem(FLAG) === '1') return true; } catch { /* try localStorage */ }
  try {
    const started = Number(localStorage.getItem(FLAG));
    return started > 0 && now - started < MAX_AGE_MS;
  } catch {
    return false;
  }
}

function endAppLogin() {
  try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
  try { localStorage.removeItem(FLAG); } catch { /* ignore */ }
}

/** The app's address with the session, for the sign-in sheet to return */
export const appCallbackUrl = (accessToken: string, refreshToken: string) =>
  `crimealert://auth#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;

/** The app's address with why the sign-in didn't finish; the app shows it */
export const appErrorUrl = (message: string) => `crimealert://auth#error=${encodeURIComponent(message)}`;

/** What Google, Apple or the sign-in service said went wrong, if the return address says so */
export function returnedError(href: string): string | null {
  const url = new URL(href);
  for (const params of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
    const error = params.get('error_description') || params.get('error');
    if (error) return error.replace(/\+/g, ' ');
  }
  return null;
}

/** Covers the website with a way back to the app, for when the hand-over doesn't close the sheet */
function showBackToApp(url: string, signedIn: boolean) {
  const show = () => {
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;background:#05080b;color:#f5f5f5;font-family:-apple-system,system-ui,sans-serif;text-align:center';
    const title = document.createElement('p');
    title.style.cssText = 'margin:0;font-size:22px;font-weight:700';
    title.textContent = signedIn ? 'Du är inloggad' : 'Inloggningen blev inte klar';
    const link = document.createElement('a');
    link.href = url;
    link.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:240px;height:52px;padding:0 24px;border-radius:14px;background:#dc2626;color:#fff;font-size:17px;font-weight:600;text-decoration:none';
    link.textContent = 'Tillbaka till appen';
    box.append(title, link);
    document.body.append(box);
  };
  // Seen only if the sheet is still open by then
  setTimeout(() => (document.body ? show() : window.addEventListener('DOMContentLoaded', show, { once: true })), 800);
}

function handBack(url: string, signedIn: boolean) {
  endAppLogin();
  showBackToApp(url, signedIn);
  window.location.replace(url);
}

/** On every page load: in a sign-in sheet that the sign-in has returned to, return to the app. */
export function handOverAppLogin() {
  if (window.location.pathname === '/app-login' || !inSignInSheet()) return;
  const error = returnedError(window.location.href);
  if (error) {
    handBack(appErrorUrl(error), false);
    return;
  }
  let done = false;
  const noSession = setTimeout(() => {
    if (done) return;
    done = true;
    data.subscription.unsubscribe();
    handBack(appErrorUrl('Inloggningen avbröts eller gick inte igenom.'), false);
  }, NO_SESSION_WAIT_MS);
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (done || !session?.refresh_token) return;
    done = true;
    clearTimeout(noSession);
    setTimeout(() => data.subscription.unsubscribe(), 0);
    handBack(appCallbackUrl(session.access_token, session.refresh_token), true);
  });
}
