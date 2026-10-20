// Signing in to the iPhone app with Google or Apple happens in Apple's sign-in sheet, a Safari
// window of its own (CrimeAlertAuthPlugin in ios/App/App/AppDelegate.swift). The sheet opens
// /app-login, which marks this tab and signs in. Wherever the sign-in returns to, the site then
// passes the session on to crimealert://auth, which only the sheet that the app opened receives.
import { supabase } from '@/integrations/supabase/client';

const FLAG = 'ca-app-login';

export function startAppLogin() {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* the sign-in then stays in the sheet */ }
}

/** The app's address with the session, for the sign-in sheet to return */
export const appCallbackUrl = (accessToken: string, refreshToken: string) =>
  `crimealert://auth#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;

/** On every page load: in a sign-in sheet that has signed in, return to the app. */
export function handOverAppLogin() {
  let signingIn = false;
  try { signingIn = sessionStorage.getItem(FLAG) === '1'; } catch { /* not a sign-in sheet */ }
  if (!signingIn) return;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.refresh_token) return;
    try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
    setTimeout(() => data.subscription.unsubscribe(), 0);
    window.location.replace(appCallbackUrl(session.access_token, session.refresh_token));
  });
}
