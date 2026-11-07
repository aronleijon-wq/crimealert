import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseIncidentTime } from '@/lib/incidentTime';
import type { StatEvent } from './stats';

const PAGE = 1000;
const PARALLEL = 4;
// The tab is opened again and again; the archive changes little in a few minutes
const FRESH_MS = 10 * 60 * 1000;

let cache: { days: number; at: number; events: StatEvent[] } | null = null;

async function fetchStatEvents(days: number): Promise<StatEvent[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  // Only what the statistics need, so the phone fetches a fraction of the archive's rows
  const query = () => supabase.from('police_events_archive').select('time, area, original_type').gte('time', since);
  const { count, error } = await supabase.from('police_events_archive').select('id', { count: 'exact', head: true }).gte('time', since);
  if (error) throw error;
  const pages = Math.ceil((count ?? 0) / PAGE);
  const rows: { time: string; area: string | null; original_type: string | null }[] = [];
  for (let first = 0; first < pages; first += PARALLEL) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(PARALLEL, pages - first) }, (_, i) => {
        const from = (first + i) * PAGE;
        return query().order('time', { ascending: false }).range(from, from + PAGE - 1);
      }),
    );
    for (const { data, error: pageError } of batch) {
      if (pageError) throw pageError;
      rows.push(...(data ?? []));
    }
  }
  return rows.flatMap((r) => {
    const at = parseIncidentTime(r.time)?.getTime();
    return at === undefined ? [] : [{ at, area: r.area ?? '', category: r.original_type ?? '' }];
  });
}

/** Polisen's events of the last `days` days, for the statistics; only for Pro, who may read them */
export function useStatsEvents(days: number, enabled: boolean) {
  const cached = cache && cache.days >= days && Date.now() - cache.at < FRESH_MS ? cache.events : null;
  const [events, setEvents] = useState<StatEvent[] | null>(cached);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || cached) return;
    let cancelled = false;
    setError(false);
    fetchStatEvents(days)
      .then((found) => {
        cache = { days, at: Date.now(), events: found };
        if (!cancelled) setEvents(found);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [days, enabled, cached]);

  return { events: enabled ? events ?? cached : null, loading: enabled && !events && !cached && !error, error };
}
