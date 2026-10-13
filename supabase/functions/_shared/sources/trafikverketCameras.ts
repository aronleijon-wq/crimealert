// Trafikverket's road cameras (objecttype Camera): still images along the roads that Trafikverket
// updates every few minutes. Only the list is fetched here; browsers load the images straight
// from Trafikverket, so nothing is stored.

import { wktCoordinates } from './trafikverket.ts';

export interface TrafficCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  photoUrl: string;
  /** A larger image, when Trafikverket has one */
  fullSizeUrl: string | null;
  /** "Väglagskamera", "Trafikflödeskamera" */
  type: string | null;
  /** The direction the camera looks: "nordost" */
  direction: string | null;
}

/** The query for active cameras. Namespace null leaves it out, for API versions that don't want it. */
export function cameraQuery(apiKey: string, namespace: string | null = 'road.infrastructure'): string {
  return `<REQUEST>
  <LOGIN authenticationkey="${apiKey}" />
  <QUERY objecttype="Camera"${namespace ? ` namespace="${namespace}"` : ''} schemaversion="1" limit="10000">
    <FILTER>
      <AND>
        <EQ name="Active" value="true" />
        <EQ name="Deleted" value="false" />
      </AND>
    </FILTER>
  </QUERY>
</REQUEST>`;
}

const COMPASS = ['norr', 'nordost', 'öster', 'sydost', 'söder', 'sydväst', 'väster', 'nordväst'];

/** 0–360 degrees as one of eight directions; null when it isn't a number. */
export function compassDirection(degrees: unknown): string | null {
  const d = typeof degrees === 'number' ? degrees : Number.parseFloat(String(degrees ?? ''));
  if (!Number.isFinite(d)) return null;
  return COMPASS[Math.round((((d % 360) + 360) % 360) / 45) % 8];
}

/** Only https images on Trafikverket's own servers. */
export function trafikverketImageUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || !/(^|\.)trafikverket\.se$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

interface RawCamera {
  Id?: unknown;
  Name?: unknown;
  Active?: unknown;
  Deleted?: unknown;
  PhotoUrl?: unknown;
  HasFullSizePhoto?: unknown;
  Type?: unknown;
  Direction?: unknown;
  Geometry?: { WGS84?: unknown };
}

/** Cameras from an API response: active, in Sweden, with an image. Sorted by name. */
export function parseCameras(json: unknown): TrafficCamera[] {
  const results = (json as { RESPONSE?: { RESULT?: { Camera?: RawCamera[] }[] } })?.RESPONSE?.RESULT ?? [];
  const cameras: TrafficCamera[] = [];
  const seen = new Set<string>();
  for (const raw of results.flatMap((r) => r.Camera ?? [])) {
    if (raw.Active === false || raw.Deleted === true) continue;
    const id = String(raw.Id ?? '').trim();
    const point = wktCoordinates(raw.Geometry?.WGS84)[0];
    const photoUrl = trafikverketImageUrl(raw.PhotoUrl);
    if (!id || seen.has(id) || !point || !photoUrl) continue;
    seen.add(id);
    const full = new URL(photoUrl);
    full.searchParams.set('type', 'fullsize');
    cameras.push({
      id,
      name: String(raw.Name ?? '').trim() || 'Trafikkamera',
      lat: Math.round(point.lat * 1e5) / 1e5,
      lng: Math.round(point.lng * 1e5) / 1e5,
      photoUrl,
      fullSizeUrl: raw.HasFullSizePhoto === true ? full.toString() : null,
      type: typeof raw.Type === 'string' && raw.Type.trim() ? raw.Type.trim() : null,
      direction: compassDirection(raw.Direction),
    });
  }
  return cameras.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

/** The API's own error message, if the response is one. */
export function apiError(json: unknown): string | null {
  const results = (json as { RESPONSE?: { RESULT?: { ERROR?: { MESSAGE?: string } }[] } })?.RESPONSE?.RESULT ?? [];
  return results.find((r) => r.ERROR)?.ERROR?.MESSAGE ?? null;
}
