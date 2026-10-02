import type { Incident } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const MAP_MAX_AGE_MS = 7 * DAY;
export const COMMUNITY_REPORT_MAX_AGE_MS = DAY;
export const FREE_TIER_DELAY_MS = 15 * MINUTE;

/**
 * Which incidents the live map shows:
 * - community reports for 24 hours
 * - Trafikverket disruptions until their end time
 * - everything else for 7 days, delayed 15 minutes for non-premium users
 * Incidents with an unparsable time are kept rather than silently dropped.
 */
export function filterIncidentsForMap(
  incidents: Incident[],
  { isPremium, now = Date.now() }: { isPremium: boolean; now?: number },
): Incident[] {
  const delayCutoff = isPremium ? Infinity : now - FREE_TIER_DELAY_MS;
  return incidents.filter((i) => {
    const t = parseIncidentTime(i.time)?.getTime();
    if (t === undefined) return true;
    if (i.source === 'Medborgarrapport') return t >= now - COMMUNITY_REPORT_MAX_AGE_MS;
    if (i.type === 'trafikverket') {
      const end = parseIncidentTime(i.endTime)?.getTime();
      return end === undefined || end >= now;
    }
    if (t < now - MAP_MAX_AGE_MS) return false;
    return t <= delayCutoff;
  });
}

/** Newest first; incidents with an unparsable time go last. */
export function sortNewestFirst(incidents: Incident[]): Incident[] {
  const time = (i: Incident) => parseIncidentTime(i.time)?.getTime() ?? -Infinity;
  return [...incidents].sort((a, b) => time(b) - time(a));
}
