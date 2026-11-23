import { useCallback, useState } from 'react';
import { BLACK_WEEK_ENDS, isBlackWeek } from '@/components/account/plans';
import { useAuth } from '@/hooks/useAuth';
import { canSellPro, isNativeApp } from '@/lib/native';

// Closed until then (ms): a day, so a tap on × doesn't hide the offer for the rest of the week
const HIDDEN_UNTIL_KEY = 'ca-black-week-2026-hidden-until';
const HIDE_MS = 24 * 60 * 60 * 1000;

export type BlackWeekOffer = 'trial' | 'invite';

/**
 * The Black Week strip at the top (components/BlackWeekBanner), through 30 November 2026: 30 days
 * of Pro free for those who can start a trial (signed out, or never had Pro), and 7 days of Pro per
 * friend for everyone else signed in. Its × hides it for a day on this device.
 */
export function useBlackWeekBanner(now = Date.now()) {
  const { user, subscription } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try { return Number(localStorage.getItem(HIDDEN_UNTIL_KEY) ?? 0) > now; } catch { return false; }
  });
  const dismiss = useCallback(() => {
    try { localStorage.setItem(HIDDEN_UNTIL_KEY, String(Date.now() + HIDE_MS)); } catch { /* private mode: closes on this page only */ }
    setDismissed(true);
  }, []);
  // The App Store gives its free trial only to those who never had Pro; the web, during Black
  // Week, to everyone without Pro now
  const eligible = isNativeApp() ? subscription?.firstTrial : subscription?.trialEligible;
  const trial = canSellPro() && (!user || eligible === true);
  const offer: BlackWeekOffer | null = trial ? 'trial' : user ? 'invite' : null;
  const visible = isBlackWeek(now) && !dismissed && offer !== null;
  const daysLeft = Math.max(1, Math.ceil((BLACK_WEEK_ENDS - now) / 86_400_000));
  return { visible, offer, dismiss, daysLeft, app: isNativeApp() };
}
