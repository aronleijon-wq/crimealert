import { describe, expect, it } from 'vitest';
import { ILLUSTRATIONS, illustrationFocus, illustrationFor, illustrationKeys, inDaylight } from './eventIllustration';

const ev = (originalType: string, description = '', type = 'police') => ({ type, originalType, title: `22 november 02.14, ${originalType}, Stockholm`, description });

describe('illustrationKeys', () => {
  it('picks the picture from the kind of event and the words in its text', () => {
    expect(illustrationKeys(ev('Brand', 'Brand i lägenhet på tredje våningen.', 'fire'))[0]).toBe('brand-lagenhet');
    expect(illustrationKeys(ev('Brand', 'En personbil brinner på en parkering.', 'fire'))[0]).toBe('brand-bil');
    expect(illustrationKeys(ev('Brand', 'Brand i villa i Bromma.', 'fire'))[0]).toBe('brand-villa');
    expect(illustrationKeys(ev('Trafikolycka, vilt', 'Kollision med älg.'))[0]).toBe('trafik-vilt');
    expect(illustrationKeys(ev('Trafikolycka', 'Två bilar har kolliderat på E4 norr om Uppsala.'))[0]).toBe('trafik-motorvag');
    expect(illustrationKeys(ev('Trafikolycka', 'Kollision i en korsning i centrum.'))[0]).toBe('trafik-stad');
    expect(illustrationKeys(ev('Inbrott', 'Inbrott i en villa under natten.'))[0]).toBe('inbrott-villa');
    expect(illustrationKeys(ev('Rån', 'Rån mot en butik.'))[0]).toBe('ran');
    expect(illustrationKeys(ev('Rattfylleri'))).toEqual(['rattfylleri', 'trafikkontroll', 'polisinsats']);
    expect(illustrationKeys(ev('Trafikkontroll'))[0]).toBe('trafikkontroll');
    expect(illustrationKeys(ev('Sammanfattning natt'))[0]).toBe('natt');
  });
});

describe('illustrationFor', () => {
  const available = { 'brand-lagenhet': '/a.jpg', 'trafik-stad': '/b.jpg', 'inbrott-villa': '/c.jpg' };

  it('uses the picture made for the event when there is one', () => {
    expect(illustrationFor(ev('Brand', 'Brand i lägenhet.', 'fire'), available)).toBe('/a.jpg');
  });

  it('falls back to a picture of the same kind, and shows none for a kind without pictures', () => {
    expect(illustrationFor(ev('Brand', 'En bil brinner.', 'fire'), available)).toBe('/a.jpg');
    expect(illustrationFor(ev('Trafikolycka', 'Kollision på E4.'), available)).toBe('/b.jpg');
    expect(illustrationFor(ev('Inbrott', 'Inbrott i källarförråd.'), available)).toBe('/c.jpg');
    expect(illustrationFor(ev('Misshandel', 'Misshandel utanför en krog.'), available)).toBeNull();
    expect(illustrationFor(ev('Rattfylleri'), available)).toBeNull();
  });

  it('shows a robbery of a shop as a shop behind cordon tape until robberies have their own picture', () => {
    const shops = { 'inbrott-butik': '/e.jpg' };
    expect(illustrationFor(ev('Rån', 'Rån mot en butik i centrum.'), shops)).toBe('/e.jpg');
    expect(illustrationFor(ev('Rån', 'En man blev rånad på sin telefon i en park.'), shops)).toBeNull();
  });

  it('shows police cars on a street for a police event without a picture of its own', () => {
    const street = { misshandel: '/m.jpg', 'brand-lagenhet': '/a.jpg' };
    expect(illustrationFor(ev('Bedrägeri', 'Ett telefonbedrägeri.'), street)).toBe('/m.jpg');
    expect(illustrationFor(ev('Brand', 'En bil brinner.', 'fire'), street)).toBe('/a.jpg');
  });

  it('uses the daylight picture in daylight and the night one otherwise', () => {
    const pics = { 'trafik-stad': '/n.jpg', 'trafik-stad-dag': '/d.jpg', misshandel: '/mn.jpg', 'misshandel-dag': '/md.jpg', 'stold-dag': '/sd.jpg' };
    const at = (time: string, orig: string, desc: string) => ({ ...ev(orig, desc), time });
    // 14.00 in November is daylight, 17.00 is dark; in June 21.00 is still light
    expect(illustrationFor(at('2026-11-22T13:00:00Z', 'Trafikolycka', 'Krock i en korsning.'), pics)).toBe('/d.jpg');
    expect(illustrationFor(at('2026-11-22T16:00:00Z', 'Trafikolycka', 'Krock i en korsning.'), pics)).toBe('/n.jpg');
    expect(illustrationFor(at('2026-06-20T19:00:00Z', 'Trafikolycka', 'Krock i en korsning.'), pics)).toBe('/d.jpg');
    // A theft in daylight has its own picture; at night it falls back to the street, at night
    expect(illustrationFor(at('2026-11-22T11:00:00Z', 'Stöld', 'Stöld ur en butik.'), pics)).toBe('/sd.jpg');
    expect(illustrationFor(at('2026-11-22T22:00:00Z', 'Stöld', 'Stöld ur en butik.'), pics)).toBe('/mn.jpg');
    // Drunk driving by day shows a traffic check by day, at night its own picture
    const roads = { rattfylleri: '/r.jpg', trafikkontroll: '/t.jpg', 'trafikkontroll-dag': '/td.jpg' };
    expect(illustrationFor(at('2026-11-22T11:00:00Z', 'Rattfylleri', ''), roads)).toBe('/td.jpg');
    expect(illustrationFor(at('2026-11-22T22:00:00Z', 'Rattfylleri', ''), roads)).toBe('/r.jpg');
    // In the police's own format too
    expect(inDaylight('2026-11-22 14:05:00 +01:00')).toBe(true);
    expect(inDaylight('2026-11-22 21:05:00 +01:00')).toBe(false);
    expect(inDaylight(null)).toBe(false);
  });

  it('keeps the general picture of a family in front when there are more', () => {
    const more = { ...available, 'trafik-lastbil': '/d.jpg' };
    expect(illustrationFor(ev('Trafikolycka', 'Kollision på E4.'), more)).toBe('/b.jpg');
    expect(illustrationFor(ev('Trafikolycka', 'En lastbil har vält.'), more)).toBe('/d.jpg');
  });

  it('keeps the action in view when a picture is cropped', () => {
    expect(illustrationFocus('/a.jpg', { 'brand-lagenhet': '/a.jpg' })).toBe('50% 28%');
    expect(illustrationFocus('/d.jpg', { 'trafik-lastbil': '/d.jpg' })).toBe('50% 62%');
  });

  it('finds the pictures in src/assets/illustrationer', () => {
    expect(Object.keys(ILLUSTRATIONS)).toEqual(expect.arrayContaining(['brand-lagenhet', 'trafik-stad', 'inbrott-villa', 'trafik-lastbil', 'skottlossning', 'vatten', 'trafik-motorvag', 'inbrott-butik', 'sprangning', 'brand-container', 'brand-skog', 'inbrott-lagenhet', 'natt', 'trafikkontroll', 'misshandel', 'trafik-vilt', 'brand-bil', 'narkotika', 'hot', 'skadegorelse', 'rattfylleri', 'trafik-stad-dag', 'trafik-motorvag-dag', 'trafikkontroll-dag', 'stold-dag', 'bedrageri-dag', 'misshandel-dag']));
  });
});
