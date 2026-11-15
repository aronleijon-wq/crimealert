// Monthly recurring revenue (MRR) from both places Pro is sold: Stripe on the web and Apple in the
// iPhone app. Each subscription is turned into what it brings in per month; a yearly one counts a
// twelfth of its price. Trials, subscriptions with a failed payment and those set to end are kept
// apart, so the headline number is what paying customers pay now. Used by admin-revenue.

export type Source = 'stripe' | 'apple';
export type State = 'paying' | 'trial' | 'past_due';

export interface RevenueSub {
  source: Source;
  plan: 'monthly' | 'yearly' | 'other';
  /** What the customer pays per month, in the currency's smallest unit (öre) */
  monthlyMinor: number;
  currency: string;
  state: State;
  /** Set to end at the period's end (cancelled, or auto-renew turned off) */
  ending: boolean;
  /** When the subscription started (ISO), if known */
  startedAt: string | null;
}

// ---- Stripe ----

interface StripeCouponLike {
  percent_off?: number | null;
  amount_off?: number | null;
}
interface StripeDiscountLike {
  coupon?: StripeCouponLike | null;
  source?: { coupon?: StripeCouponLike | string | null } | null;
}
export interface StripeSubLike {
  status: string;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  start_date?: number | null;
  created?: number | null;
  currency?: string | null;
  items: {
    data: {
      quantity?: number | null;
      price: {
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: { interval: string; interval_count?: number | null } | null;
      };
    }[];
  };
  discounts?: (StripeDiscountLike | string)[] | null;
}

/** How many of an interval fit in a month */
const PER_MONTH: Record<string, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };

const STRIPE_STATES: Record<string, State> = { active: 'paying', trialing: 'trial', past_due: 'past_due' };

/** A Stripe subscription as revenue, or null when it brings in nothing (cancelled, unpaid, incomplete) */
export function fromStripe(sub: StripeSubLike): RevenueSub | null {
  const state = STRIPE_STATES[sub.status];
  if (!state) return null;
  let monthly = 0;
  let plan: RevenueSub['plan'] = 'other';
  for (const item of sub.items.data) {
    const recurring = item.price.recurring;
    if (!recurring || !item.price.unit_amount) continue;
    const perMonth = PER_MONTH[recurring.interval] ?? 0;
    monthly += (item.price.unit_amount * (item.quantity ?? 1) * perMonth) / (recurring.interval_count || 1);
    plan = recurring.interval === 'month' ? 'monthly' : recurring.interval === 'year' ? 'yearly' : 'other';
  }
  // Discounts that apply to every payment: a percentage, or an amount off each invoice
  const interval = sub.items.data[0]?.price.recurring;
  for (const discount of sub.discounts ?? []) {
    if (typeof discount === 'string') continue;
    const raw = discount.coupon ?? discount.source?.coupon;
    const coupon = typeof raw === 'string' ? null : raw;
    if (!coupon) continue;
    if (coupon.percent_off) monthly *= 1 - coupon.percent_off / 100;
    else if (coupon.amount_off && interval) monthly -= (coupon.amount_off * (PER_MONTH[interval.interval] ?? 0)) / (interval.interval_count || 1);
  }
  const started = sub.start_date ?? sub.created ?? null;
  return {
    source: 'stripe',
    plan,
    monthlyMinor: Math.max(0, Math.round(monthly)),
    currency: (sub.currency ?? sub.items.data[0]?.price.currency ?? 'sek').toLowerCase(),
    state,
    ending: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    startedAt: started ? new Date(started * 1000).toISOString() : null,
  };
}

// ---- Apple ----

/** What Apple says one subscription costs (from its signed transaction and renewal info) */
export interface AppleBilling {
  productId: string;
  /** The price of the latest payment, in thousandths of the currency (Apple's unit); 0 in a free trial */
  priceMilli: number | null;
  /** What the next renewal costs, in thousandths; null when Apple doesn't say */
  renewalPriceMilli: number | null;
  currency: string | null;
  autoRenew: boolean;
  /** In a free trial now */
  freeTrial: boolean;
  /** Pro until then; null when it gives no Pro now */
  expiresAt: string | null;
  startedAt: string | null;
}

const APPLE_PLANS: Record<string, RevenueSub['plan']> = { 'crimealert.pro.monthly': 'monthly', 'crimealert.pro.yearly': 'yearly' };

/** An Apple subscription as revenue, or null when it gives no Pro now */
export function fromApple(b: AppleBilling): RevenueSub | null {
  if (!b.expiresAt) return null;
  const plan = APPLE_PLANS[b.productId] ?? 'other';
  // In a free trial the latest "payment" is 0; what it will bring in is the renewal price
  const milli = b.freeTrial ? (b.renewalPriceMilli ?? 0) : (b.priceMilli ?? b.renewalPriceMilli ?? 0);
  const perMonth = plan === 'yearly' ? 1 / 12 : 1;
  return {
    source: 'apple',
    plan,
    monthlyMinor: Math.round((milli / 10) * perMonth),
    currency: (b.currency ?? 'sek').toLowerCase(),
    state: b.freeTrial ? 'trial' : 'paying',
    ending: !b.autoRenew,
    startedAt: b.startedAt,
  };
}

// ---- Summary ----

export interface SourceSummary {
  /** Paying now, including those with a failed payment that Stripe is still retrying */
  mrr: number;
  paying: number;
  monthly: number;
  yearly: number;
  trials: number;
  /** What the trials bring in per month if they all continue */
  trialMrr: number;
  pastDue: number;
  /** MRR that ends at the period's end unless the customer changes their mind */
  endingMrr: number;
  ending: number;
}

export interface RevenueSummary {
  currency: string;
  mrr: number;
  arr: number;
  /** Rough money to you per month: after 25 % moms and Stripe's or Apple's fees */
  netMrr: number;
  /** Paying customers who started in the last 30 days */
  newLast30: number;
  stripe: SourceSummary;
  apple: SourceSummary;
  /** Subscriptions in other currencies than the main one, which are left out of the totals */
  otherCurrencies: { currency: string; count: number; mrr: number }[];
}

/** Stripe's standard fee for European cards: 1.5 % + 1.80 kr per payment */
const STRIPE_PERCENT = 0.015;
const STRIPE_FIXED_MINOR = 180;
/** Apple's commission in the Small Business Program (otherwise 30 %) */
export const APPLE_COMMISSION = 0.15;
const VAT = 0.25;

const emptySource = (): SourceSummary => ({ mrr: 0, paying: 0, monthly: 0, yearly: 0, trials: 0, trialMrr: 0, pastDue: 0, endingMrr: 0, ending: 0 });

export function summarize(subs: RevenueSub[], now: number, currency = 'sek'): RevenueSummary {
  const bySource: Record<Source, SourceSummary> = { stripe: emptySource(), apple: emptySource() };
  const other = new Map<string, { count: number; mrr: number }>();
  let newLast30 = 0;
  let stripePaymentsPerMonth = 0;
  for (const s of subs) {
    if (s.currency !== currency) {
      const o = other.get(s.currency) ?? { count: 0, mrr: 0 };
      o.count += 1;
      if (s.state !== 'trial') o.mrr += s.monthlyMinor;
      other.set(s.currency, o);
      continue;
    }
    const t = bySource[s.source];
    if (s.state === 'trial') {
      t.trials += 1;
      t.trialMrr += s.monthlyMinor;
      continue;
    }
    t.mrr += s.monthlyMinor;
    t.paying += 1;
    if (s.plan === 'monthly') t.monthly += 1;
    if (s.plan === 'yearly') t.yearly += 1;
    if (s.state === 'past_due') t.pastDue += 1;
    if (s.ending) {
      t.ending += 1;
      t.endingMrr += s.monthlyMinor;
    }
    if (s.startedAt && now - Date.parse(s.startedAt) < 30 * 86_400_000) newLast30 += 1;
    if (s.source === 'stripe') stripePaymentsPerMonth += s.plan === 'yearly' ? 1 / 12 : 1;
  }
  const exVat = (minor: number) => minor / (1 + VAT);
  const stripeNet = exVat(bySource.stripe.mrr) - bySource.stripe.mrr * STRIPE_PERCENT - stripePaymentsPerMonth * STRIPE_FIXED_MINOR;
  const appleNet = exVat(bySource.apple.mrr) * (1 - APPLE_COMMISSION);
  const mrr = bySource.stripe.mrr + bySource.apple.mrr;
  return {
    currency,
    mrr,
    arr: mrr * 12,
    netMrr: Math.max(0, Math.round(stripeNet + appleNet)),
    newLast30,
    stripe: bySource.stripe,
    apple: bySource.apple,
    otherCurrencies: [...other].map(([c, o]) => ({ currency: c, ...o })),
  };
}
