import type { Incident } from '@/data/mockIncidents';
import { isSummaryPart } from '../../supabase/functions/_shared/summaryEvents';

/** The ids of the events that were split into the events they tell of (their parts are here) */
export function splitParentIds(incidents: { id: string }[]): Set<string> {
  return new Set(incidents.filter((i) => isSummaryPart(i.id)).map((i) => i.id.replace(/-s\d+$/, '')));
}

/**
 * The events without those that were split into their events (_shared/summaryEvents): a night
 * summary, or a list such as "Trafikolycka, vilt, Västerbottens län" with six accidents. Each
 * of those is a row of its own, in its kommun, so the whole would count them twice. One nothing
 * was found in stays, as it is the only record of what it tells.
 */
export function withoutSplitSummaries<T extends { id: string }>(incidents: T[]): T[] {
  const split = splitParentIds(incidents);
  return incidents.filter((i) => !split.has(i.id));
}
