import { describe, it, expect } from 'vitest';
import { nearestKommuner, searchKommuner, SWEDISH_KOMMUNER } from './kommuner';

describe('kommuner', () => {
  it('lists every municipality once', () => {
    expect(SWEDISH_KOMMUNER).toHaveLength(290);
    expect(new Set(SWEDISH_KOMMUNER).size).toBe(290);
  });

  it('finds municipalities without accents and by later words', () => {
    expect(searchKommuner('malmo')[0]).toBe('Malmö');
    expect(searchKommuner('Göte')).toEqual(['Göteborg', 'Götene']);
    expect(searchKommuner('väsby')).toEqual(['Upplands Väsby']);
    expect(searchKommuner('bro')).toContain('Upplands-Bro');
    expect(searchKommuner('')).toEqual([]);
  });

  it('suggests the municipalities nearest a position', () => {
    // Uppsala cathedral
    expect(nearestKommuner(59.858, 17.633, 1)).toEqual(['Uppsala']);
    // Danderyd is not in the shared coordinate list
    expect(nearestKommuner(59.405, 18.035, 1)).toEqual(['Danderyd']);
  });
});
