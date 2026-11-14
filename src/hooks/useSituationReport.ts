// The lägesbild for a kommun (situation-report): a few sentences on its last week. The function
// keeps each text for twelve hours; here it is kept for the visit too, so moving between tabs
// doesn't ask again.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SituationReport {
  kommun: string;
  summary: string;
  thisWeek: number;
  lastWeek: number;
  /** Written by AI, or the plain count */
  ai: boolean;
  generatedAt: string;
}

const kept = new Map<string, Promise<SituationReport | null>>();

function fetchReport(kommun: string): Promise<SituationReport | null> {
  let request = kept.get(kommun);
  if (!request) {
    // Any trouble means no card, never a broken page
    request = Promise.resolve()
      .then(() => supabase.functions.invoke<SituationReport>('situation-report', { body: { kommun } }))
      .then(({ data, error }) => (error || !data?.summary ? null : data))
      .catch(() => null);
    kept.set(kommun, request);
    // A failure is asked again on the next visit
    request.then((r) => { if (!r) kept.delete(kommun); });
  }
  return request;
}

export function useSituationReport(kommun: string | null) {
  const [report, setReport] = useState<SituationReport | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!kommun) { setReport(null); return; }
    let live = true;
    setLoading(true);
    setReport(null);
    fetchReport(kommun).then((r) => { if (live) { setReport(r); setLoading(false); } });
    return () => { live = false; };
  }, [kommun]);
  return { report, loading };
}
