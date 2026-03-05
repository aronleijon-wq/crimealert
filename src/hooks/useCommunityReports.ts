import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Incident } from '@/data/mockIncidents';

const CATEGORY_LABELS: Record<string, string> = {
  broken_lighting: 'Trasig gatubelysning',
  vandalism: 'Skadegörelse',
  unsafe_area: 'Otrygg plats',
  suspicious_activity: 'Misstänkt aktivitet',
  other: 'Medborgarrapport',
};

export function useCommunityReports() {
  const [reports, setReports] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('community_reports')
      .select('*')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    const mapped: Incident[] = (data ?? []).map((r: any) => ({
      id: `cr-${r.id}`,
      type: 'other' as const,
      title: r.title,
      description: r.description,
      lat: r.lat,
      lng: r.lng,
      area: r.area || 'Okänt område',
      time: r.created_at,
      status: r.status === 'open' ? 'active' as const : 'resolved' as const,
      risk: 'low' as const,
      source: 'Medborgarrapport',
      approximate: false,
      originalType: CATEGORY_LABELS[r.category] || r.category,
    }));

    setReports(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return { reports, loading, refetch: fetchReports };
}
