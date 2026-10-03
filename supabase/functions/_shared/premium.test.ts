import { describe, it, expect } from 'vitest';
import { bestValidSubscription, findSubscription, isFresh, lookupProUntil, proUntilActive, proUntilFor, type SubscriptionLike } from './premium';

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
