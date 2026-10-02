import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setVisibility } from '@/test/visibility';

const MINUTE = 60 * 1000;
let fetchMock: ReturnType<typeof vi.fn>;

const loadHook = async () => (await import('./useTrafikverketEvents')).useTrafikverketEvents;
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  setVisibility('visible');
  fetchMock = vi.fn(async () => new Response(JSON.stringify({
    success: true,
    data: [{ id: 'tv-1', type: 'trafikverket', title: 'E4 — Olycka', description: '', lat: 59.3, lng: 18.0, area: 'E4', time: new Date().toISOString(), endTime: null }],
  })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useTrafikverketEvents', () => {
  it('polls every 5 minutes while the tab is visible', async () => {
    const useTrafikverketEvents = await loadHook();
    const { result } = renderHook(() => useTrafikverketEvents());
    await flush();
    expect(result.current.incidents.map((i) => i.id)).toEqual(['tv-1']);

    await act(() => vi.advanceTimersByTimeAsync(10 * MINUTE));

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('skips polls while hidden and refreshes as soon as the tab is shown again', async () => {
    const useTrafikverketEvents = await loadHook();
    renderHook(() => useTrafikverketEvents());
    await flush();

    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(30 * MINUTE));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refetch when shown again within 5 minutes of the last fetch', async () => {
    const useTrafikverketEvents = await loadHook();
    renderHook(() => useTrafikverketEvents());
    await flush();

    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(2 * MINUTE));
    await act(async () => setVisibility('visible'));
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the last response when the map is opened again within 5 minutes', async () => {
    const useTrafikverketEvents = await loadHook();
    const first = renderHook(() => useTrafikverketEvents());
    await flush();
    first.unmount();

    await act(() => vi.advanceTimersByTimeAsync(MINUTE));
    const second = renderHook(() => useTrafikverketEvents());
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.result.current.incidents.map((i) => i.id)).toEqual(['tv-1']);
  });
});
