import { describe, expect, it } from 'vitest';
import { placeFromText, namedPlaceOf, type Districts } from './textPlace';

const data: Districts = {
  Stockholm: [['Gamla stan', 59.325, 18.0706, 's'], ['Östermalm', 59.3402, 18.0837, 's'], ['Vasastan', 59.343, 18.048, 's'], ['Odenplan', 59.343, 18.0496, 'q'], ['Rinkeby', 59.3881, 17.9286, 's']],
  Solna: [['Hagalund', 59.3610, 18.0110, 's']],
  Hedemora: [['Östermalm', 60.48, 15.4353, 's']],
};
// Stockholm's centre in Gamla stan, where the server leaves an event it hasn't placed
const event = (description: string, extra: Partial<{ title: string; area: string; lat: number; lng: number }> = {}) => ({
  id: 'pol-1', title: '23 november 15.02, Bedrägeri, Stockholm', area: 'Stockholm', description, lat: 59.32512, lng: 18.07109, ...extra,
});

describe('an event is shown in the area its text names', () => {
  it('moves a fraud "på Östermalm" from Gamla stan to Östermalm', () => {
    expect(placeFromText(event('En kvinna i 80-årsåldern på Östermalm har blivit lurad på pengar.'), data)).toEqual({ lat: 59.3402, lng: 18.0837 });
    expect(placeFromText(event('Östermalm. En äldre man har blivit av med sina bankkort.'), data)).toEqual({ lat: 59.3402, lng: 18.0837 });
  });

  it('leaves it where it is when it already is there, or the text names no place', () => {
    // The server's spread around Östermalm, or a street on it
    expect(placeFromText(event('Bedrägeri på Östermalm.', { lat: 59.3420, lng: 18.0870 }), data)).toBeNull();
    expect(placeFromText(event('En kvinna har blivit lurad på pengar.'), data)).toBeNull();
    expect(placeFromText({ ...event('Polisen sammanfattar natten på Östermalm.'), originalType: 'Sammanfattning natt' }, data)).toBeNull();
  });

  it('takes where it happened, not where someone came from', () => {
    expect(placeFromText(event('En man från Rinkeby greps i Vasastan.'), data)).toEqual({ lat: 59.343, lng: 18.048 });
  });

  it('finds a district Polisen gives as the place, and a place in the next kommun, near the event', () => {
    expect(namedPlaceOf(event('En kvinna lurades.', { title: '23 november 15.02, Bedrägeri, Östermalm', area: 'Östermalm' }), data)?.lat).toBe(59.3402);
    expect(placeFromText(event('Inbrott i Hagalund under natten.'), data)).toEqual({ lat: 59.361, lng: 18.011 });
  });
});
