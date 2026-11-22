import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMyLocation } from './useMyLocation';

type Ok = (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Fail = (e: { code: number; PERMISSION_DENIED: number }) => void;

function fakeGeolocation() {
  const calls: { ok: Ok; fail: Fail }[] = [];
  const geo = { watchPosition: vi.fn((ok: Ok, fail: Fail) => { calls.push({ ok, fail }); return calls.length; }), clearWatch: vi.fn() };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  return { geo, calls };
}

afterEach(() => { Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }); });

describe('useMyLocation', () => {
  it('asks nothing until started, then follows the position and flies there once', () => {
    const { geo, calls } = fakeGeolocation();
    const onFirst = vi.fn();
    const { result } = renderHook(() => useMyLocation(onFirst));
    expect(geo.watchPosition).not.toHaveBeenCalled();
    expect(result.current.status).toBe('off');

    act(() => result.current.start());
    expect(result.current.status).toBe('locating');
    act(() => calls[0].ok({ coords: { latitude: 59.3, longitude: 18.0, accuracy: 25 } }));
    expect(result.current.position).toEqual({ lat: 59.3, lng: 18.0, accuracy: 25 });
    expect(result.current.status).toBe('on');
    act(() => calls[0].ok({ coords: { latitude: 59.31, longitude: 18.01, accuracy: 12 } }));
    expect(result.current.position?.lat).toBe(59.31);
    expect(onFirst).toHaveBeenCalledTimes(1);

    // A second start doesn't watch twice
    act(() => result.current.start());
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('says when the visitor has turned the location off', () => {
    const { calls, geo } = fakeGeolocation();
    const { result } = renderHook(() => useMyLocation());
    act(() => result.current.start());
    act(() => calls[0].fail({ code: 1, PERMISSION_DENIED: 1 }));
    expect(result.current.status).toBe('denied');
    expect(result.current.position).toBeNull();
    expect(geo.clearWatch).toHaveBeenCalled();
  });

  it('says when the device has no location at all', () => {
    const { result } = renderHook(() => useMyLocation());
    act(() => result.current.start());
    expect(result.current.status).toBe('unavailable');
  });
});
