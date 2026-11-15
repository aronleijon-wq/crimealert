import { describe, expect, it } from 'vitest';
import { BRA_LATEST, braKommun, braRanking, swedenRate } from './braStats';
import { BRA_RATES, BRA_TYPES } from './data/braRates';
import { KOMMUN_POPULATION } from './data/population';

describe('Brå statistics', () => {
  it('has every kind for every kommun in the latest year', () => {
    for (const t of BRA_TYPES) expect(Object.keys(BRA_RATES[t.id][BRA_LATEST])).toHaveLength(Object.keys(KOMMUN_POPULATION).length);
  });

  it("weighs the country's level by population, between the lowest and highest kommun", () => {
    const rates = Object.values(BRA_RATES.brott_totalt[BRA_LATEST]);
    const sweden = swedenRate('brott_totalt', BRA_LATEST)!;
    expect(sweden).toBeGreaterThan(Math.min(...rates));
    expect(sweden).toBeLessThan(Math.max(...rates));
  });

  it("gives a kommun's level, the year before, the country and its place", () => {
    const r = braKommun('Norrköping');
    expect(r.invanare).toBe(KOMMUN_POPULATION['Norrköping']);
    expect(r.sorter).toHaveLength(BRA_TYPES.length);
    const total = r.sorter.find((s) => s.sort === 'Anmälda brott totalt')!;
    expect(total.per_100_000).toBe(BRA_RATES.brott_totalt[BRA_LATEST]['Norrköping']);
    expect(total.plats_av_kommunerna?.av).toBe(290);
    expect(total.ungefar_antal).toBeGreaterThan(1000);
  });

  it('ranks the kommuner, lowest first, among those of a given size', () => {
    const r = braRanking({ sort: 'bostadsinbrott', ordning: 'lagst', min_invanare: 50_000 });
    expect(r.kommuner).toHaveLength(10);
    expect(r.kommuner.every((k) => (k.invanare ?? 0) >= 50_000)).toBe(true);
    const rates = r.kommuner.map((k) => k.per_100_000);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });
});
