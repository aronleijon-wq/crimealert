// Apple Maps on the site (MapKit JS, src/native/AppleMap.tsx) needs a token signed with the
// MapKit key from the developer account (MAPKIT_KEY_ID, MAPKIT_PRIVATE_KEY). mapkit-token signs
// one, valid only for CrimeAlert's own addresses, so a copied token is no use anywhere else.

/** Apple's team the key belongs to (not a secret: it's in the app's signature too) */
export const APPLE_TEAM_ID = '63CNAWCYZQ';

/** How long a token is valid; the site keeps it this long, so the map rarely asks again */
export const MAPKIT_TOKEN_SECONDS = 24 * 60 * 60;

const ORIGINS = new Set(['https://crimealert.se', 'https://www.crimealert.se', 'https://crimealert.lovable.app']);

/** Whether a page at this origin may have a token: CrimeAlert's own, and its Lovable previews */
export function allowedMapOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.(lovable\.app|lovableproject\.com)$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function mapkitClaims(teamId: string, origin: string, nowSec: number) {
  return { iss: teamId, iat: nowSec, exp: nowSec + MAPKIT_TOKEN_SECONDS, origin };
}
