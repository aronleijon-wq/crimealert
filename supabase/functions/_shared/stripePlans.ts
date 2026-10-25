// Which Stripe price a checkout charges. The app only names the plan (monthly or yearly); the
// price is the newest active recurring price on that plan's product. A new price created in
// Stripe takes effect without a code change, and no other price in the account can be bought.

// A plan can name the price to charge (pinned); it is used while it is active in Stripe
export const PLANS: Record<'monthly' | 'yearly', { product: string; interval: 'month' | 'year'; price?: string }> = {
  monthly: { product: 'prod_U0dsMg8IZZKY7c', interval: 'month' },
  // 199 kr/år (src/components/account/plans.ts)
  yearly: { product: 'prod_U0duDYNoEp8JXS', interval: 'year', price: 'price_1UUXrRC5T1wZbLBJKb8Jzfnj' },
};
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

/** Whether a price may be charged for the plan: active, and renewing at the plan's interval. */
export const fitsPlan = (p: PriceLike, plan: Plan) => p.active && p.recurring?.interval === PLANS[plan].interval;

/** The plan's pinned price if it is among these, else the newest active price at the plan's interval. */
export function pickPrice<T extends PriceLike>(prices: T[], plan: Plan): T | null {
  const fitting = prices.filter((p) => fitsPlan(p, plan));
  return fitting.find((p) => p.id === PLANS[plan].price) ?? fitting.sort((a, b) => b.created - a.created)[0] ?? null;
}
