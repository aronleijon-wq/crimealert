// Medborgarrapporter as events, next to Polisen's: in Analys, Statistik and the export. They keep
// "Medborgarrapport" as their source, so every view can show Polisen only, the reports only, or
// both, and the export says where each row comes from.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Incident } from '@/data/mockIncidents';
import { isReportCategory, REPORT_CATEGORY_LABELS } from '../../supabase/functions/_shared/reportCategories';

export const REPORT_SOURCE = 'Medborgarrapport';

export const reportCategoryLabel = (category: string | null | undefined) =>
  !category || category === 'other' ? 'Medborgarrapport' : isReportCategory(category) ? REPORT_CATEGORY_LABELS[category] : category;

export interface ReportRow {
  id: string | null;
  category: string | null;
  title: string | null;
  description: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  status: string | null;
  created_at: string | null;
  image_url?: string | null;
  event_id?: string | null;
}

/** A report as an event: what kind (its category), where and when it was made */
export function reportToIncident(r: ReportRow): Incident {
  const label = reportCategoryLabel(r.category);
  return {
    id: `cr-${r.id}`,
    type: r.category === 'smoke_fire' ? 'fire' : 'other',
    title: r.title || label,
    description: r.description ?? '',
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    area: r.area || 'Okänt område',
    time: r.created_at ?? '',
    status: r.status === 'open' ? 'active' : 'resolved',
    risk: 'low',
    source: REPORT_SOURCE,
    approximate: false,
    originalType: label,
    image_url: r.image_url || null,
    eventId: r.event_id ?? null,
  };
}

export const isReport = (i: Pick<Incident, 'source'>) => i.source === REPORT_SOURCE;

export type SourceFilter = 'alla' | 'polisen' | 'rapporter';
export const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'alla', label: 'Allt' },
  { value: 'polisen', label: 'Polisen' },
  { value: 'rapporter', label: 'Rapporter' },
];

export function bySource<T extends Pick<Incident, 'source'>>(events: T[], filter: SourceFilter): T[] {
  if (filter === 'alla') return events;
  return events.filter((e) => (filter === 'rapporter') === isReport(e));
}

const PAGE = 1000;
const MAX_PAGES = 10;
const FRESH_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; rows: Incident[] }>();

/** The reports of the last `days` days (all of them for null); only signed-in users get any */
export async function fetchReportEvents(days: number | null): Promise<Incident[]> {
  const key = String(days);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.rows;
  const rows: Incident[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase.from('community_reports_public').select('*').order('created_at', { ascending: false });
    if (days !== null) query = query.gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    const { data, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) break;
    rows.push(...(data as ReportRow[]).filter((r) => r.id && r.created_at).map(reportToIncident));
    if (data.length < PAGE) break;
  }
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

export function useReportEvents(days: number | null, enabled = true) {
  const [reports, setReports] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) { setReports([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchReportEvents(days)
      .then((r) => { if (!cancelled) setReports(r); })
      .catch(() => { if (!cancelled) setReports([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, enabled]);
  return { reports, loading };
}
