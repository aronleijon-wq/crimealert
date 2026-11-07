import { describe, it, expect } from 'vitest';
import { cardTime, wrapLines } from './shareCard';

// One unit per character, so widths are easy to follow
const measure = (t: string) => t.length;

describe('share pictures', () => {
  it('wraps text to the width and shortens what does not fit', () => {
    expect(wrapLines(measure, 'Misshandel grov Malmö', 12, 3)).toEqual(['Misshandel', 'grov Malmö']);
    expect(wrapLines(measure, 'ett två tre fyra fem sex', 7, 2)).toEqual(['ett två', 'tre…']);
    expect(wrapLines(measure, 'Trafikolycka', 5, 2)).toEqual(['Trafikolycka']);
  });

  it('says when, in Swedish time', () => {
    expect(cardTime(Date.UTC(2026, 10, 7, 11, 5))).toBe('lördag 7 november kl. 12.05');
  });
});
