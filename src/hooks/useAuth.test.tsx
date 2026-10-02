import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setVisibility } from '@/test/visibility';

vi.mock('@/integrations/supabase/client', () => {
  const session = { access_token: 'token', user: { id: 'user-1', email: 'pro@example.se' } };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: (callback: (event: string, s: typeof session) => void) => {
          setTimeout(() => callback('INITIAL_SESSION', session), 0);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
    },
  };
});

const MINUTE = 60 * 1000;
let fetchMock: ReturnType<typeof vi.fn>;

// Fresh module per test so the shared subscription check starts empty
const loadAuth = async () => import('./useAuth');
// Several rounds: auth events and checks are chained through timers and promises
const flush = async () => {
  for (let i = 0; i < 5; i++) await act(() => vi.advanceTimersByTimeAsync(1));
};
const subscriptionCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('check-subscription')).length;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  setVisibility('visible');
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ subscribed: true, product_id: 'prod_U0dsMg8IZZKY7c', subscription_end: null })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AuthProvider subscription checks', () => {
  it('calls check-subscription once for the app and a map popup opened right after', async () => {
    const { AuthProvider, useAuth } = await loadAuth();
    const app = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();
    const popup = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    expect(subscriptionCalls()).toBe(1);
    expect(app.result.current.subscription.subscribed).toBe(true);
    expect(popup.result.current.subscription.subscribed).toBe(true);
  });

  it('always asks the server when checkSubscription is called explicitly (e.g. after checkout)', async () => {
    const { AuthProvider, useAuth } = await loadAuth();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    await act(() => result.current.checkSubscription());
    await act(() => result.current.checkSubscription());

    expect(subscriptionCalls()).toBe(3);
  });

  it('does not reuse a failed check', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('', { status: 503 }));
    const { AuthProvider, useAuth } = await loadAuth();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    expect(subscriptionCalls()).toBe(2);
    expect(result.current.subscription.subscribed).toBe(true);
  });

  it('reports when the subscription is known, so ads wait for it', async () => {
    let answer: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { answer = resolve; }));
    const { AuthProvider, useAuth } = await loadAuth();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();
    expect(result.current.user).not.toBeNull();
    expect(result.current.subscriptionChecked).toBe(false);

    answer(new Response(JSON.stringify({ subscribed: false })));
    await flush();
    expect(result.current.subscriptionChecked).toBe(true);
  });

  it('treats a failed check as unknown', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 503 }));
    const { AuthProvider, useAuth } = await loadAuth();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();
    expect(result.current.subscriptionChecked).toBe(false);
  });

  it('skips the 30-minute refresh while hidden and refreshes when shown again', async () => {
    const { AuthProvider, useAuth } = await loadAuth();
    renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();
    expect(subscriptionCalls()).toBe(1);

    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(90 * MINUTE));
    expect(subscriptionCalls()).toBe(1);

    await act(async () => setVisibility('visible'));
    await flush();
    expect(subscriptionCalls()).toBe(2);
  });

  it('refreshes every 30 minutes while visible', async () => {
    const { AuthProvider, useAuth } = await loadAuth();
    renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    await act(() => vi.advanceTimersByTimeAsync(60 * MINUTE));

    expect(subscriptionCalls()).toBe(3);
  });
});
