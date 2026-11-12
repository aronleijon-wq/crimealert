import { describe, it, expect } from 'vitest';
import { KOMMUN_POPULATION } from '@/data/kommunPopulation';
import { buildAtlas, formatRatio, kommunOfArea, kommunProfile, mostCommon, per100k, ratioSentence, risingMost, themeRanking, THEMES, type AtlasRow } from './crimeAtlas';

const row = (area: string, category: string, now: number, before = 0): AtlasRow => ({ area, category, now_count: now, before_count: before });

describe('the crime atlas', () => {
  it('finds the kommun of a place name from Polisen', () => {
    expect(kommunOfArea('Nacka')).toBe('Nacka');
    expect(kommunOfArea('Upplands Väsby')).toBe('Upplands Väsby');
    expect(kommunOfArea('Ingenstans')).toBeNull();
  });

  it('counts per kommun and theme, with everything in "alla"', () => {
    const atlas = buildAtlas([row('Nacka', 'Inbrott', 4, 2), row('Nacka', 'Inbrott, försök', 1), row('Nacka', 'Övrigt', 3), row('Lund', 'Stöld', 2)]);
    expect(atlas.byKommun.get('Nacka')!.get('inbrott')).toEqual({ now: 5, before: 2 });
    expect(atlas.byKommun.get('Nacka')!.get('alla')).toEqual({ now: 8, before: 2 });
    expect(atlas.sweden.get('alla')!.now).toBe(10);
    expect(atlas.population).toBeGreaterThan(10_000_000);
  });

  it('compares a kommun with Sweden per inhabitant, only with enough events', () => {
    const atlas = buildAtlas([row('Nacka', 'Inbrott', 10), row('Stockholm', 'Inbrott', 10), row('Stockholm', 'Rån', 2)]);
    const nacka = kommunProfile(atlas, 'Nacka');
    const swedenRate = per100k(20, atlas.population);
    expect(nacka.themes[0].theme.id).toBe('inbrott');
    expect(nacka.themes[0].ratio).toBeCloseTo(per100k(10, KOMMUN_POPULATION.Nacka) / swedenRate, 5);
    expect(nacka.standout?.theme.id).toBe('inbrott');
    // Two robberies are too few to compare
    expect(kommunProfile(atlas, 'Stockholm').themes.find((t) => t.theme.id === 'ran')!.ratio).toBeNull();
  });

  it('ranks kommuner per inhabitant for a theme, and finds what rose', () => {
    const atlas = buildAtlas([row('Bjurholm', 'Stöld', 3), row('Stockholm', 'Stöld', 40, 20), row('Nacka', 'Stöld', 2, 10), row('Lund', 'Stöld', 1)]);
    const ranking = themeRanking(atlas, 'stold');
    expect(ranking[0].kommun).toBe('Bjurholm');
    expect(mostCommon(ranking).map((r) => r.kommun)).toEqual(['Bjurholm', 'Stockholm']);
    expect(risingMost(ranking).map((r) => [r.kommun, r.change])).toEqual([['Stockholm', 100]]);
  });

  it('says it the Swedish way', () => {
    const theme = THEMES.find((t) => t.id === 'inbrott')!;
    expect(formatRatio(2.34)).toBe('2,3×');
    expect(ratioSentence(theme, 'Nacka', 2.34)).toBe('Inbrott är 2,3× vanligare i Nacka än i Sverige');
    expect(ratioSentence(theme, 'Nacka', 0.5)).toBe('Inbrott är 2,0× ovanligare i Nacka än i Sverige');
  });
});

describe('the periods', () => {
  it('reaches back to the archive\'s first day for "Sedan start"', async () => {
    const { periodOf, daysSinceStart } = await import('./crimeAtlas');
    const now = Date.parse('2026-11-12T18:00:00+01:00');
    expect(daysSinceStart(now)).toBe(46);
    expect(periodOf('start', now)).toEqual({ days: 46, short: 'sedan 28 sep', long: 'sedan 28 september' });
    expect(periodOf('7', now)).toEqual({ days: 7, short: '7 dagar', long: 'de senaste 7 dagarna' });
  });
});

describe('placing events Polisen put on a whole län', () => {
  it('takes the kommun from the area, then the title, then the position', async () => {
    const { kommunOfRow, nearestKommun } = await import('./crimeAtlas');
    expect(kommunOfRow({ area: 'Nacka' })).toBe('Nacka');
    expect(kommunOfRow({ area: 'Stockholms län', place: 'Södertälje' })).toBe('Södertälje');
    // Södermalm, with the title only saying the län
    expect(kommunOfRow({ area: 'Stockholms län', place: 'Stockholms län', lat: 59.31, lng: 18.07 })).toBe('Stockholm');
    // Only the län, nowhere better: left out rather than guessed
    expect(kommunOfRow({ area: 'Stockholms län', place: 'Stockholms län' })).toBeNull();
    // Far out at sea is no kommun's
    expect(nearestKommun(57.0, 20.5)).toBeNull();
  });

  it('counts Stockholm from its län events', async () => {
    const { buildAtlas } = await import('./crimeAtlas');
    const atlas = buildAtlas([
      { area: 'Stockholms län', place: 'Stockholms län', lat: 59.33, lng: 18.06, category: 'Rån', now_count: 4, before_count: 1 },
      { area: 'Stockholms län', place: 'Huddinge', lat: null, lng: null, category: 'Inbrott', now_count: 2, before_count: 0 },
      { area: 'Stockholms län', place: 'Stockholms län', lat: null, lng: null, category: 'Brand', now_count: 9, before_count: 0 },
    ]);
    expect(atlas.byKommun.get('Stockholm')!.get('ran')!.now).toBe(4);
    expect(atlas.byKommun.get('Huddinge')!.get('inbrott')!.now).toBe(2);
    expect(atlas.sweden.get('alla')!.now).toBe(6);
  });
});
