import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ANSWER, BUILD_ID, BUILD_QUESTION, checkForNewVersion, followServiceWorkerUpdates, isTyping, liveBuild, reloadWhenSafe } from './appVersion';

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
  afterEach(() => { document.body.innerHTML = ''; });

  it('reloads at once when the visitor is not typing, however long the page has been open', () => {
    const reload = vi.fn();
    reloadWhenSafe(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits while the visitor is typing, and reloads when they leave the field', async () => {
    document.body.innerHTML = '<textarea></textarea><button>ok</button>';
    const field = document.querySelector('textarea')!;
    field.value = 'Jag såg en bil som';
    field.focus();
    expect(isTyping()).toBe(true);
    const reload = vi.fn();
    reloadWhenSafe(reload);
    expect(reload).not.toHaveBeenCalled();
    field.blur();
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not count an empty field or a button as typing', () => {
    document.body.innerHTML = '<input type="text"><input type="checkbox">';
    (document.querySelector('input[type=text]') as HTMLInputElement).focus();
    expect(isTyping()).toBe(false);
    (document.querySelector('input[type=checkbox]') as HTMLInputElement).focus();
    expect(isTyping()).toBe(false);
  });
});

describe('answering the service worker', () => {
  it('tells it which build this page runs', () => {
    const sw = new EventTarget() as unknown as ServiceWorkerContainer;
    Object.assign(sw, { controller: null, startMessages: vi.fn() });
    followServiceWorkerUpdates(sw);
    const source = { postMessage: vi.fn() };
    // jsdom's MessageEvent can't carry a ServiceWorker as source; it is set by hand
    const event = new MessageEvent('message', { data: { type: BUILD_QUESTION } });
    Object.defineProperty(event, 'source', { value: source });
    sw.dispatchEvent(event);
    expect(source.postMessage).toHaveBeenCalledWith({ type: BUILD_ANSWER, build: BUILD_ID });
    expect(sw.startMessages).toHaveBeenCalled();
  });
});
