import { describe, it, expect, vi } from 'vitest';
import { appleGeocode, pickAppleHit, type AppleHit } from './appleMaps';

vi.mock('./appleJwt.ts', () => ({ signAppleJwt: async () => 'signed' }));

const centre = { lat: 62.391, lng: 17.307 }; // Sundsvall
const hit = (lat: number, lng: number, thoroughfare?: string, countryCode = 'SE'): AppleHit =>
  ({ coordinate: { latitude: lat, longitude: lng }, structuredAddress: { thoroughfare }, countryCode });

describe('checking Apple\'s answer', () => {
  it('takes the street asked for, near the kommun\'s centralort', () => {
    const hits = [hit(62.39, 17.30, 'Köpmangatan'), hit(62.395, 17.31, 'Storgatan')];
    expect(pickAppleHit(hits, { name: 'Storgatan 12', kind: 'street' }, centre)).toEqual({ lat: 62.395, lng: 17.31 });
  });

  it('turns down another street, a place far away, another country, or a street not named', () => {
    expect(pickAppleHit([hit(62.39, 17.30, 'Köpmangatan')], { name: 'Storgatan', kind: 'street' }, centre)).toBeNull();
    expect(pickAppleHit([hit(59.33, 18.06, 'Storgatan')], { name: 'Storgatan', kind: 'street' }, centre)).toBeNull();
    expect(pickAppleHit([hit(62.39, 17.30, 'Storgatan', 'NO')], { name: 'Storgatan', kind: 'street' }, centre)).toBeNull();
    expect(pickAppleHit([hit(62.39, 17.30)], { name: 'Storgatan', kind: 'street' }, centre)).toBeNull();
  });

  it('places a crossing on its first street, and an area or road near the kommun', () => {
    expect(pickAppleHit([hit(62.39, 17.30, 'Storgatan')], { name: 'Storgatan/Kyrkogatan', kind: 'crossing' }, centre)).not.toBeNull();
    expect(pickAppleHit([hit(62.4, 17.32)], { name: 'Stenstan', kind: 'area' }, centre)).toEqual({ lat: 62.4, lng: 17.32 });
  });
});

describe('checking Apple\'s answer for an event given only a län', () => {
  // Apple's real answer for "Anderstorp, Jönköpings län", 65 km from Jönköping
  const anderstorp: AppleHit = {
    coordinate: { latitude: 57.283, longitude: 13.633 }, name: 'Anderstorp', countryCode: 'SE',
    structuredAddress: { administrativeArea: 'Jönköpings län', locality: 'Anderstorp' },
  };
  const jonkoping = { lat: 57.7826, lng: 14.1618 };

  it('takes a place anywhere in the län', () => {
    expect(pickAppleHit([anderstorp], { name: 'Anderstorp', kind: 'area' }, jonkoping, 35, 'Jönköpings län')).toEqual({ lat: 57.283, lng: 13.633 });
  });

  it('turns down a place in another län, and keeps the distance limit for a kommun', () => {
    expect(pickAppleHit([anderstorp], { name: 'Anderstorp', kind: 'area' }, jonkoping, 35, 'Kronobergs län')).toBeNull();
    expect(pickAppleHit([anderstorp], { name: 'Anderstorp', kind: 'area' }, jonkoping)).toBeNull();
  });

  it('turns down the city when the street wasn\'t found (Ringvägen in Malmö)', () => {
    const malmo: AppleHit = { coordinate: { latitude: 55.605, longitude: 13.0 }, name: 'Malmö', countryCode: 'SE', structuredAddress: { administrativeArea: 'Skåne län', locality: 'Malmö' } };
    expect(pickAppleHit([malmo], { name: 'Ringvägen', kind: 'street' }, { lat: 55.605, lng: 13.0 })).toBeNull();
  });
});

describe('asking Apple', () => {
  it('trades the signed token for an access token once, then geocodes in Sweden near the place', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith('/token')) return new Response(JSON.stringify({ accessToken: 'acc', expiresInSeconds: 1800 }));
      return new Response(JSON.stringify({ results: [hit(62.39, 17.30, 'Storgatan')] }));
    }) as unknown as typeof fetch;
    const key = { keyId: 'K', privateKey: 'P' };
    expect(await appleGeocode('Storgatan, Sundsvall', centre, key, fetcher)).toHaveLength(1);
    await appleGeocode('Kyrkogatan, Sundsvall', centre, key, fetcher);
    expect(calls.filter((c) => c.endsWith('/token'))).toHaveLength(1);
    const q = new URL(calls[1]);
    expect(q.searchParams.get('limitToCountries')).toBe('SE');
    expect(q.searchParams.get('searchLocation')).toBe('62.391,17.307');
  });
});
