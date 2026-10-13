// Trafikverket road disruptions (Situation/Deviation, schema 1.6), shared by trafikverket-events
// (the live map layer) and ingest-sources (history and the feed).

import type { ExternalEvent, Severity } from './types.ts';

export const TRAFIKVERKET_API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

export function situationQuery(apiKey: string): string {
  return `<REQUEST>
  <LOGIN authenticationkey="${apiKey}" />
  <QUERY objecttype="Situation" namespace="road.trafficinfo" schemaversion="1.6" limit="800">
    <FILTER>
      <AND>
        <LTE name="Deviation.StartTime" value="$now" />
        <OR>
          <GTE name="Deviation.EndTime" value="$now" />
          <EXISTS name="Deviation.EndTime" value="false" />
        </OR>
      </AND>
    </FILTER>
  </QUERY>
</REQUEST>`;
}

/** One disruption in the shape the app's map layer expects. */
export interface TrafikverketEvent {
  id: string;
  type: 'trafikverket';
  title: string;
  description: string;
  lat: number;
  lng: number;
  area: string;
  time: string;
  endTime: string | null;
  status: 'active';
  risk: Severity;
  source: 'Trafikverket';
  originalType: string | null;
  location_precision: 'exact';
  url: string | null;
  acute: boolean;
}

const MESSAGE_LABELS: Record<string, string> = {
  roadworks: 'Vägarbete',
  roadClosed: 'Vägen avstängd',
  accident: 'Trafikolycka',
  trafficAccident: 'Trafikolycka',
  vehicleFire: 'Fordonsbrand',
  brokenDownVehicle: 'Stillastående fordon',
  obstruction: 'Hinder på vägen',
  animalOnTheRoad: 'Djur på vägen',
  objectOnTheRoad: 'Föremål på vägen',
  queue: 'Kö',
  slowTraffic: 'Långsam trafik',
  speedRestrictionInOperation: 'Nedsatt hastighet',
  laneClosures: 'Körfält avstängt',
  laneClosed: 'Körfält avstängt',
  followDiversionSigns: 'Omledning',
  slipperyRoad: 'Halka',
  snowOnTheRoad: 'Snö på vägen',
  flooding: 'Översvämning',
  restrictionsForVehicles: 'Fordonsrestriktioner',
  ferryServiceSuspended: 'Färjetrafik inställd',
  bridgeSwingInOperation: 'Broöppning',
};

const ACUTE_CODES = [
  'accident', 'fire', 'brokendown', 'obstruction', 'animal', 'object',
  'queue', 'slowtraffic', 'roadclosed', 'slippery', 'snow', 'flooding',
];

const isInSweden = (lat: number, lng: number) => lat >= 54 && lat <= 70 && lng >= 10 && lng <= 25;

/** Coordinate pairs from a WGS84 WKT POINT or LINESTRING ("lng lat" order, optional Z). */
function wktCoordinates(wkt: unknown): { lat: number; lng: number }[] {
  const body = String(wkt ?? '').match(/\(([^()]*)\)/)?.[1];
  if (!body) return [];
  return body.split(',').map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return { lat, lng };
  }).filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng) && isInSweden(lat, lng));
}

/** Map position for a deviation: its point, or the middle of its line (roadworks are often lines). */
export function deviationPosition(geometry: Record<string, Record<string, unknown> | unknown> | undefined): { lat: number; lng: number } | null {
  const g = (geometry ?? {}) as { WGS84?: unknown; Point?: { WGS84?: unknown }; Line?: { WGS84?: unknown } };
  const point = wktCoordinates(g.Point?.WGS84)[0] ?? wktCoordinates(g.WGS84)[0];
  if (point) return point;
  const line = wktCoordinates(g.Line?.WGS84);
  return line.length > 0 ? line[Math.floor(line.length / 2)] : null;
}

/** Swedish label: our translation of the code, else Trafikverket's own Swedish text. */
export function deviationLabel(d: { MessageCodeValue?: unknown; MessageCode?: unknown; MessageType?: unknown }): string {
  const code = String(d.MessageCodeValue ?? '');
  return MESSAGE_LABELS[code] || String(d.MessageCode || d.MessageType || 'Trafikstörning');
}

export function riskFromSeverity(severity?: unknown): Severity {
  const s = String(severity ?? '').toLowerCase();
  if (s.includes('mycket stor') || s.includes('stor')) return 'high';
  if (s.includes('måttlig') || s.includes('medel')) return 'medium';
  return 'low';
}

// The fields of Trafikverket's response that we read; everything else is ignored
interface RawDeviation {
  Id?: string;
  Deleted?: boolean;
  StartTime?: string;
  EndTime?: string;
  CreationTime?: string;
  Geometry?: Record<string, unknown>;
  MessageCodeValue?: string;
  MessageCode?: string;
  MessageType?: string;
  RoadNumber?: string;
  Message?: string;
  LocationDescriptor?: string;
  CountyNo?: number[];
  SeverityText?: string;
  WebLink?: string;
}

interface RawSituation {
  Id?: string;
  Deleted?: boolean;
  PublicationTime?: string;
  Deviation?: RawDeviation[];
}

/** Current disruptions from a Situation response. */
export function parseSituations(json: unknown, now = Date.now()): TrafikverketEvent[] {
  const response = json as { RESPONSE?: { RESULT?: { Situation?: RawSituation[] }[] } } | null;
  const situations = response?.RESPONSE?.RESULT?.[0]?.Situation ?? [];
  const events: TrafikverketEvent[] = [];
  const seen = new Set<string>();

  for (const sit of situations) {
    if (sit?.Deleted === true) continue;
    for (const d of sit?.Deviation ?? []) {
      // Ended disruptions are never shown
      if (d?.Deleted === true) continue;
      if (d?.EndTime && new Date(d.EndTime).getTime() < now) continue;

      const position = deviationPosition(d?.Geometry);
      if (!position) continue;

      const time = d?.StartTime || d?.CreationTime || sit?.PublicationTime;
      if (!time) continue;

      const code = String(d?.MessageCodeValue || '');
      // Skip permanent/irrelevant entries (färjelägen m.m.)
      if (/ferry|bridgeSwing/i.test(code)) continue;

      const acute = ACUTE_CODES.some((c) => code.toLowerCase().includes(c));
      // Acute disruptions: last 24 hours. Others (roadworks etc.): last 7 days.
      // Multi-year roadworks don't belong on a real-time map.
      const maxAge = (acute ? 24 : 7 * 24) * 60 * 60 * 1000;
      if (new Date(time).getTime() < now - maxAge) continue;

      const id = `tv-${d?.Id || sit?.Id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const road = d?.RoadNumber ? `${d.RoadNumber} — ` : '';
      events.push({
        id,
        type: 'trafikverket',
        title: `${road}${deviationLabel(d ?? {})}`.slice(0, 160),
        description: String(d?.Message || d?.LocationDescriptor || '').slice(0, 600),
        lat: position.lat,
        lng: position.lng,
        area: String(d?.LocationDescriptor || d?.CountyNo?.join?.(', ') || 'Sverige').slice(0, 160),
        time,
        endTime: d?.EndTime || null,
        status: 'active',
        risk: riskFromSeverity(d?.SeverityText),
        source: 'Trafikverket',
        originalType: d?.MessageType || null,
        location_precision: 'exact',
        url: typeof d?.WebLink === 'string' && /^https?:\/\//.test(d.WebLink) ? d.WebLink : null,
        acute,
      });
    }
  }
  return events;
}

/** Row for external_events (history and the feed). */
export function trafikverketToExternal(e: TrafikverketEvent): ExternalEvent {
  return {
    id: e.id,
    source: 'trafikverket',
    kind: 'traffic',
    title: e.title,
    summary: e.description,
    url: e.url,
    area: e.area,
    lat: e.lat,
    lng: e.lng,
    published_at: new Date(e.time).toISOString(),
    ends_at: e.endTime ? new Date(e.endTime).toISOString() : null,
    severity: e.risk,
    category: e.originalType,
  };
}
