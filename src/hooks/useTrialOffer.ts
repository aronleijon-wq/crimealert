import { isBlackWeek } from '@/components/account/plans';
import { useAuth } from '@/hooks/useAuth';

/**
 * Whether to offer the free trial: signed out, or an account check-subscription says may start
 * one. During Black Week almost every account may (all without Pro now), so the offer shows at
 * once while the account is still being checked, instead of "Uppgradera till Pro" changing to
 * "Prova gratis i 30 dagar" a moment later; the rare account with Pro then sees its own plan.
 */
export function useTrialOffer(now = Date.now()): boolean {
  const { user, subscription, subscriptionChecked } = useAuth();
  if (!user) return true;
  if (subscription?.trialEligible === true) return true;
  return subscriptionChecked === false && isBlackWeek(now);
}
