import { describe, it, expect } from 'vitest';
import { pickPrice, planFromRequest, type PriceLike } from './stripePlans';

const price = (id: string, created: number, extra: Partial<PriceLike> = {}): PriceLike => ({
  id, created, active: true, recurring: { interval: 'year' }, ...extra,
});

describe('planFromRequest', () => {
  it('accepts the two plans', () => {
    expect(planFromRequest({ plan: 'monthly' })).toBe('monthly');
    expect(planFromRequest({ plan: 'yearly', priceId: 'price_whatever' })).toBe('yearly');
  });

  it('maps the price ids older app versions send', () => {
    expect(planFromRequest({ priceId: 'price_1T2caOC5T1wZbLBJxntsUCrz' })).toBe('monthly');
    expect(planFromRequest({ priceId: 'price_1T2cciC5T1wZbLBJfPgzHr4v' })).toBe('yearly');
  });

  it('refuses any other price', () => {
    expect(planFromRequest({ priceId: 'price_cheap_or_test' })).toBeNull();
    expect(planFromRequest({ priceId: 'toString' })).toBeNull();
    expect(planFromRequest({ plan: 'lifetime' })).toBeNull();
    expect(planFromRequest(null)).toBeNull();
  });
});

describe('pickPrice', () => {
  it('takes the newest active yearly price', () => {
    const prices = [
      price('price_old_119', 100),
      price('price_new_159', 200),
      price('price_archived', 300, { active: false }),
      price('price_monthly', 400, { recurring: { interval: 'month' } }),
      price('price_one_off', 500, { recurring: null }),
    ];
    expect(pickPrice(prices, 'yearly')?.id).toBe('price_new_159');
    expect(pickPrice(prices, 'monthly')?.id).toBe('price_monthly');
  });

  it('finds nothing when the product has no active price', () => {
    expect(pickPrice([price('price_archived', 1, { active: false })], 'yearly')).toBeNull();
  });
});
