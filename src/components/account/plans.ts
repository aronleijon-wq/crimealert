import type { SubscriptionState } from '@/hooks/useAuth';
import { BarChart3, BellRing, EyeOff, FileDown, FileText, ListChecks, Users, Zap, type LucideIcon } from 'lucide-react';

// Must match the active prices in Stripe (create-checkout charges whatever is active there)
const MONTHLY_KR = 19;
const YEARLY_KR = 159;

/** How much cheaper a year is than twelve months, in percent */
export const YEARLY_DISCOUNT_PERCENT = Math.round((1 - YEARLY_KR / (MONTHLY_KR * 12)) * 100);

export const PRICES = {
  monthly: { amount: MONTHLY_KR, price: `${MONTHLY_KR} kr`, period: '/mån', note: null },
  yearly: { amount: YEARLY_KR, price: `${YEARLY_KR} kr`, period: '/år', note: `Spara ${MONTHLY_KR * 12 - YEARLY_KR} kr jämfört med månadsvis` },
} as const;
export type BillingCycle = keyof typeof PRICES;

/** Stripe's customer portal, where Pro members change or cancel their subscription */
export const BILLING_PORTAL_URL = 'https://billing.stripe.com/p/login/7sY28q57o6Vlduz8It1wY00';

/** Free days before the first payment for accounts that never had Pro (create-checkout, premium.ts) */
export const TRIAL_DAYS = 7;

/** What Pro adds, as the code gates it (police-events, send-push-notifications, IncidentDetail, Analysis, ExportData, CommunityReports, ads). */
export const PRO_FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: Zap, text: 'Polisens händelser direkt, utan 15 minuters fördröjning' },
  { icon: BellRing, text: 'Notiser direkt när något händer i dina kommuner' },
  { icon: FileText, text: 'Hela beskrivningen av varje händelse' },
  { icon: ListChecks, text: 'Risknivå, status, Polisens kategori och platsens precision' },
  { icon: BarChart3, text: 'Analys och statistik per kommun, upp till 60 dagar bakåt' },
  { icon: FileDown, text: 'Export till PDF och CSV' },
  { icon: Users, text: 'Medborgarrapporter: se andras och skicka egna' },
  { icon: EyeOff, text: 'Ingen reklam' },
];

/** The plan in words: "Gratis", "Pro livstid", "Provperiod t.o.m. 2026-10-12" and so on. */
export function planLabel(isPremium: boolean, subscription: SubscriptionState): string {
  if (!isPremium) return 'Gratis';
  const end = subscription.subscriptionEnd;
  if (end === 'lifetime') return 'Pro livstid';
  if (subscription.trialing && end) return `Provperiod t.o.m. ${end.slice(0, 10)}`;
  return end ? `Pro t.o.m. ${end.slice(0, 10)}` : 'Pro';
}
