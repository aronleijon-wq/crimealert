import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FRESH_PARAM, freshUrl, loadPage, recoverFromStaleBuild, reloadFresh, stripFreshParam } from './staleBuild';

beforeEach(() => sessionStorage.clear());

describe('recoverFromStaleBuild', () => {
  it('drops the offline copy and reloads, once a minute at most', async () => {
    const unregister = vi.fn(async () => true);
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistrations: async () => [{ unregister }] }, configurable: true });
    const deleted: string[] = [];
    vi.stubGlobal('caches', { keys: async () => ['workbox-precache-v2'], delete: async (k: string) => { deleted.push(k); return true; } });
    const reload = vi.fn();

    expect(recoverFromStaleBuild(reload)).toBe(true);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(unregister).toHaveBeenCalled();
    expect(deleted).toEqual(['workbox-precache-v2']);

    // A second failure right after means the files are really missing: show the error instead
    expect(recoverFromStaleBuild(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('still reloads when the browser has no offline support', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const reload = vi.fn();
    await reloadFresh(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('loading fresh', () => {
  it('reloads even when clearing the offline copy never finishes', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistrations: () => new Promise(() => {}) }, configurable: true });
    const reload = vi.fn();
    const done = reloadFresh(reload);
    await vi.advanceTimersByTimeAsync(2900);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('marks the address so no cache hands back the old page, and takes the mark out again', () => {
    const url = new URL(freshUrl('https://crimealert.se/account?tab=x#plan'));
    expect(url.pathname).toBe('/account');
    expect(url.searchParams.get('tab')).toBe('x');
    expect(Number(url.searchParams.get(FRESH_PARAM))).toBeGreaterThan(0);
    expect(url.hash).toBe('#plan');

    window.history.replaceState(null, '', `/account?tab=x&${FRESH_PARAM}=123#plan`);
    stripFreshParam();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/account?tab=x#plan');
  });

  it('shows the error instead of loading forever when the fresh load never comes', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, href: 'https://crimealert.se/account', replace });
    const failure = new Error('Importing a module script failed.');
    const result = loadPage(() => Promise.reject(failure)).then(() => 'loaded', (e) => e);
    await vi.advanceTimersByTimeAsync(3100);
    expect(replace).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toBe(failure);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
