// Who has Pro, decided in one place. check-subscription, police-events and send-push-notifications
// all ask Stripe the same way, and remember the answer in pro_status so that the database
// (the archive's row level security) and the push sender know it without asking Stripe again.

import { PLANS } from './stripePlans.ts';

export const PRO_PRODUCT_IDS: readonly string[] = [PLANS.monthly.product, PLANS.yearly.product];

/** Accounts that have Pro without paying. */
export const FREE_PREMIUM_EMAILS: readonly string[] = [
  'aronleijon@icloud.com',
  'oscaralvenius@outlook.com',
  'carlmrski@gmail.com',
  'stefanlasse67@gmail.com',
  'kristensson91@hotmail.com',
  'mykhailo@inphiz.com',
  'kcleijon@gmail.com',
];

export const isFreePremiumEmail = (email: string) => FREE_PREMIUM_EMAILS.includes(email.toLowerCase());

/** How long a remembered answer is trusted before Stripe is asked again. */
export const PRO_STATUS_TTL_MS = 6 * 60 * 60 * 1000;

export interface SubscriptionLike {
  id?: string;
  status: string;
  current_period_end?: number | null;
  cancel_at?: number | null;
  trial_end?: number | null;
  items?: { data?: { price?: { product?: string | { id: string } | null } | null }[] } | null;
}

// Canceled subscriptions keep Pro until the period they paid for ends
const ELIGIBLE = ['active', 'trialing', 'past_due', 'canceled'];

/** When the subscription's current period (or trial) ends, in seconds. */
export function periodEndSec(sub: SubscriptionLike): number | null {
  const end = Number(sub.current_period_end ?? sub.cancel_at ?? sub.trial_end);
  return Number.isFinite(end) && end > 0 ? end : null;
}

export function productOf(sub: SubscriptionLike): string | null {
  const product = sub.items?.data?.[0]?.price?.product;
  return typeof product === 'string' ? product : product?.id ?? null;
}

/**
 * The subscription that gives access now: active before trialing before past_due before
 * canceled, and the latest end first. Same rules check-subscription has always used.
 */
export function bestValidSubscription<T extends SubscriptionLike>(subs: T[], nowSec: number): T | null {
  const valid = subs.filter((s) => {
    if (!ELIGIBLE.includes(s.status)) return false;
    const end = periodEndSec(s);
    if (end !== null) return end > nowSec;
    // Some list responses omit the period end; trust the statuses that are still running
    return s.status === 'active' || s.status === 'trialing' || s.status === 'past_due';
  });
  valid.sort((a, b) => ELIGIBLE.indexOf(a.status) - ELIGIBLE.indexOf(b.status) || (periodEndSec(b) ?? 0) - (periodEndSec(a) ?? 0));
  return valid[0] ?? null;
}

/**
 * Until when a subscription gives Pro, as stored in pro_status.pro_until: its period end, or a day
 * ahead when Stripe left the end out (the app checks again well before then). Null if it isn't Pro.
 */
export function proUntilFor(sub: SubscriptionLike | null, nowMs: number): string | null {
  if (!sub) return null;
  const product = productOf(sub);
  if (!product || !PRO_PRODUCT_IDS.includes(product)) return null;
  const end = periodEndSec(sub);
  return new Date(end !== null ? end * 1000 : nowMs + 24 * 60 * 60 * 1000).toISOString();
}

/** Whether a stored pro_until still gives Pro. */
export const proUntilActive = (proUntil: string | null | undefined, nowMs: number) =>
  proUntil === 'infinity' || (!!proUntil && Date.parse(proUntil) > nowMs);

// The parts of the Stripe client this needs
interface StripeLike {
  customers: { list(params: { email: string; limit: number }): Promise<{ data: { id: string }[] }> };
  subscriptions: { list(params: { customer: string; status: 'all'; limit: number }): Promise<{ data: SubscriptionLike[] }> };
}

/** The best valid subscription across all Stripe customers with this email. */
export async function findSubscription(stripe: StripeLike, email: string, nowMs: number): Promise<SubscriptionLike | null> {
  const customers = await stripe.customers.list({ email, limit: 10 });
  const nowSec = Math.floor(nowMs / 1000);
  let best: SubscriptionLike | null = null;
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 });
    const candidate: SubscriptionLike | null = bestValidSubscription(best ? [best, ...subs.data] : subs.data, nowSec);
    if (candidate) best = candidate;
  }
  return best;
}

/** pro_until for an account: 'infinity' for the free list, else from Stripe. */
export async function lookupProUntil(stripe: StripeLike | null, email: string, nowMs: number): Promise<string | null> {
  if (isFreePremiumEmail(email)) return 'infinity';
  if (!stripe) return null;
  return proUntilFor(await findSubscription(stripe, email, nowMs), nowMs);
}

// A Supabase client with the service role. Typed loosely: the client's own generics are too deep
// to compare against a narrower interface, and the functions use different client versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServiceClient = { from(table: string): any };

export interface ProStatusRow {
  user_id: string;
  pro_until: string | null;
  checked_at: string;
}

/** Remembers an answer; a failure only means the next check asks Stripe again. */
export async function rememberProStatus(db: ServiceClient, userId: string, proUntil: string | null) {
  const { error } = await db
    .from('pro_status')
    .upsert({ user_id: userId, pro_until: proUntil, checked_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.warn('[premium] could not store pro_status:', error.message);
}

/** Remembered answers for these users, by user id (missing if never checked or unreadable). */
export async function readProStatus(db: ServiceClient, userIds: string[]): Promise<Map<string, ProStatusRow>> {
  const rows = new Map<string, ProStatusRow>();
  if (!userIds.length) return rows;
  const { data, error } = await db.from('pro_status').select('user_id, pro_until, checked_at').in('user_id', userIds);
  if (error) console.warn('[premium] could not read pro_status:', error.message);
  for (const row of (data ?? []) as ProStatusRow[]) rows.set(row.user_id, row);
  return rows;
}

/** Whether a remembered answer is recent enough to use without asking Stripe. */
export const isFresh = (row: ProStatusRow, nowMs: number) => nowMs - Date.parse(row.checked_at) < PRO_STATUS_TTL_MS;

/** Days of Pro a first-time subscriber gets before the first payment. */
export const TRIAL_DAYS = 7;

// Statuses of a subscription that actually gave Pro; incomplete ones were never paid or started
const HELD = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused'];

/** Whether any of these subscriptions ever gave Pro, so the free trial has been used. */
export const hadPro = (subs: SubscriptionLike[]) =>
  subs.some((s) => HELD.includes(s.status) && PRO_PRODUCT_IDS.includes(productOf(s) ?? ''));

/** Whether an account may start Pro with the free trial: never had Pro, and not on the free list. */
export async function trialEligible(stripe: StripeLike, email: string): Promise<boolean> {
  if (isFreePremiumEmail(email)) return false;
  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 });
    if (hadPro(subs.data)) return false;
  }
  return true;
}
