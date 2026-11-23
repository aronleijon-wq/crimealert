import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Incident } from '@/data/mockIncidents';
import { isReportCategory, REPORT_CATEGORY_LABELS } from '../../supabase/functions/_shared/reportCategories';

const categoryLabel = (category: string) =>
  category === 'other' ? 'Medborgarrapport' : isReportCategory(category) ? REPORT_CATEGORY_LABELS[category] : category;

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

    const mapped: Incident[] = (data ?? []).map((r) => ({
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
      originalType: categoryLabel(r.category ?? 'other'),
      image_url: r.image_url || null,
      eventId: (r as { event_id?: string | null }).event_id ?? null,
    }));

    setReports(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { if (enabled) fetchReports(); }, [fetchReports, enabled]);

  return { reports, loading, refetch: fetchReports };
}
