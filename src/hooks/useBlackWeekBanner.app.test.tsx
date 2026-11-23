import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// The iPhone app: the trial is Apple's to give, whatever the account did on the web
const auth: { user: { id: string } | null; subscription: { trialEligible?: boolean; firstTrial?: boolean } } = { user: null, subscription: {} };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/native', () => ({ isNativeApp: () => true, canSellPro: () => true }));
const apple = { trial: null as string | null };
vi.mock('@/lib/appStore', async (load) => ({ ...(await load<typeof import('@/lib/appStore')>()), appleTrial: async () => apple.trial }));

const { useBlackWeekBanner } = await import('./useBlackWeekBanner');
const MON = Date.parse('2026-11-23T20:00:00+01:00');

beforeEach(() => { localStorage.clear(); auth.user = { id: 'u1' }; auth.subscription = { trialEligible: true, firstTrial: false }; apple.trial = null; });

describe('Black Week in the app', () => {
  it('offers the trial when Apple gives this Apple ID one, though the account had Pro on the web', async () => {
    apple.trial = '1 month';
    const { result } = renderHook(() => useBlackWeekBanner(MON));
    await waitFor(() => expect(result.current.offer).toBe('trial'));
    expect(result.current.trialLength).toBe('1 månad');
  });

  it('says the length Apple gives, not 30 days, when App Store Connect still says a week', async () => {
    apple.trial = '1 week';
    const { result } = renderHook(() => useBlackWeekBanner(MON));
    await waitFor(() => expect(result.current.trialLength).toBe('1 vecka'));
  });

  it('offers the Black Week code when Apple gives this Apple ID no second trial, and nothing while it asks', async () => {
    const { result } = renderHook(() => useBlackWeekBanner(MON));
    expect(result.current.visible).toBe(false);
    await waitFor(() => expect(result.current.offer).toBe('code'));
    expect(result.current.trialLength).toBe('1 månad');
  });

  it('shows nothing to those who have Pro now', async () => {
    apple.trial = '1 month';
    auth.subscription = { subscribed: true } as typeof auth.subscription;
    const { result } = renderHook(() => useBlackWeekBanner(MON));
    await waitFor(() => expect(result.current.offer).toBeNull());
    expect(result.current.visible).toBe(false);
  });
});
