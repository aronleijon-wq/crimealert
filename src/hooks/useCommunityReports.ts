import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Incident } from '@/data/mockIncidents';
import { reportToIncident, type ReportRow } from '@/lib/reportEvents';

// Medborgarrapporter for everyone signed in (the database gives none to those signed out), so
// callers enable the query when there is a user
export function useCommunityReports(enabled = true) {
  const [reports, setReports] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('community_reports_public')
      .select('*')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const mapped: Incident[] = (data ?? []).map((r) => reportToIncident(r as ReportRow));

    setReports(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) fetchReports(); }, [fetchReports, enabled]);

  return { reports, loading, refetch: fetchReports };
}
