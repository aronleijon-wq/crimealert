// "Pågår nu" in the app and on the site: the reports of the last hour and a half (live_reports,
// which never says who reported), grouped by the same rule as the server's notification.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { findLiveHappenings, type LiveHappening } from '../../supabase/functions/_shared/liveNow';

const POLL_MS = 60 * 1000;

interface LiveRow { id: string; category: string | null; area: string | null; lat: number; lng: number; created_at: string; event_id: string | null; reporter: number }

/** What is going on now, newest first; for signed-in users (reports are only theirs to see) */
export function useLiveNow(): LiveHappening[] {
  const { user } = useAuth();
  const [happenings, setHappenings] = useState<LiveHappening[]>([]);
  useEffect(() => {
    if (!user) { setHappenings([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: LiveRow[] | null; error: unknown }>)('live_reports');
      if (cancelled || error || !data) return;
      setHappenings(findLiveHappenings(data.map((r) => ({
        id: r.id, category: r.category, area: r.area, lat: r.lat, lng: r.lng, at: Date.parse(r.created_at), reporter: r.reporter, eventId: r.event_id,
      })), Date.now()));
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user]);
  return happenings;
}

