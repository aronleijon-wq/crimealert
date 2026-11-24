import { describe, expect, it } from 'vitest';
import { KOMMUN_CENTRES, PLACES } from '../../supabase/functions/_shared/data/places';

describe('the packed places (police-events)', () => {
  it('reads every kommun, its places and their kinds', () => {
    expect(Object.keys(KOMMUN_CENTRES)).toHaveLength(290);
    expect(Object.keys(PLACES)).toHaveLength(290);
    const n = Object.values(PLACES).reduce((s, l) => s + l.length, 0);
    expect(n).toBeGreaterThan(80000);
    const sodermalm = PLACES.Stockholm.find((p) => p[0] === 'Södermalm');
    expect(sodermalm?.[3]).toBe('s');
    expect(sodermalm?.[1]).toBeCloseTo(59.31, 1);
    expect(sodermalm?.[2]).toBeCloseTo(18.07, 1);
    for (const list of Object.values(PLACES)) for (const [name, lat, lng, t] of list) {
      if (!name || !(lat > 54 && lat < 70) || !(lng > 10 && lng < 25) || !/^[cvhsqia]$/.test(t)) throw new Error(`bad place ${name} ${lat} ${lng} ${t}`);
    }
  });
});
