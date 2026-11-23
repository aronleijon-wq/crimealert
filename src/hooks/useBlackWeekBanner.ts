import { useCallback, useEffect, useState } from 'react';
import { BLACK_WEEK_ENDS, BLACK_WEEK_TRIAL_DAYS, isBlackWeek } from '@/components/account/plans';
import { appleTrial, periodLabel } from '@/lib/appStore';
import { useAuth } from '@/hooks/useAuth';
import { canSellPro, isNativeApp } from '@/lib/native';

// Closed until then (ms): a day, so a tap on × doesn't hide the offer for the rest of the week
const HIDDEN_UNTIL_KEY = 'ca-black-week-2026-hidden-until';
const HIDE_MS = 24 * 60 * 60 * 1000;

export type BlackWeekOffer = 'trial' | 'invite';

/**
 * The Black Week strip at the top (components/BlackWeekBanner), through 30 November 2026: 30 days
 * of Pro free for those who can start a trial (on the web: signed out or without Pro now; in the
 * app: an Apple ID Apple still gives a trial), and 7 days of Pro per friend for everyone else signed in. Its × hides it for a day on this device.
 */
export function useBlackWeekBanner(now = Date.now()) {
  const { user, subscription, loading, subscriptionChecked } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try { return Number(localStorage.getItem(HIDDEN_UNTIL_KEY) ?? 0) > now; } catch { return false; }
  });
  const dismiss = useCallback(() => {
    try { localStorage.setItem(HIDDEN_UNTIL_KEY, String(Date.now() + HIDE_MS)); } catch { /* private mode: closes on this page only */ }
    setDismissed(true);
  }, []);
  // In the app Apple gives the trial, to each Apple ID that hasn't had one (whatever the account
  // did on the web), for as long as App Store Connect says: so the app asks Apple. Undefined while
  // it asks. The web, during Black Week, gives it to every account without Pro now.
  const app = isNativeApp();
  const [apple, setApple] = useState<string | null | undefined>(undefined);
  const askApple = app && canSellPro() && isBlackWeek(now);
  useEffect(() => {
    if (!askApple) return;
    let live = true;
    appleTrial().then((t) => { if (live) setApple(t); });
    return () => { live = false; };
  }, [askApple]);
  const trial = canSellPro() && (app ? Boolean(apple) : !user || subscription?.trialEligible === true);
  // Nothing until the answer is in (the sign-in, the account's check, Apple's), so the strip
  // slides in once with the right offer instead of showing the invite and then changing
  const known = !loading && (app ? !askApple || apple !== undefined : !user || subscriptionChecked !== false);
  const offer: BlackWeekOffer | null = !known ? null : trial ? 'trial' : user ? 'invite' : null;
  const visible = isBlackWeek(now) && !dismissed && offer !== null;
  const daysLeft = Math.max(1, Math.ceil((BLACK_WEEK_ENDS - now) / 86_400_000));
  // "30 dagar" on the web; Apple's own length in the app ("1 månad")
  const trialLength = app && apple ? periodLabel(apple, true) : `${BLACK_WEEK_TRIAL_DAYS} dagar`;
  return { visible, offer, dismiss, daysLeft, app, trialLength };
}
