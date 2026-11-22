import { describe, expect, it } from 'vitest';
import { ILLUSTRATIONS, illustrationFocus, illustrationFor, illustrationKeys } from './eventIllustration';

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
    expect(illustrationKeys(ev('Rattfylleri'))[0]).toBe('trafikkontroll');
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
    expect(Object.keys(ILLUSTRATIONS)).toEqual(expect.arrayContaining(['brand-lagenhet', 'trafik-stad', 'inbrott-villa', 'trafik-lastbil', 'skottlossning', 'vatten', 'trafik-motorvag', 'inbrott-butik', 'sprangning']));
  });
});
