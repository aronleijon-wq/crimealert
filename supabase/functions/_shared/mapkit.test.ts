import { describe, expect, it } from 'vitest';
import { allowedMapOrigin, mapkitClaims, MAPKIT_TOKEN_SECONDS } from './mapkit';

describe('MapKit tokens', () => {
  it('are only for CrimeAlert, its previews and local development', () => {
    expect(allowedMapOrigin('https://crimealert.se')).toBe(true);
    expect(allowedMapOrigin('https://id-preview--abc.lovable.app')).toBe(true);
    expect(allowedMapOrigin('http://localhost:8080')).toBe(true);
    expect(allowedMapOrigin('https://crimealert.se.evil.com')).toBe(false);
    expect(allowedMapOrigin('https://example.com')).toBe(false);
    expect(allowedMapOrigin(null)).toBe(false);
  });

  it('carry the team, the origin and a day of validity', () => {
    expect(mapkitClaims('TEAM', 'https://crimealert.se', 1000)).toEqual({ iss: 'TEAM', iat: 1000, exp: 1000 + MAPKIT_TOKEN_SECONDS, origin: 'https://crimealert.se' });
  });
});
