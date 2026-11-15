// Apple Maps Server API, to place events on the street Polisen names. It uses the MapKit key the
// site's map already has (MAPKIT_KEY_ID, MAPKIT_PRIVATE_KEY): a token signed with it is traded
// for an access token (valid 30 minutes), which is used to geocode. Apple allows 25 000 calls a
// day. Answers are checked against the event's kommun before they are used (pickAppleHit).
import { signAppleJwt } from './appleJwt.ts';
import { APPLE_TEAM_ID } from './mapkit.ts';
import { distanceKm, type PlaceCandidate } from './geoPlace.ts';

const API = 'https://maps-api.apple.com/v1';

export interface AppleKey { keyId: string; privateKey: string }

/** One answer from /v1/geocode, the fields used here */
export interface AppleHit {
  coordinate?: { latitude: number; longitude: number };
  name?: string;
  structuredAddress?: {
    locality?: string;
    subLocality?: string;
    thoroughfare?: string;
    fullThoroughfare?: string;
    administrativeArea?: string;
  };
  formattedAddressLines?: string[];
  country?: string;
  countryCode?: string;
}

let access: { token: string; until: number } | null = null;

/** An access token for the Maps Server API, kept until a minute before it runs out */
export async function appleAccessToken(key: AppleKey, now = Date.now(), fetcher: typeof fetch = fetch): Promise<string | null> {
  if (access && access.until > now + 60_000) return access.token;
  const iat = Math.floor(now / 1000);
  const jwt = await signAppleJwt({ kid: key.keyId, typ: 'JWT' }, { iss: APPLE_TEAM_ID, iat, exp: iat + 30 * 60 }, key.privateKey);
  const res = await fetcher(`${API}/token`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) {
    console.warn(`Apple Maps token: ${res.status} ${await res.text()}`);
    return null;
  }
  const body = (await res.json()) as { accessToken?: string; expiresInSeconds?: number };
  if (!body.accessToken) return null;
  access = { token: body.accessToken, until: now + (body.expiresInSeconds ?? 1800) * 1000 };
  return access.token;
}

/** Apple's answers for a query, searched near a point in Sweden; null when Apple can't be asked */
export async function appleGeocode(
  query: string,
  near: { lat: number; lng: number } | null,
  key: AppleKey,
  fetcher: typeof fetch = fetch,
): Promise<AppleHit[] | null> {
  const token = await appleAccessToken(key, Date.now(), fetcher);
  if (!token) return null;
  const params = new URLSearchParams({ q: query, limitToCountries: 'SE', lang: 'sv-SE' });
  if (near) params.set('searchLocation', `${near.lat},${near.lng}`);
  const res = await fetcher(`${API}/geocode?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) access = null;
  if (!res.ok) {
    console.warn(`Apple Maps geocode: ${res.status}`);
    return null;
  }
  return ((await res.json()) as { results?: AppleHit[] }).results ?? [];
}

const plain = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The first of Apple's answers that is the place asked for, in the event's kommun: in Sweden,
 * within maxKm of the kommun's centralort, and for a street, on that street (Apple otherwise
 * answers with the nearest thing it knows).
 */
export function pickAppleHit(
  hits: AppleHit[],
  candidate: PlaceCandidate,
  centre: { lat: number; lng: number },
  maxKm = 35,
): { lat: number; lng: number } | null {
  const street = candidate.kind === 'street' || candidate.kind === 'crossing'
    ? plain(candidate.name.split('/')[0]).replace(/\s+\d+\s*[a-z]?$/, '')
    : null;
  for (const h of hits) {
    const c = h.coordinate;
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
    if (h.countryCode && h.countryCode !== 'SE') continue;
    if (distanceKm(c.latitude, c.longitude, centre.lat, centre.lng) > maxKm) continue;
    if (street) {
      const on = plain(h.structuredAddress?.thoroughfare) || plain(h.structuredAddress?.fullThoroughfare) || plain(h.name);
      const onBase = on.replace(/\s+\d.*$/, '');
      if (!onBase || !(onBase.startsWith(street) || street.startsWith(onBase))) continue;
    }
    return { lat: c.latitude, lng: c.longitude };
  }
  return null;
}
