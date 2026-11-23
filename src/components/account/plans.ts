import type { SubscriptionState } from '@/hooks/useAuth';
import { BarChart3, BellRing, EyeOff, FileDown, FileText, ListChecks, Sparkles, Zap, type LucideIcon } from 'lucide-react';

// Must match the active prices in Stripe (create-checkout charges whatever is active there)
const MONTHLY_KR = 19;
const YEARLY_KR = 199;

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
// them (premium.ts trialDays): a month during Black Week, through 30 November 2026, else a week
export const NORMAL_TRIAL_DAYS = 7;
export const BLACK_WEEK_TRIAL_DAYS = 30;
export const BLACK_WEEK_ENDS = Date.parse('2026-12-01T00:00:00+01:00');
export const isBlackWeek = (now = Date.now()) => now < BLACK_WEEK_ENDS;
export const trialDays = (now = Date.now()) => (isBlackWeek(now) ? BLACK_WEEK_TRIAL_DAYS : NORMAL_TRIAL_DAYS);

/** The free days when the page was opened */
export const TRIAL_DAYS = trialDays();
/** Whether the page was opened during Black Week */
export const BLACK_WEEK = isBlackWeek();

/** What Pro adds, as the code gates it (police-events, send-push-notifications, IncidentDetail, Analysis, ExportData, ask-crimealert). Medborgarrapporter are free with an account. */
export const PRO_FEATURES: { icon: LucideIcon; text: string; /** One short line, for the app's Pro page */ short: string }[] = [
  { icon: Zap, text: 'Polisens händelser direkt, utan 15 minuters fördröjning', short: 'Händelser direkt, utan 15 min väntan' },
  { icon: BellRing, text: 'Notiser direkt när något händer i dina kommuner', short: 'Notiser direkt i dina kommuner' },
  { icon: FileText, text: 'Hela beskrivningen av varje händelse', short: 'Hela beskrivningen av varje händelse' },
  { icon: ListChecks, text: 'Risknivå, status, Polisens kategori och platsens precision', short: 'Risknivå, status och kategori' },
  { icon: BarChart3, text: 'Analys och statistik per kommun, upp till 60 dagar bakåt', short: 'Analys och statistik, 60 dagar bakåt' },
  { icon: FileDown, text: 'Export till PDF och CSV', short: 'Export till PDF och CSV' },
  { icon: Sparkles, text: 'Fråga AI utan gräns, med utförligare svar (3 frågor per dag utan Pro)', short: 'Fråga AI utan gräns' },
  ...(FREE_PLAN_HAS_ADS ? [{ icon: EyeOff, text: 'Ingen reklam', short: 'Ingen reklam' }] : []),
];

/** The plan in words: "Gratis", "Pro livstid", "Provperiod t.o.m. 2026-10-12" and so on. */
export function planLabel(isPremium: boolean, subscription: SubscriptionState): string {
  if (!isPremium) return 'Gratis';
  const end = subscription.subscriptionEnd;
  if (end === 'lifetime') return 'Pro livstid';
  if (subscription.trialing && end) return `Provperiod t.o.m. ${end.slice(0, 10)}`;
  return end ? `Pro t.o.m. ${end.slice(0, 10)}` : 'Pro';
}
