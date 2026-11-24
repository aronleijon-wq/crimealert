import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const auth: { user: { id: string } | null; subscription: { trialEligible?: boolean }; subscriptionChecked: boolean } = { user: null, subscription: {}, subscriptionChecked: false };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
const { useTrialOffer } = await import('./useTrialOffer');

const BLACK_WEEK = Date.parse('2026-11-24T10:00:00+01:00');
const DECEMBER = Date.parse('2026-12-05T10:00:00+01:00');
const offer = (now: number) => renderHook(() => useTrialOffer(now)).result.current;

describe('the free trial offer', () => {
  it('shows to those signed out', () => {
    auth.user = null;
    expect(offer(DECEMBER)).toBe(true);
  });

  it('shows at once during Black Week while the account is checked, so the text never changes', () => {
    auth.user = { id: 'u' }; auth.subscription = {}; auth.subscriptionChecked = false;
    expect(offer(BLACK_WEEK)).toBe(true);
    expect(offer(DECEMBER)).toBe(false);
  });

  it('follows the check once it is in', () => {
    auth.user = { id: 'u' }; auth.subscriptionChecked = true;
    auth.subscription = { trialEligible: false };
    expect(offer(BLACK_WEEK)).toBe(false);
    auth.subscription = { trialEligible: true };
    expect(offer(DECEMBER)).toBe(true);
  });
});
