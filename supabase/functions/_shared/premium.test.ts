import { describe, it, expect } from 'vitest';
import { bestValidSubscription, findSubscription, hadPro, isFresh, laterProUntil, lookupProUntil, proUntilActive, proUntilFor, rememberProStatus, storeApplePro, trialEligible, type SubscriptionLike } from './premium';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const sec = (iso: string) => Date.parse(iso) / 1000;
const sub = (status: string, end: string | null, product = 'prod_U0dsMg8IZZKY7c'): SubscriptionLike => ({
  status,
  current_period_end: end ? sec(end) : null,
  items: { data: [{ price: { product } }] },
});

describe('bestValidSubscription', () => {
  it('keeps Pro for trials and cancelled subscriptions until their period ends', () => {
    expect(bestValidSubscription([sub('trialing', '2026-10-10T00:00:00Z')], NOW / 1000)?.status).toBe('trialing');
    expect(bestValidSubscription([sub('canceled', '2026-10-20T00:00:00Z')], NOW / 1000)?.status).toBe('canceled');
    expect(bestValidSubscription([sub('canceled', '2026-10-01T00:00:00Z')], NOW / 1000)).toBeNull();
    expect(bestValidSubscription([sub('incomplete_expired', '2026-11-01T00:00:00Z')], NOW / 1000)).toBeNull();
  });

  it('prefers active, then the latest end', () => {
    const subs = [sub('canceled', '2026-12-01T00:00:00Z'), sub('active', '2026-10-20T00:00:00Z'), sub('active', '2026-11-01T00:00:00Z')];
    expect(bestValidSubscription(subs, NOW / 1000)).toBe(subs[2]);
  });
});

describe('proUntilFor', () => {
  it('is the period end for Pro products only', () => {
    expect(proUntilFor(sub('active', '2026-11-01T00:00:00Z'), NOW)).toBe('2026-11-01T00:00:00.000Z');
    expect(proUntilFor(sub('active', '2026-11-01T00:00:00Z', 'prod_other'), NOW)).toBeNull();
    expect(proUntilFor(null, NOW)).toBeNull();
  });

  it('gives a day when Stripe leaves the end out', () => {
    expect(proUntilFor(sub('active', null), NOW)).toBe('2026-10-04T12:00:00.000Z');
  });
});

describe('proUntilActive and isFresh', () => {
  it('reads stored answers', () => {
    expect(proUntilActive('infinity', NOW)).toBe(true);
    expect(proUntilActive('2026-10-03T12:00:01Z', NOW)).toBe(true);
    expect(proUntilActive('2026-10-03T11:59:59Z', NOW)).toBe(false);
    expect(proUntilActive(null, NOW)).toBe(false);
    expect(isFresh({ user_id: 'u', pro_until: null, checked_at: '2026-10-03T07:00:00Z' }, NOW)).toBe(true);
    expect(isFresh({ user_id: 'u', pro_until: null, checked_at: '2026-10-03T05:00:00Z' }, NOW)).toBe(false);
  });
});

describe('lookupProUntil', () => {
  const stripe = (byCustomer: Record<string, SubscriptionLike[]>) => ({
    customers: { list: async () => ({ data: Object.keys(byCustomer).map((id) => ({ id })) }) },
    subscriptions: { list: async ({ customer }: { customer: string }) => ({ data: byCustomer[customer] }) },
  });

  it('gives free Pro accounts Pro without asking Stripe', async () => {
    expect(await lookupProUntil(null, 'Aronleijon@icloud.com', NOW)).toBe('infinity');
  });

  it('looks across all customers with the email', async () => {
    const client = stripe({ cus_a: [sub('canceled', '2026-09-01T00:00:00Z')], cus_b: [sub('trialing', '2026-10-09T00:00:00Z')] });
    expect((await findSubscription(client, 'x@example.com', NOW))?.status).toBe('trialing');
    expect(await lookupProUntil(client, 'x@example.com', NOW)).toBe('2026-10-09T00:00:00.000Z');
    expect(await lookupProUntil(stripe({}), 'x@example.com', NOW)).toBeNull();
  });
});

describe('free trial', () => {
  const stripe = (byCustomer: Record<string, SubscriptionLike[]>) => ({
    customers: { list: async () => ({ data: Object.keys(byCustomer).map((id) => ({ id })) }) },
    subscriptions: { list: async ({ customer }: { customer: string }) => ({ data: byCustomer[customer] }) },
  });

  it('is for accounts that never had Pro', async () => {
    expect(await trialEligible(stripe({}), 'ny@example.com')).toBe(true);
    // A checkout that was never completed doesn't count
    expect(await trialEligible(stripe({ cus_a: [sub('incomplete_expired', null)] }), 'x@example.com')).toBe(true);
    expect(await trialEligible(stripe({ cus_a: [sub('active', null, 'prod_other')] }), 'x@example.com')).toBe(true);
  });

  it('is used once, also after cancelling', async () => {
    expect(await trialEligible(stripe({ cus_a: [], cus_b: [sub('canceled', '2026-01-01T00:00:00Z')] }), 'x@example.com')).toBe(false);
    expect(hadPro([sub('trialing', '2026-10-09T00:00:00Z', 'prod_U0duDYNoEp8JXS')])).toBe(true);
  });

  it('is not offered to accounts with free Pro', async () => {
    expect(await trialEligible(stripe({}), 'kcleijon@gmail.com')).toBe(false);
  });
});

// A pro_status and apple_subscriptions table in memory, as the service role sees them
function fakeDb(apple: { expires_at: string | null }[], proStatus: { pro_until: string | null; checked_at: string } | null) {
  const state = { proStatus };
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: (_c: string, _v: string) => (table === 'apple_subscriptions'
          ? Promise.resolve({ data: apple, error: null })
          : { maybeSingle: async () => ({ data: state.proStatus, error: null }) }),
      }),
      upsert: async (row: { pro_until: string | null; checked_at: string }) => { state.proStatus = { pro_until: row.pro_until, checked_at: row.checked_at }; return { error: null }; },
      update: (patch: { checked_at: string }) => ({ eq: async () => { state.proStatus = { ...state.proStatus!, ...patch }; return { error: null }; } }),
    }),
  };
  return { db, state };
}

describe('Pro through Apple', () => {
  const future = new Date(Date.now() + 10 * 86400000).toISOString();
  const later = new Date(Date.now() + 40 * 86400000).toISOString();

  it('takes the later of two ends', () => {
    expect(laterProUntil(future, later)).toBe(later);
    expect(laterProUntil(null, future)).toBe(future);
    expect(laterProUntil('infinity', later)).toBe('infinity');
    expect(laterProUntil(null, null)).toBeNull();
  });

  it('keeps Apple Pro when Stripe has none', async () => {
    const { db, state } = fakeDb([{ expires_at: future }, { expires_at: null }], null);
    await expect(rememberProStatus(db, 'u1', null)).resolves.toBe(future);
    expect(state.proStatus?.pro_until).toBe(future);
    const both = fakeDb([{ expires_at: future }], null);
    await expect(rememberProStatus(both.db, 'u1', later)).resolves.toBe(later);
  });

  it('adds Apple Pro at once, and has Stripe asked again when Apple gives none', async () => {
    const { db, state } = fakeDb([{ expires_at: later }], { pro_until: future, checked_at: '2026-10-21T00:00:00.000Z' });
    await expect(storeApplePro(db, 'u1')).resolves.toBe(later);
    expect(state.proStatus).toEqual({ pro_until: later, checked_at: '2026-10-21T00:00:00.000Z' });

    const gone = fakeDb([{ expires_at: null }], { pro_until: future, checked_at: '2026-10-21T00:00:00.000Z' });
    await storeApplePro(gone.db, 'u1');
    expect(gone.state.proStatus?.checked_at).toBe(new Date(0).toISOString());
  });
});
