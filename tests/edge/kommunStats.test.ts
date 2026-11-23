import { describe, expect, it } from 'vitest';
import { kommunStats, latestYear, statsRanking, swedenRate } from "../../supabase/functions/_shared/kommunStats";
import { STAT_RATES, STAT_TYPES } from "../../supabase/functions/_shared/data/kommunStats";
import { KOMMUN_POPULATION } from "../../supabase/functions/_shared/data/population";

describe('statistics per kommun', () => {
  it('has every kind for every kommun in its latest year', () => {
    for (const t of STAT_TYPES) expect(Object.keys(STAT_RATES[t.id][latestYear(t.id)])).toHaveLength(Object.keys(KOMMUN_POPULATION).length);
  });

  it("weighs the country's level by population, between the lowest and highest kommun", () => {
    for (const id of ['brott_totalt', 'byggnadsbrander']) {
      const rates = Object.values(STAT_RATES[id][latestYear(id)]);
      const sweden = swedenRate(id, latestYear(id))!;
      expect(sweden).toBeGreaterThan(Math.min(...rates));
      expect(sweden).toBeLessThan(Math.max(...rates));
    }
  });

  it("gives a kommun's reported crimes and the rescue service's call-outs", () => {
    const r = kommunStats('Norrköping');
    expect(r.invanare).toBe(KOMMUN_POPULATION['Norrköping']);
    const [bra, mcf] = Object.values(r.kallor);
    expect(bra).toHaveLength(16);
    expect(mcf).toHaveLength(2);
    const total = bra.find((s) => s.sort === 'Anmälda brott totalt')!;
    expect(total.per_100_000).toBe(STAT_RATES.brott_totalt[2025]['Norrköping']);
    expect(total.jamfort_med_ar).toBe(2024);
    expect(total.plats_av_kommunerna?.av).toBe(290);
    // Building fires have one year only, so no comparison
    expect(mcf.find((s) => s.sort.startsWith('Bränder'))).not.toHaveProperty('jamfort_med_ar');
  });

  it('ranks the kommuner, lowest first, among those of a given size', () => {
    const r = statsRanking({ sort: 'bostadsinbrott', ordning: 'lagst', min_invanare: 50_000 });
    expect(r.kommuner).toHaveLength(10);
    expect(r.kommuner.every((k) => (k.invanare ?? 0) >= 50_000)).toBe(true);
    const rates = r.kommuner.map((k) => k.per_100_000);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });
});
