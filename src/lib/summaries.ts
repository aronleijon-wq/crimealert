import type { Incident } from '@/data/mockIncidents';
import { isSummary, isSummaryPart } from '../../supabase/functions/_shared/summaryEvents';

/**
 * The events without the night summaries that were split into their events (_shared/summaryEvents):
 * each of those is a row of its own, in its kommun, so the summary would count them twice. A
 * summary nothing was found in stays, as it is the only record of its night.
 */
export function withoutSplitSummaries(incidents: Incident[]): Incident[] {
  const split = new Set(incidents.filter((i) => isSummaryPart(i.id)).map((i) => i.id.replace(/-s\d+$/, '')));
  return incidents.filter((i) => !(isSummary(i.originalType, i.title) && split.has(i.id)));
}
