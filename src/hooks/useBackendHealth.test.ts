import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setVisibility } from '@/test/visibility';
import { useBackendHealth } from './useBackendHealth';

const MINUTE = 60 * 1000;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useBackendHealth', () => {
  it('probes every 2 minutes while visible', async () => {
    renderHook(() => useBackendHealth());
    await act(() => vi.advanceTimersByTimeAsync(4 * MINUTE));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not probe while hidden, and probes again when shown', async () => {
    const { result } = renderHook(() => useBackendHealth());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(20 * MINUTE));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('up');
  });
});
