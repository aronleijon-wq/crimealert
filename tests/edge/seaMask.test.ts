import { describe, expect, it } from 'vitest';
import { inSea, landPoint, markerPoint } from "../../supabase/functions/_shared/seaMask";
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
