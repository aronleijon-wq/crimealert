import { describe, it, expect } from 'vitest';
import { EXPLOSIONS, LETHAL_VIOLENCE, REPORTED, SHOOTINGS, SHOOTINGS_FIRST_HALF, first, formatChange, last, percentChange, previous } from './crimeTrends';

describe('national crime trends', () => {
  it('cover the last three full years, oldest first, with sources', () => {
    for (const t of [SHOOTINGS, EXPLOSIONS]) {
      expect(t.values.map((v) => v.year)).toEqual([2023, 2024, 2025]);
      for (const d of t.details ?? []) expect(d.values.map((v) => v.year)).toEqual([2023, 2024, 2025]);
      expect(t.sources.length).toBeGreaterThan(0);
      for (const s of t.sources) expect(s.url).toMatch(/^https:\/\/(polisen|bra)\.se\//);
    }
  });

  it('give the changes Polisen and Brå report', () => {
    expect(percentChange(first(SHOOTINGS).value, last(SHOOTINGS).value)).toBe(-57);
    expect(percentChange(previous(EXPLOSIONS).value, last(EXPLOSIONS).value)).toBe(39);
    // Brå: bostadsinbrott −15 %, inbrottsstöld −18 %, stöld −12 %, misshandel +4 %, bedrägeri +1 %
    expect(REPORTED.map((r) => percentChange(r.before, r.after))).toEqual([-15, -18, -12, 4, 1]);
    // Brå: 1 607 fewer burglaries, 3 218 more assaults, 2 532 more frauds
    expect(REPORTED[0].before - REPORTED[0].after).toBe(1607);
    expect(REPORTED[3].after - REPORTED[3].before).toBe(3218);
    expect(REPORTED[4].after - REPORTED[4].before).toBe(2532);
  });

  it('writes changes the Swedish way', () => {
    expect(formatChange(-57)).toBe('−57 %');
    expect(formatChange(4)).toBe('+4 %');
    expect(formatChange(0)).toBe('±0 %');
  });
});

describe('the long series', () => {
  it('has every first half from 2017, oldest first', () => {
    expect(SHOOTINGS_FIRST_HALF.map((r) => r.year)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    for (const r of SHOOTINGS_FIRST_HALF) expect(r.dead).toBeLessThan(r.shootings);
  });

  it('agrees with the half-year comparison and Polisen\'s −81 % since 2022', () => {
    const at = (y: number) => SHOOTINGS_FIRST_HALF.find((r) => r.year === y)!;
    expect(at(2026).shootings).toBe(SHOOTINGS.halfYear!.value);
    expect(at(2025).shootings).toBe(SHOOTINGS.halfYear!.before);
    expect(percentChange(at(2022).shootings, at(2026).shootings)).toBe(-81);
  });

  it('gives Brå\'s lethal violence, firearms part of the total', () => {
    expect(LETHAL_VIOLENCE.map((r) => r.year)).toEqual([2022, 2023, 2024, 2025]);
    for (const r of LETHAL_VIOLENCE) expect(r.firearm).toBeLessThan(r.total);
    // Brå: 2025 had 8 fewer cases than 2024, 2024 had 29 fewer than 2023
    expect(LETHAL_VIOLENCE[2].total - LETHAL_VIOLENCE[3].total).toBe(8);
    expect(LETHAL_VIOLENCE[1].total - LETHAL_VIOLENCE[2].total).toBe(29);
  });
});
