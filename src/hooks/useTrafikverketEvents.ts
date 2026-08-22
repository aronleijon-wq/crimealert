import { useState, useEffect, useCallback, useRef } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';

export function useTrafikverketEvents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(0);

  const fetchEvents = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < 5 * 60 * 1000) return;
    lastFetch.current = Date.now();
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trafikverket-events`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data?.success && Array.isArray(data.data)) {
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
          source: 'Trafikverket',
          approximate: false,
          originalType: e.originalType || undefined,
          locationPrecision: e.location_precision || 'exact',
        }));
        mapped.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setIncidents(mapped);
      } else {
        setIncidents([]);
      }
    } catch (err: any) {
      console.error('Error fetching Trafikverket events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => fetchEvents(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { incidents, loading, error, refetch: () => fetchEvents(true) };
}
