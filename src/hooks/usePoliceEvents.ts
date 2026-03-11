import { useState, useEffect, useCallback, useRef } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function usePoliceEvents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [totalEverSeen, setTotalEverSeen] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const lastFetch = useRef(0);

  const fetchEvents = useCallback(async (silent = false, force = false) => {
    // Throttle: don't fetch more than once per 5 min (unless forced)
    if (!force && Date.now() - lastFetch.current < 5 * 60 * 1000) return;
    lastFetch.current = Date.now();

    if (!silent) setLoading(true);
    setError(null);

    try {
      // Get current session token for server-side premium check
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/police-events`,
        { headers }
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
          url: e.url || undefined,
          originalType: e.originalType || undefined,
          locationPrecision: e.location_precision || undefined,
        }));
        // Sort by timestamp descending (newest first)
        mapped.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setIncidents(mapped);
        // Track cumulative unique incidents (only increases)
        mapped.forEach(inc => seenIdsRef.current.add(inc.id));
        setTotalEverSeen(seenIdsRef.current.size);
        setDataVersion(v => v + 1);
      } else {
        throw new Error(data?.error || 'Failed to fetch events');
      }
    } catch (err: any) {
      console.error('Error fetching police events:', err);
      setError(err.message);
      if (!silent) {
        toastRef.current({
          title: 'Kunde inte hämta data',
          description: 'Använder demo-data. Försök igen senare.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => fetchEvents(true), 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchEvents(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchEvents]);

  return { incidents, loading, error, refetch: () => fetchEvents(false, true), dataVersion, totalEverSeen };
}
