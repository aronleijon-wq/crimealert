import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recoverFromStaleBuild, reloadFresh } from './staleBuild';

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
