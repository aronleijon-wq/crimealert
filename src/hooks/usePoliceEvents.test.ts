import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setVisibility } from '@/test/visibility';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

const MINUTE = 60 * 1000;

const event = (id: string) => ({
  id, type: 'police', title: 'Rån', description: '', lat: 59.3, lng: 18.0, area: 'Stockholm',
  time: '2026-02-18 10:00:00 +01:00', source: 'Polisen.se', location_precision: 'area',
});

let fetchMock: ReturnType<typeof vi.fn>;

// Fresh module per test so the shared cache starts empty
const loadHook = async () => (await import('./usePoliceEvents')).usePoliceEvents;
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setVisibility('visible');
  let n = 0;
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [event(`pol-${++n}`)] })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePoliceEvents', () => {
  it('reuses data fetched by another page instead of calling the edge function again', async () => {
    const usePoliceEvents = await loadHook();
    const first = renderHook(() => usePoliceEvents());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(2 * MINUTE));
    const second = renderHook(() => usePoliceEvents());
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.result.current.incidents.map((i) => i.id)).toEqual(['pol-1']);
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.updatedAt).toBe(first.result.current.updatedAt);
  });

  it('refreshes reused data when it turns 5 minutes old, not 5 minutes after the page opened', async () => {
    const usePoliceEvents = await loadHook();
    const first = renderHook(() => usePoliceEvents());
    await flush();

    await act(() => vi.advanceTimersByTimeAsync(3 * MINUTE));
    first.unmount();
    const second = renderHook(() => usePoliceEvents());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(2 * MINUTE));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.result.current.incidents.map((i) => i.id)).toEqual(['pol-2']);
  });

  it('keeps polling every 5 minutes in a hidden tab, since that drives archiving and push', async () => {
    const usePoliceEvents = await loadHook();
    renderHook(() => usePoliceEvents());
    await flush();

    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(10 * MINUTE));

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('always fetches on manual refresh', async () => {
    const usePoliceEvents = await loadHook();
    const { result } = renderHook(() => usePoliceEvents());
    await flush();

    await act(() => result.current.refetch());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.incidents.map((i) => i.id)).toEqual(['pol-2']);
  });

  it('does not reuse a failed response', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('', { status: 500 }));
    const usePoliceEvents = await loadHook();
    const first = renderHook(() => usePoliceEvents());
    await flush();
    expect(first.result.current.error).toBe('HTTP 500');

    renderHook(() => usePoliceEvents());
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
