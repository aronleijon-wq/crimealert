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
