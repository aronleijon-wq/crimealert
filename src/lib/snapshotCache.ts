export interface Snapshot<T> {
  key: string;
  data: T;
  fetchedAt: number;
}

/**
 * Keeps the latest response of a data source in memory so every page can reuse it,
 * and lets concurrent requests for the same key share one network call.
 * The key separates responses that differ per user (e.g. free vs premium data).
 */
export function createSnapshotCache<T>() {
  let latest: Snapshot<T> | null = null;
  let inFlight: { key: string; promise: Promise<Snapshot<T>> } | null = null;

  return {
    /** The latest snapshot for `key` if it is younger than `maxAgeMs`, else null. */
    fresh(key: string, maxAgeMs: number, now = Date.now()): Snapshot<T> | null {
      return latest && latest.key === key && now - latest.fetchedAt < maxAgeMs ? latest : null;
    },

    /** Runs `fetcher` and stores the result, or joins a request for `key` that is already running. */
    load(key: string, fetcher: () => Promise<T>): Promise<Snapshot<T>> {
      if (inFlight?.key === key) return inFlight.promise;
      const promise = fetcher().then((data) => (latest = { key, data, fetchedAt: Date.now() }));
      inFlight = { key, promise };
      promise
        .finally(() => {
          if (inFlight?.promise === promise) inFlight = null;
        })
        .catch(() => { /* the caller handles the rejection */ });
      return promise;
    },
  };
}
