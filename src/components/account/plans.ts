import type { SubscriptionState } from '@/hooks/useAuth';
import { BarChart3, BellRing, EyeOff, FileDown, FileText, ListChecks, Sparkles, Zap, type LucideIcon } from 'lucide-react';

// Prices, the trial and what Pro gives come from one place, shared with the server and the
// e-mails (supabase/functions/_shared/planFacts)
import {
  BLACK_WEEK_ENDS, BLACK_WEEK_TRIAL_DAYS, isBlackWeek, MONTHLY_KR, NO_ADS_FEATURE, NORMAL_TRIAL_DAYS, PRO_FEATURE_TEXTS, trialDays, YEARLY_KR, type ProFeatureKey,
} from '../../../supabase/functions/_shared/planFacts';
export { BLACK_WEEK_ENDS, BLACK_WEEK_TRIAL_DAYS, isBlackWeek, NORMAL_TRIAL_DAYS, trialDays };

/** How much cheaper a year is than twelve months, in percent */
export const YEARLY_DISCOUNT_PERCENT = Math.round((1 - YEARLY_KR / (MONTHLY_KR * 12)) * 100);

export const PRICES = {
  monthly: { amount: MONTHLY_KR, price: `${MONTHLY_KR} kr`, period: '/mån', note: null },
  yearly: { amount: YEARLY_KR, price: `${YEARLY_KR} kr`, period: '/år', note: `Spara ${MONTHLY_KR * 12 - YEARLY_KR} kr jämfört med månadsvis` },
} as const;
export type BillingCycle = keyof typeof PRICES;

/** Stripe's customer portal, where Pro members change or cancel their subscription */
export const BILLING_PORTAL_URL = 'https://billing.stripe.com/p/login/7sY28q57o6Vlduz8It1wY00';

/**
 * Whether the free plan shows ads. CrimeAlert shows none today, so Pro doesn't promise "Ingen reklam".
 * Set to true when ads are turned on: Pro's list, the comparison table, the FAQ, the account page
 * and the app then say Pro has no ads.
 */
export const FREE_PLAN_HAS_ADS = false;

// Free days before the first payment for accounts that never had Pro, as create-checkout gives
// them: a month during Black Week, through 30 November 2026, else a week (planFacts)

/** The free days when the page was opened */
export const TRIAL_DAYS = trialDays();
/** Whether the page was opened during Black Week */
export const BLACK_WEEK = isBlackWeek();

/** What Pro adds, as the code gates it (police-events, send-push-notifications, IncidentDetail, Analysis, ExportData, ask-crimealert). Medborgarrapporter are free with an account. */
const FEATURE_ICONS: Record<ProFeatureKey, LucideIcon> = {
  live: Zap, push: BellRing, description: FileText, details: ListChecks, analysis: BarChart3, export: FileDown, ask: Sparkles, noAds: EyeOff,
};
export const PRO_FEATURES: { icon: LucideIcon; text: string; /** One short line, for the app's Pro page */ short: string }[] =
  [...PRO_FEATURE_TEXTS, ...(FREE_PLAN_HAS_ADS ? [NO_ADS_FEATURE] : [])].map((f) => ({ icon: FEATURE_ICONS[f.key], text: f.text, short: f.short }));

/** The plan in words: "Gratis", "Pro livstid", "Provperiod t.o.m. 2026-10-12" and so on. */
export function planLabel(isPremium: boolean, subscription: SubscriptionState): string {
  if (!isPremium) return 'Gratis';
  const end = subscription.subscriptionEnd;
  if (end === 'lifetime') return 'Pro livstid';
  if (subscription.trialing && end) return `Provperiod t.o.m. ${end.slice(0, 10)}`;
  return end ? `Pro t.o.m. ${end.slice(0, 10)}` : 'Pro';
}
