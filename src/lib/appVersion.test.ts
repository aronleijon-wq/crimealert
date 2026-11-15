import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ID, checkForNewVersion, liveBuild, reloadWhenSafe } from './appVersion';

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

afterEach(() => sessionStorage.clear());

describe('liveBuild', () => {
  it('reads the live build and asks past every cache', async () => {
    const fetcher = reply(200, { build: 'abc' });
    expect(await liveBuild(fetcher)).toBe('abc');
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toMatch(/^\/version\.json\?t=\d+$/);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('gives null when the file is missing or wrong', async () => {
    expect(await liveBuild(reply(404, {}))).toBeNull();
    expect(await liveBuild(reply(200, { build: 3 }))).toBeNull();
    expect(await liveBuild(vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
});

describe('checkForNewVersion', () => {
  it('reloads when a newer build is live, but only once per build in a visit', async () => {
    const reload = vi.fn();
    expect(await checkForNewVersion(reply(200, { build: 'newer' }), reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await checkForNewVersion(reply(200, { build: 'newer' }), reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing when this is the live build or the server can not be reached', async () => {
    const reload = vi.fn();
    expect(await checkForNewVersion(reply(200, { build: BUILD_ID }), reload)).toBe(false);
    expect(await checkForNewVersion(reply(500, {}), reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('reloadWhenSafe', () => {
  it('reloads at once on a page that has just opened', () => {
    const reload = vi.fn();
    reloadWhenSafe(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the visitor leaves a page that has been open a while', () => {
    const reload = vi.fn();
    let state: DocumentVisibilityState = 'visible';
    const doc = Object.defineProperty(new EventTarget(), 'visibilityState', { get: () => state }) as unknown as Document;
    reloadWhenSafe(reload, Date.now() + 60 * 60 * 1000, doc);
    expect(reload).not.toHaveBeenCalled();
    state = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
