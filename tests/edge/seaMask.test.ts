import { describe, expect, it } from 'vitest';
import { inSea, landPoint, markerPoint, placesNear } from "../../supabase/functions/_shared/seaMask";
import { PLACES } from "../../supabase/functions/_shared/data/places";
import { LANDMARKS } from "../../supabase/functions/_shared/data/landmarks";
import { distanceKm } from "../../supabase/functions/_shared/geoPlace";

describe('the sea around Sweden', () => {
  it('knows sea from land in Stockholm and Malmö', () => {
    expect(inSea(59.3275, 18.073)).toBe(true); // Strömmen, by the palace
    expect(inSea(59.3245, 18.09)).toBe(true); // Saltsjön
    expect(inSea(55.625, 12.98)).toBe(true); // off Malmö harbour
    expect(inSea(59.325, 18.0706)).toBe(false); // Gamla stan
    expect(inSea(59.34015, 18.08374)).toBe(false); // Östermalm
    expect(inSea(55.605, 13.0)).toBe(false); // Malmö
    expect(inSea(62.4, 17.3)).toBe(false);
    expect(inSea(40, 10)).toBe(false); // outside the data
  });

  it('moves a place in the sea to the nearest land', () => {
    const p = landPoint(59.3275, 18.073);
    expect(inSea(p.lat, p.lng)).toBe(false);
    expect(distanceKm(p.lat, p.lng, 59.3275, 18.073)).toBeLessThan(0.4);
    expect(landPoint(59.325, 18.0706)).toEqual({ lat: 59.325, lng: 18.0706 });
  });

  it('spreads markers by the water only onto land, the same way every time', () => {
    // Skeppsholmen and Gamla stan's waterfront: many directions end in the water
    for (const [lat, lng] of [[59.3245, 18.0825], [59.3240, 18.0745], [59.3600, 18.1520]]) {
      for (let i = 0; i < 40; i++) {
        const p = markerPoint(`pol-${i}`, lat, lng);
        expect(inSea(p.lat, p.lng)).toBe(false);
        expect(distanceKm(p.lat, p.lng, lat, lng)).toBeLessThan(0.7);
      }
    }
    expect(markerPoint('pol-7', 59.3245, 18.0825)).toEqual(markerPoint('pol-7', 59.3245, 18.0825));
  });
});

describe('markers spread onto named places, not into lakes', () => {
  // Stockholm's centre, in Gamla stan, between Riddarfjärden (a lake, not in the sea data) and Strömmen
  const centre = [59.32512, 18.07109] as const;
  const places = [...LANDMARKS.Stockholm, ...(PLACES as Record<string, [string, number, number, string][]>).Stockholm];
  const near = placesNear(centre[0], centre[1], places);

  it('finds the places around Stockholm\'s centre', () => {
    expect(near.length).toBeGreaterThan(2);
    for (const [lat, lng] of near) expect(distanceKm(lat, lng, centre[0], centre[1])).toBeLessThanOrEqual(0.35);
  });

  it('puts every marker within 50 m of the centre or a named place, never in Riddarfjärden or Strömmen', () => {
    const points = Array.from({ length: 60 }, (_, i) => markerPoint(`pol-${i}`, centre[0], centre[1], near));
    for (const p of points) {
      expect(inSea(p.lat, p.lng)).toBe(false);
      const closest = Math.min(...[[centre[0], centre[1]], ...near].map(([a, b]) => distanceKm(p.lat, p.lng, a, b)));
      expect(closest).toBeLessThanOrEqual(0.051);
      // Riddarfjärden's open water starts some 450 m west of the centre
      expect(distanceKm(p.lat, p.lng, 59.3235, 18.058)).toBeGreaterThan(0.3);
    }
    // Spread over several places, not all on one
    expect(new Set(points.map((p) => `${p.lat.toFixed(3)}:${p.lng.toFixed(3)}`)).size).toBeGreaterThan(3);
  });
});
