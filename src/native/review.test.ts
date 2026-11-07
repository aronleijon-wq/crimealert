import { describe, it, expect } from 'vitest';
import { ASK_EVERY_MS, shouldAsk, withUse, type ReviewState } from './review';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 7, 12);

describe('asking for a rating', () => {
  it('counts each day once', () => {
    let state: ReviewState = { days: [], moments: 0, askedAt: null };
    state = withUse(withUse(state, NOW), NOW + 60_000);
    state = withUse(state, NOW + DAY);
    expect(state.days).toEqual(['2026-11-07', '2026-11-08']);
  });

  it('asks only those who come back, and then rarely', () => {
    const regular: ReviewState = { days: ['2026-11-01', '2026-11-03', '2026-11-07'], moments: 3, askedAt: null };
    expect(shouldAsk(regular, NOW)).toBe(true);
    expect(shouldAsk({ ...regular, days: regular.days.slice(1) }, NOW)).toBe(false);
    expect(shouldAsk({ ...regular, moments: 2 }, NOW)).toBe(false);
    expect(shouldAsk({ ...regular, askedAt: NOW - 30 * DAY }, NOW)).toBe(false);
    expect(shouldAsk({ ...regular, askedAt: NOW - ASK_EVERY_MS }, NOW)).toBe(true);
  });
});
