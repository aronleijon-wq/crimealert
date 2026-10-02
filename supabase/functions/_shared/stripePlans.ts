// Which Stripe price a checkout charges. The app only names the plan (monthly or yearly); the
// price is the newest active recurring price on that plan's product. A new price created in
// Stripe takes effect without a code change, and no other price in the account can be bought.

export const PLANS = {
  monthly: { product: 'prod_U0dsMg8IZZKY7c', interval: 'month' },
  yearly: { product: 'prod_U0duDYNoEp8JXS', interval: 'year' },
} as const;
export type Plan = keyof typeof PLANS;

// Price ids that older versions of the app send instead of a plan
const LEGACY_PRICE_IDS: Record<string, Plan> = {
  price_1T2caOC5T1wZbLBJxntsUCrz: 'monthly',
  price_1T2cciC5T1wZbLBJfPgzHr4v: 'yearly',
};

/** The plan a checkout request asks for, or null if it names none we sell. */
export function planFromRequest(body: unknown): Plan | null {
  const { plan, priceId } = (body ?? {}) as { plan?: unknown; priceId?: unknown };
  if (plan === 'monthly' || plan === 'yearly') return plan;
  if (typeof priceId === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_PRICE_IDS, priceId)) {
    return LEGACY_PRICE_IDS[priceId];
  }
  return null;
}

export interface PriceLike {
  id: string;
  active: boolean;
  created: number;
  recurring: { interval: string } | null;
  unit_amount?: number | null;
  currency?: string;
}

/** The newest active price that renews at the plan's interval. */
export function pickPrice<T extends PriceLike>(prices: T[], plan: Plan): T | null {
  const interval = PLANS[plan].interval;
  return prices
    .filter((p) => p.active && p.recurring?.interval === interval)
    .sort((a, b) => b.created - a.created)[0] ?? null;
}
