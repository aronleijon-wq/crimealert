import { describe, expect, it } from 'vitest';
import { SWEDISH_KOMMUNER } from './kommuner';
import { KOMMUN_POPULATION } from './kommunPopulation';

describe('KOMMUN_POPULATION', () => {
  it('has a positive integer for every kommun', () => {
    for (const name of SWEDISH_KOMMUNER) {
      const value = KOMMUN_POPULATION[name];
      expect(Number.isInteger(value), name).toBe(true);
      expect(value, name).toBeGreaterThan(0);
    }
  });

  it('has a plausible national total', () => {
    const total = SWEDISH_KOMMUNER.reduce((sum, name) => sum + KOMMUN_POPULATION[name], 0);
    expect(total).toBeGreaterThan(10_000_000);
    expect(total).toBeLessThan(11_500_000);
  });
});
