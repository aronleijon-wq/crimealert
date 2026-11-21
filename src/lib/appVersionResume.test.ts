import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./staleBuild', () => ({ reloadFresh: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('coming back to the iPhone app', () => {
  it('asks whether a newer version is live when the app says it is back', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('__BUILD_ID__', 'old');
    const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify({ build: 'new' }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const { watchForNewVersion, APP_RESUMED } = await import('./appVersion');
    const { reloadFresh } = await import('./staleBuild');

    watchForNewVersion();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    sessionStorage.clear();

    // Back after a while in the background
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    document.dispatchEvent(new Event(APP_RESUMED));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toMatch(/^\/version\.json\?t=/);
    expect(reloadFresh).toHaveBeenCalled();
  });
});
