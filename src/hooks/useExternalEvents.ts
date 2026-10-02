import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import type { ExternalEvent } from '@/lib/externalEvents';
import { createSnapshotCache } from '@/lib/snapshotCache';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Shared by the map and the feed
const externalEventsCache = createSnapshotCache<ExternalEvent[]>();

// VMA, Krisinformation and news. Trafikverket comes live from trafikverket-events instead.
async function requestExternalEvents(): Promise<ExternalEvent[]> {
  const { data, error } = await supabase
    .from('external_events')
    // All columns, so this keeps working whether or not the image columns have been added yet
    .select('*')
    .in('kind', ['vma', 'crisis', 'news'])
    .gte('published_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    .order('published_at', { ascending: false })
    .limit(400);
  if (error) throw error;
  return (data ?? []) as ExternalEvent[];
}

/** Events collected by ingest-sources. Read-only, so polling pauses in hidden tabs. */
export function useExternalEvents() {
  const [initial] = useState(() => externalEventsCache.fresh('all', POLL_INTERVAL_MS));
  const [events, setEvents] = useState<ExternalEvent[]>(initial?.data ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(initial?.fetchedAt ?? 0);

  const fetchEvents = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < POLL_INTERVAL_MS) return;
    lastFetch.current = Date.now();
    try {
      const snapshot = await externalEventsCache.load('all', requestExternalEvents);
      setEvents(snapshot.data);
      setError(null);
    } catch (err) {
      // E.g. before the external_events migration has been applied; the app works without it
      console.warn('Could not load external events:', getErrorMessage(err));
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initial) fetchEvents();

    const poll = () => {
      if (document.visibilityState !== 'hidden') fetchEvents();
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    const firstDelay = initial ? Math.max(POLL_INTERVAL_MS - (Date.now() - initial.fetchedAt), 0) : POLL_INTERVAL_MS;
    const firstPoll = setTimeout(() => {
      poll();
      interval = setInterval(poll, POLL_INTERVAL_MS);
    }, firstDelay);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchEvents();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(firstPoll);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchEvents, initial]);

  return { events, loading, error, refetch: () => fetchEvents(true) };
}
