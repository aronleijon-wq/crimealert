import { useCallback, useEffect, useRef, useState } from 'react';

export type BackendHealth = 'checking' | 'up' | 'down';

const HEALTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function probe(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(HEALTH_URL, {
      headers: { apikey: APIKEY },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Polls the backend health endpoint. While the backend is unreachable it
 * retries with exponential backoff so the app recovers automatically
 * (auto "återstart" of the client) as soon as the backend is back.
 */
export function useBackendHealth() {
  const [status, setStatus] = useState<BackendHealth>('checking');
  const [downSince, setDownSince] = useState<number | null>(null);
  const failuresRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    const ok = await probe();
    if (!mountedRef.current) return ok;

    if (ok) {
      failuresRef.current = 0;
      setStatus((prev) => {
        // Backend came back after downtime → reload to re-hydrate all data.
        if (prev === 'down') window.location.reload();
        return 'up';
      });
      setDownSince(null);
    } else {
      failuresRef.current += 1;
      // Two consecutive failures before we declare it down (avoids flicker).
      if (failuresRef.current >= 2) {
        setStatus('down');
        setDownSince((prev) => prev ?? Date.now());
      }
    }
    return ok;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const schedule = () => {
      const failures = failuresRef.current;
      // Healthy: check every 2 min. Down: backoff 5s → 60s max.
      const delay = failures === 0 ? 120000 : Math.min(5000 * 2 ** (failures - 1), 60000);
      timeoutRef.current = window.setTimeout(async () => {
        // Skip while the tab is hidden; onVisibility checks as soon as it is shown again
        if (document.visibilityState !== 'hidden') await check();
        if (mountedRef.current) schedule();
      }, delay);
    };

    check().then(() => {
      if (mountedRef.current) schedule();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    const onOnline = () => check();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [check]);

  return { status, downSince, recheck: check };
}
