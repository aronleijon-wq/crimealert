import { describe, expect, it } from 'vitest';
import { freeMember, memberFromApple, memberFromInvite, memberFromStripe, mergeMembers, summarizeMembers } from '../../supabase/functions/_shared/members';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const sec = (iso: string) => Date.parse(iso) / 1000;
const joined = new Map([['anna@example.com', '2026-03-01T10:00:00.000Z']]);
const stripe = (over: object) => ({
  status: 'trialing', start_date: sec('2026-11-20T12:00:00Z'), trial_end: sec('2026-12-20T12:00:00Z'), cancel_at_period_end: false,
  customer: { email: 'Anna@example.com' },
  items: { data: [{ current_period_end: sec('2026-12-20T12:00:00Z'), price: { recurring: { interval: 'month' } } }] },
  ...over,
});

describe('Pro members (admin dashboard)', () => {
  it('reads a Stripe trial: who, since when, days left, and whether it will pay', () => {
    const m = memberFromStripe(stripe({}), joined, NOW)!;
    expect(m).toMatchObject({ email: 'anna@example.com', kind: 'trial', plan: 'monthly', joined: '2026-03-01T10:00:00.000Z', daysLeft: 26, renews: true });
    expect(m.proSince).toBe('2026-11-20T12:00:00.000Z');
  });

  it('reads a cancelled trial as one that ends without paying', () => {
    expect(memberFromStripe(stripe({ cancel_at_period_end: true }), joined, NOW)!.renews).toBe(false);
  });

  it('reads a yearly payer up to the next payment, and leaves out ended subscriptions', () => {
    const m = memberFromStripe(stripe({ status: 'active', trial_end: null, items: { data: [{ current_period_end: sec('2027-03-01T00:00:00Z'), price: { recurring: { interval: 'year' } } }] } }), joined, NOW)!;
    expect(m).toMatchObject({ kind: 'paying', plan: 'yearly', daysLeft: 97 });
    expect(memberFromStripe(stripe({ status: 'canceled' }), joined, NOW)).toBeNull();
  });

  it('keeps one row per person, the subscription over invite Pro, trials ending first', () => {
    const rows = mergeMembers([
      freeMember('owner@example.com', null),
      memberFromInvite('anna@example.com', null, '2026-11-30T00:00:00Z', null, NOW),
      memberFromStripe(stripe({}), joined, NOW)!,
      memberFromApple({ email: 'bo@example.com', joined: null, productId: 'crimealert.pro.monthly', expiresAt: '2026-11-26T00:00:00Z', startedAt: '2026-11-19T00:00:00Z', freeTrial: true, autoRenew: true }, NOW),
    ]);
    expect(rows.map((r) => [r.email, r.source])).toEqual([
      ['bo@example.com', 'apple'], ['anna@example.com', 'stripe'], ['owner@example.com', 'free'],
    ]);
    expect(summarizeMembers(rows)).toMatchObject({ total: 3, trials: 2, trialsEndingSoon: 1, free: 1 });
  });
});
