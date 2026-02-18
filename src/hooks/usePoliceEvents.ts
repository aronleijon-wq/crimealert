import { useState, useEffect, useCallback, useRef } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';
import { useToast } from '@/hooks/use-toast';

export function usePoliceEvents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const lastFetch = useRef(0);

  const fetchEvents = useCallback(async (silent = false) => {
    // Throttle: don't fetch more than once per 30s
    if (Date.now() - lastFetch.current < 30_000) return;
    lastFetch.current = Date.now();

    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/police-events`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data?.success && data.data) {
        const mapped: Incident[] = data.data.map((e: any) => ({
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
        }));
        setIncidents(mapped);
      } else {
        throw new Error(data?.error || 'Failed to fetch events');
      }
    } catch (err: any) {
      console.error('Error fetching police events:', err);
      setError(err.message);
      if (!silent) {
        toast({
          title: 'Kunde inte hämta data',
          description: 'Använder demo-data. Försök igen senare.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
    // Poll every 60 seconds for near-realtime updates
    const interval = setInterval(() => fetchEvents(true), 60 * 1000);

    // Re-fetch when tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchEvents(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchEvents]);

  return { incidents, loading, error, refetch: () => fetchEvents(false) };
}
