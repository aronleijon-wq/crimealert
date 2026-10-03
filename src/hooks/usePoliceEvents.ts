import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { createSnapshotCache } from '@/lib/snapshotCache';

// Shape of one event as returned by the police-events edge function
interface PoliceEventDto {
  id: string;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  area: string;
  time: string;
  status?: string;
  risk?: string;
  source: string;
  url?: string | null;
  originalType?: string | null;
  location_precision?: string | null;
}

interface PoliceEventsResponse {
  success?: boolean;
  data?: PoliceEventDto[];
  error?: string;
  /** When the server last got an answer from Polisen */
  fetchedAt?: string | null;
  /** Polisen didn't answer; these are the last known events */
  stale?: boolean;
}

// Whether the police data is being updated, from the latest response, for the notice under the header
export interface PoliceSourceStatus {
  fetchedAt: number | null;
  stale: boolean;
}
let sourceStatus: PoliceSourceStatus = { fetchedAt: null, stale: false };
const sourceListeners = new Set<() => void>();
const setSourceStatus = (next: PoliceSourceStatus) => {
  if (next.fetchedAt === sourceStatus.fetchedAt && next.stale === sourceStatus.stale) return;
  sourceStatus = next;
  sourceListeners.forEach((listener) => listener());
};
export function usePoliceSourceStatus(): PoliceSourceStatus {
  return useSyncExternalStore(
    (listener) => { sourceListeners.add(listener); return () => sourceListeners.delete(listener); },
    () => sourceStatus,
  );
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const ANON_KEY = 'anon';

// Shared by every page using this hook, so moving between Karta, Analys and Notiser
// reuses the latest response instead of calling the edge function again.
// Keyed by user because the server returns delayed data to free users.
const policeEventsCache = createSnapshotCache<Incident[]>();

async function requestPoliceEvents(accessToken?: string): Promise<Incident[]> {
  // Session token lets the server do its own premium check
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/police-events`, {
    headers: { Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: PoliceEventsResponse = await response.json();
  if (!data?.success || !data.data) throw new Error(data?.error || 'Failed to fetch events');
  const fetchedAt = data.fetchedAt ? Date.parse(data.fetchedAt) : NaN;
  setSourceStatus({ fetchedAt: Number.isNaN(fetchedAt) ? null : fetchedAt, stale: data.stale === true });

  const mapped: Incident[] = data.data.map((e) => ({
    id: e.id,
    type: e.type as IncidentType,
    title: e.title,
    description: e.description,
    lat: e.lat,
    lng: e.lng,
    area: e.area,
    time: e.time,
    status: (e.status || 'active') as 'active' | 'resolved',
    risk: (e.risk || 'low') as RiskLevel,
    source: e.source,
    approximate: e.location_precision !== 'exact' && e.location_precision !== 'street',
    url: e.url || undefined,
    originalType: e.originalType || undefined,
    locationPrecision: e.location_precision || undefined,
  }));
  // Sort by timestamp descending (newest first)
  mapped.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return mapped;
}

/** `quiet` skips the error toast, for pages where the data is only decoration (the landing page). */
export function usePoliceEvents({ quiet = false }: { quiet?: boolean } = {}) {
  const { user } = useAuth();
  // Data another page fetched less than one poll interval ago
  const [initial] = useState(() => policeEventsCache.fresh(user?.id ?? ANON_KEY, POLL_INTERVAL_MS));
  const [incidents, setIncidents] = useState<Incident[]>(initial?.data ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(initial?.fetchedAt ?? null);
  const [seenIds] = useState(() => new Set(initial?.data.map((inc) => inc.id)));
  const [totalEverSeen, setTotalEverSeen] = useState(seenIds.size);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  const lastFetch = useRef(initial?.fetchedAt ?? 0);

  const fetchEvents = useCallback(async (silent = false, force = false) => {
    // Throttle: don't fetch more than once per 5 min (unless forced)
    if (!force && Date.now() - lastFetch.current < POLL_INTERVAL_MS) return;
    lastFetch.current = Date.now();

    if (!silent) setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const snapshot = await policeEventsCache.load(session?.user?.id ?? ANON_KEY, () =>
        requestPoliceEvents(session?.access_token)
      );
      setIncidents(snapshot.data);
      setUpdatedAt(snapshot.fetchedAt);
      // Track cumulative unique incidents (only increases)
      snapshot.data.forEach((inc) => seenIds.add(inc.id));
      setTotalEverSeen(seenIds.size);
      setDataVersion((v) => v + 1);
    } catch (err) {
      console.error('Error fetching police events:', err);
      setError(getErrorMessage(err));
      if (!silent && !quietRef.current) {
        toastRef.current({
          title: 'Kunde inte hämta data',
          description: 'Använder demo-data. Försök igen senare.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [seenIds]);

  useEffect(() => {
    if (!initial) fetchEvents();

    // Poll every 5 minutes. When reusing another page's data, the first poll comes when
    // that data turns 5 minutes old, so it is never older than with a fetch on mount.
    // Polling continues in background tabs: these requests are what let police-events
    // archive new events and send push notifications.
    let interval: ReturnType<typeof setInterval> | undefined;
    const firstDelay = initial ? Math.max(POLL_INTERVAL_MS - (Date.now() - initial.fetchedAt), 0) : POLL_INTERVAL_MS;
    const firstPoll = setTimeout(() => {
      fetchEvents(true);
      interval = setInterval(() => fetchEvents(true), POLL_INTERVAL_MS);
    }, firstDelay);

    // On visibility change, only refetch if throttle allows (5 min gap enforced by fetchEvents)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchEvents(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(firstPoll);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchEvents, initial]);

  return { incidents, loading, error, refetch: () => fetchEvents(false, true), dataVersion, totalEverSeen, updatedAt };
}
