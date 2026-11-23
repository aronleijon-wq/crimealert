// Real events from 13–23 November 2026, from an audit of the live map: where the text says it
// happened, and the cases where a word was taken for a place it isn't
import { describe, expect, it } from 'vitest';
import districts from '@/data/districts.json';
import { placeFromText, type Districts } from './textPlace';
import { distanceKm } from '../../supabase/functions/_shared/geoPlace';

const data = districts as unknown as Districts;
const ev = (kommun: string, description: string, lat: number, lng: number) =>
  ({ id: 'pol-1', title: `23 november 12.00, Händelse, ${kommun}`, area: kommun, description, lat, lng });

describe('the live map\'s events', () => {
  it('moves events to the place their text names', () => {
    const at = (r: { lat: number; lng: number } | null, lat: number, lng: number) => r && distanceKm(r.lat, r.lng, lat, lng);
    // Bedrägeri, Stockholm: "på östermalm", left in Gamla stan
    expect(at(placeFromText(ev('Stockholm', 'komma hem till henne på östermalm och hämta värdesaker.', 59.3255, 18.074), data), 59.34, 18.084)).toBeLessThan(0.3);
    // Trafikolycka, Nynäshamn: "i ösmo"
    expect(at(placeFromText(ev('Nynäshamn', 'Polis beordras till en trafikolycka i ösmo.', 58.9036, 17.9479), data), 58.98, 17.90)).toBeLessThan(1);
    // Försvunnen person, Örebro: "på Södermalm i örebro", left at a hamlet 37 km north
    expect(at(placeFromText(ev('Örebro', 'försvann från sitt boende på Södermalm i örebro.', 59.5956, 15.0185), data), 59.266, 15.215)).toBeLessThan(0.3);
  });

  it('does not take words for places, nor move what the kommun\'s own name says', () => {
    const cases: [string, string, number, number][] = [
      // "ont i höften" is the hip, not the district Höften
      ['Järfälla', 'kvinnan är vaken och talbar, men har ont i höften och huvudet.', 59.423, 17.836],
      // A direction is not where it happened
      ['Sundbyberg', 'Mannen lämnade med tunnelbanan i riktning mot Fridhemsplan.', 59.3689, 17.9494],
      // The kommun itself
      ['Gullspång', 'Olovlig körning – Gullspång – När patrull kontrollerar en personbil i Gullspångs kommun.', 58.8589, 14.2212],
      ['Luleå', 'Under natten har en berusad person i Luleå omhändertagits enligt LOB.', 65.6454, 22.2281],
      ['Östersund', 'Larm om berusade ungdomar i östersund. Polisen åker dit.', 63.1728, 14.6886],
      ['Vaggeryd', 'Trafikolycka, Vaggeryd – Två personbilar har kolliderat vid en landsvägskorsning.', 57.5297, 14.0672],
      // A street, not the area of its first word
      ['Helsingborg', 'En man vid gångtunneln vid Berga Allé blir påkörd.', 56.0658, 12.7112],
    ];
    for (const [kommun, text, lat, lng] of cases) expect(placeFromText(ev(kommun, text, lat, lng), data), text).toBeNull();
  });
});
