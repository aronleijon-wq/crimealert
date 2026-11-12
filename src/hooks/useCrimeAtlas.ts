// The crime atlas's sums (crime_atlas, lib/crimeAtlas), kept a while per period, since the
// numbers move slowly and the atlas is opened again and again.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildAtlas, type Atlas, type AtlasRow } from '@/lib/crimeAtlas';

const FRESH_MS = 15 * 60 * 1000;
const cache = new Map<number, { at: number; atlas: Atlas }>();

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
    supabase.rpc('crime_atlas', { _days: days }).then(({ data, error: e }) => {
      if (cancelled) return;
      if (e || !data) { setError(true); return; }
      const built = buildAtlas(data as AtlasRow[]);
      cache.set(days, { at: Date.now(), atlas: built });
      setAtlas(built);
    });
    return () => { cancelled = true; };
  }, [days, cached]);

  return { atlas, loading: !atlas && !error, error };
}
