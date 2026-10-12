import { describe, it, expect } from 'vitest';
import { EXPLOSIONS, REPORTED, SHOOTINGS, first, formatChange, last, percentChange, previous } from './crimeTrends';

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
