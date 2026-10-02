import { describe, it, expect, vi } from 'vitest';
import { createSnapshotCache } from './snapshotCache';

describe('createSnapshotCache', () => {
  it('returns a snapshot only while it is fresh and for the same key', async () => {
    const cache = createSnapshotCache<string[]>();
    const snapshot = await cache.load('user-1', async () => ['a']);

    expect(cache.fresh('user-1', 1000, snapshot.fetchedAt + 999)?.data).toEqual(['a']);
    expect(cache.fresh('user-1', 1000, snapshot.fetchedAt + 1000)).toBeNull();
    expect(cache.fresh('anon', 1000, snapshot.fetchedAt)).toBeNull();
  });

  it('shares one request between concurrent callers with the same key', async () => {
    const cache = createSnapshotCache<number>();
    const fetcher = vi.fn(async () => 42);

    const [a, b] = await Promise.all([cache.load('k', fetcher), cache.load('k', fetcher)]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('does not share requests across keys', async () => {
    const cache = createSnapshotCache<string>();
    const fetcher = vi.fn(async () => 'x');

    await Promise.all([cache.load('anon', fetcher), cache.load('user-1', fetcher)]);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous snapshot when a request fails, and allows a retry', async () => {
    const cache = createSnapshotCache<string>();
    const first = await cache.load('k', async () => 'ok');

    await expect(cache.load('k', async () => { throw new Error('HTTP 500'); })).rejects.toThrow('HTTP 500');
    expect(cache.fresh('k', 60_000, first.fetchedAt)?.data).toBe('ok');

    await expect(cache.load('k', async () => 'retried')).resolves.toMatchObject({ data: 'retried' });
  });
});
