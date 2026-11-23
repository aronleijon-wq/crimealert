import { describe, it, expect } from 'vitest';
import { fromApple, fromStripe, lifeFromStripe, payingByMonth, summarize, type StripeSubLike, type SubLife } from "../../supabase/functions/_shared/revenue";

const NOW = Date.UTC(2026, 10, 15);
const DAY = 86_400_000;
const sec = (ms: number) => Math.floor(ms / 1000);
const stripe = (over: Partial<StripeSubLike> = {}, interval = 'month', amount = 1900): StripeSubLike => ({
  status: 'active', currency: 'sek', start_date: sec(NOW - 60 * DAY),
  items: { data: [{ quantity: 1, price: { unit_amount: amount, currency: 'sek', recurring: { interval, interval_count: 1 } } }] },
  ...over,
});

describe('Stripe subscriptions as revenue', () => {
  it('counts a monthly price in full and a twelfth of a yearly one', () => {
    expect(fromStripe(stripe())).toMatchObject({ plan: 'monthly', monthlyMinor: 1900, state: 'paying', ending: false });
    expect(fromStripe(stripe({}, 'year', 19900))).toMatchObject({ plan: 'yearly', monthlyMinor: 1658 });
  });

  it('keeps trials, failed payments and endings apart, and leaves out the cancelled', () => {
    expect(fromStripe(stripe({ status: 'trialing' }))?.state).toBe('trial');
    expect(fromStripe(stripe({ status: 'past_due' }))?.state).toBe('past_due');
    expect(fromStripe(stripe({ cancel_at_period_end: true }))?.ending).toBe(true);
    expect(fromStripe(stripe({ status: 'canceled' }))).toBeNull();
    expect(fromStripe(stripe({ status: 'incomplete_expired' }))).toBeNull();
  });

  it('takes off discounts', () => {
    expect(fromStripe(stripe({ discounts: [{ coupon: { percent_off: 50 } }] }))?.monthlyMinor).toBe(950);
    expect(fromStripe(stripe({ discounts: [{ source: { coupon: { amount_off: 900 } } }] }))?.monthlyMinor).toBe(1000);
  });
});

describe('Apple subscriptions as revenue', () => {
  const base = { productId: 'crimealert.pro.monthly', priceMilli: 19000, renewalPriceMilli: 19000, currency: 'SEK', autoRenew: true, freeTrial: false, expiresAt: '2026-12-01T00:00:00Z', startedAt: null };
  it('counts the price Apple charges', () => {
    expect(fromApple(base)).toMatchObject({ source: 'apple', monthlyMinor: 1900, currency: 'sek', state: 'paying', ending: false });
    expect(fromApple({ ...base, productId: 'crimealert.pro.yearly', priceMilli: 199000 })?.monthlyMinor).toBe(1658);
  });
  it('counts a trial at its coming price, and none when it gives no Pro', () => {
    expect(fromApple({ ...base, priceMilli: 0, freeTrial: true })).toMatchObject({ state: 'trial', monthlyMinor: 1900 });
    expect(fromApple({ ...base, autoRenew: false })?.ending).toBe(true);
    expect(fromApple({ ...base, expiresAt: null })).toBeNull();
  });
});

describe('MRR', () => {
  it('adds up Stripe and Apple, and keeps trials and other currencies out of it', () => {
    const subs = [
      fromStripe(stripe())!,
      fromStripe(stripe({ start_date: sec(NOW - 3 * DAY) }, 'year', 19900))!,
      fromStripe(stripe({ status: 'trialing' }))!,
      fromStripe(stripe({ cancel_at_period_end: true }))!,
      fromApple({ productId: 'crimealert.pro.monthly', priceMilli: 19000, renewalPriceMilli: 19000, currency: 'SEK', autoRenew: true, freeTrial: false, expiresAt: 'x', startedAt: null })!,
      fromApple({ productId: 'crimealert.pro.monthly', priceMilli: 1990, renewalPriceMilli: 1990, currency: 'EUR', autoRenew: true, freeTrial: false, expiresAt: 'x', startedAt: null })!,
    ];
    const s = summarize(subs, NOW);
    expect(s.stripe).toMatchObject({ mrr: 1900 + 1658 + 1900, paying: 3, monthly: 2, yearly: 1, trials: 1, trialMrr: 1900, ending: 1, endingMrr: 1900 });
    expect(s.apple).toMatchObject({ mrr: 1900, paying: 1 });
    expect(s.mrr).toBe(1900 + 1658 + 1900 + 1900);
    expect(s.arr).toBe(s.mrr * 12);
    expect(s.newLast30).toBe(1);
    expect(s.otherCurrencies).toEqual([{ currency: 'eur', count: 1, mrr: 199 }]);
    // After moms, and Stripe's or Apple's fee
    expect(s.netMrr).toBeGreaterThan(s.mrr * 0.6);
    expect(s.netMrr).toBeLessThan(s.mrr * 0.8);
  });
});

describe('paying customers month by month', () => {
  const at = (iso: string) => Date.parse(iso);
  const now = at('2026-11-23T12:00:00Z');

  it('counts each subscription in the months it paid, a trial apart, the current month up to now', () => {
    const lives: SubLife[] = [
      // Monthly from August, still running
      { source: 'stripe', plan: 'monthly', start: at('2026-08-10T00:00:00Z'), end: null, trialEnd: at('2026-08-17T00:00:00Z') },
      // Yearly from October
      { source: 'apple', plan: 'yearly', start: at('2026-10-02T00:00:00Z'), end: null, trialEnd: null },
      // Monthly, cancelled in mid-October
      { source: 'stripe', plan: 'monthly', start: at('2026-09-01T00:00:00Z'), end: at('2026-10-15T00:00:00Z'), trialEnd: null },
      // In its 30-day Black Week trial now
      { source: 'stripe', plan: 'monthly', start: at('2026-11-23T10:00:00Z'), end: null, trialEnd: at('2026-12-23T10:00:00Z') },
    ];
    const months = payingByMonth(lives, now, 5);
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(months.map((m) => [m.monthly, m.yearly, m.trials])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ]);
  });

  it('reads a Stripe subscription\'s life, and leaves out one that never started', () => {
    const sub = { status: 'canceled', start_date: 1_700_000_000, ended_at: 1_702_000_000, trial_end: 1_700_600_000, items: { data: [{ price: { unit_amount: 1900, recurring: { interval: 'month' } } }] } };
    expect(lifeFromStripe(sub)).toEqual({ source: 'stripe', plan: 'monthly', start: 1_700_000_000_000, end: 1_702_000_000_000, trialEnd: 1_700_600_000_000 });
    expect(lifeFromStripe({ ...sub, status: 'incomplete_expired' })).toBeNull();
  });
});
