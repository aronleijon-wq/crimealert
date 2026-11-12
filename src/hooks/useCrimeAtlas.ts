// The crime atlas's sums (crime_atlas, lib/crimeAtlas), kept a while per period, since the
// numbers move slowly and the atlas is opened again and again.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildAtlas, type Atlas, type AtlasRow } from '@/lib/crimeAtlas';

const FRESH_MS = 15 * 60 * 1000;
// The database answers at most 1000 rows at a time, and a month has several thousand sums
const PAGE = 1000;
const MAX_PAGES = 20;
const cache = new Map<number, { at: number; atlas: Atlas }>();

/** Every sum for the period, a page at a time in a steady order so no page skips or repeats a row */
async function fetchRows(days: number): Promise<AtlasRow[]> {
  const rows: AtlasRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .rpc('crime_atlas', { _days: days })
      .order('area')
      .order('category')
      .range(from, from + PAGE - 1);
    if (error || !data) throw error ?? new Error('Inga siffror');
    rows.push(...(data as AtlasRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

export function useCrimeAtlas(days: number) {
  const fresh = cache.get(days);
  const cached = fresh && Date.now() - fresh.at < FRESH_MS ? fresh.atlas : null;
  const [atlas, setAtlas] = useState<Atlas | null>(cached);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cached) { setAtlas(cached); return; }
    let cancelled = false;
    setError(false);
    setAtlas(null);
    fetchRows(days)
      .then((rows) => {
        if (cancelled) return;
        const built = buildAtlas(rows);
        cache.set(days, { at: Date.now(), atlas: built });
        setAtlas(built);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [days, cached]);

  return { atlas, loading: !atlas && !error, error };
}
