import { useState, useEffect, useCallback, useRef } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';
import { getErrorMessage } from '@/lib/errors';
import { createSnapshotCache } from '@/lib/snapshotCache';

// Shape of one event as returned by the trafikverket-events edge function
interface TrafikverketEventDto {
  id: string;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  area: string;
  time: string;
  endTime?: string | null;
  status?: string;
  risk?: string;
  originalType?: string | null;
  location_precision?: string | null;
}

interface TrafikverketEventsResponse {
  success?: boolean;
  data?: TrafikverketEventDto[];
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Shared across mounts so returning to the map within 5 minutes reuses the last response
const trafikverketCache = createSnapshotCache<Incident[]>();

async function requestTrafikverketEvents(): Promise<Incident[]> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trafikverket-events`,
    {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: TrafikverketEventsResponse = await response.json();
  if (!data?.success || !Array.isArray(data.data)) return [];

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
    source: 'Trafikverket',
    approximate: false,
    originalType: e.originalType || undefined,
    locationPrecision: e.location_precision || 'exact',
    endTime: e.endTime || null,
  })).filter((i: Incident) => {
    // Släpp störningar vars sluttid passerat (t.ex. avslutade vägarbeten)
    if (!i.endTime) return true;
    const end = new Date(i.endTime).getTime();
    return isNaN(end) || end > Date.now();
  });
  mapped.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return mapped;
}

export function useTrafikverketEvents() {
  // Data from a mount less than one poll interval ago
  const [initial] = useState(() => trafikverketCache.fresh('all', POLL_INTERVAL_MS));
  const [incidents, setIncidents] = useState<Incident[]>(initial?.data ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(initial?.fetchedAt ?? 0);

  const fetchEvents = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < POLL_INTERVAL_MS) return;
    lastFetch.current = Date.now();
    setError(null);

    try {
      const snapshot = await trafikverketCache.load('all', requestTrafikverketEvents);
      setIncidents(snapshot.data);
    } catch (err) {
      console.error('Error fetching Trafikverket events:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initial) fetchEvents();

    // Poll every 5 minutes while the tab is visible. A hidden tab skips polls and
    // fetches as soon as it is shown again if the data is older than 5 minutes.
    // Nothing on the server depends on these requests (trafikverket-events is read-only).
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

  return { incidents, loading, error, refetch: () => fetchEvents(true) };
}
