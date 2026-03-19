import { useState, useEffect, useCallback } from 'react';
import { Incident, IncidentType, RiskLevel } from '@/data/mockIncidents';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches events from police_events_archive for a given number of days.
 * Uses pagination to bypass the default 1000-row limit.
 */
export function useArchiveEvents(days: number, enabled: boolean) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString();

      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchError } = await supabase
          .from('police_events_archive')
          .select('*')
          .gte('time', cutoffStr)
          .order('time', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allRows = allRows.concat(data);
          from += PAGE_SIZE;
          if (data.length < PAGE_SIZE) hasMore = false;
        }
      }

      const mapped: Incident[] = allRows.map((e) => ({
        id: e.id,
        type: (e.type || 'other') as IncidentType,
        title: e.title,
        description: e.description || '',
        lat: e.lat || 0,
        lng: e.lng || 0,
        area: e.area || '',
        time: e.time,
        status: (e.status || 'active') as 'active' | 'resolved',
        risk: (e.risk || 'low') as RiskLevel,
        source: e.source || 'archive',
        approximate: e.location_precision !== 'exact' && e.location_precision !== 'street',
        url: e.url || undefined,
        originalType: e.original_type || undefined,
        locationPrecision: e.location_precision || undefined,
      }));

      mapped.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setIncidents(mapped);
    } catch (err: any) {
      console.error('Error fetching archive events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days, enabled]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { incidents, loading, error };
}
