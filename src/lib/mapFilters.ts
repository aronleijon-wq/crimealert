import type { Incident } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const MAP_MAX_AGE_MS = 7 * DAY;
export const COMMUNITY_REPORT_MAX_AGE_MS = DAY;
export const CRISIS_DEFAULT_DURATION_MS = 2 * DAY;
export const FREE_TIER_DELAY_MS = 15 * MINUTE;

/**
 * Which incidents the live map shows:
 * - community reports for 24 hours
 * - Trafikverket disruptions until their end time
 * - VMA and Krisinformation until they expire (2 days if no end is given), never delayed
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
    if (i.type === 'crisis') {
      const end = parseIncidentTime(i.endTime)?.getTime() ?? t + CRISIS_DEFAULT_DURATION_MS;
      return end >= now;
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

const DUPLICATE_DISTANCE_KM = 2;
const DUPLICATE_TIME_WINDOW_MS = 2 * HOUR;

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const isTrafficAccident = (i: Incident) => /olycka/i.test(`${i.title} ${i.originalType ?? ''}`);

/**
 * Trafikverket often reports the same accident as the police. A Trafikverket accident within
 * 2 km and 2 hours of a police traffic accident is linked to that police event instead of
 * getting its own marker.
 */
export function linkTrafficDuplicates(police: Incident[], traffic: Incident[]): {
  traffic: Incident[];
  linked: Map<string, Incident[]>;
} {
  const policeAccidents = police
    .filter((p) => p.type === 'traffic')
    .map((p) => ({ incident: p, time: parseIncidentTime(p.time)?.getTime() }))
    .filter((p): p is { incident: Incident; time: number } => p.time !== undefined);

  const kept: Incident[] = [];
  const linked = new Map<string, Incident[]>();
  for (const tv of traffic) {
    const time = parseIncidentTime(tv.time)?.getTime();
    const match = isTrafficAccident(tv) && time !== undefined
      ? policeAccidents.find((p) => Math.abs(p.time - time) <= DUPLICATE_TIME_WINDOW_MS && distanceKm(p.incident, tv) <= DUPLICATE_DISTANCE_KM)
      : undefined;
    if (match) {
      linked.set(match.incident.id, [...(linked.get(match.incident.id) ?? []), tv]);
    } else {
      kept.push(tv);
    }
  }
  return { traffic: kept, linked };
}
