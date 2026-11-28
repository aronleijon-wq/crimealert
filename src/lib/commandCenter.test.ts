import { describe, expect, it } from 'vitest';
import { change, funnelSteps, share, sourceName, stickiness } from './commandCenter';

describe('command centre numbers', () => {
  it('works out shares and week-on-week change', () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(5, 0)).toBeNull();
    expect(change(15, 10)).toBe(50);
    expect(change(5, 10)).toBe(-50);
    expect(change(3, 0)).toBeNull();
  });

  it('builds the funnel from visit to paying', () => {
    const steps = funnelSteps({ visits: 1000, signups: 50, proStarts: 10, paying: 0 });
    expect(steps.map((s) => s.label)).toEqual(['Besök', 'Nya konton', 'Startade Pro', 'Betalar nu']);
    expect(steps[0]).toMatchObject({ width: 100, fromPrevious: null });
    expect(steps[1]).toMatchObject({ width: 5, fromPrevious: 5 });
    expect(steps[2]).toMatchObject({ width: 2, fromPrevious: 20 });
    expect(steps[3]).toMatchObject({ width: 0, fromPrevious: 0 });
  });

  it('copes with nothing yet', () => {
    expect(funnelSteps({ visits: 0, signups: 0, proStarts: 0, paying: 0 }).every((s) => s.width === 0)).toBe(true);
    expect(stickiness({ dau: 0, wau: 0, mau: 0, d7: { cohort: 0, back: 0 }, d30: { cohort: 0, back: 0 } })).toBeNull();
  });

  it('names the sources', () => {
    expect(sourceName('meta')).toBe('Meta (FB/IG)');
    expect(sourceName('nyhetsbrev')).toBe('nyhetsbrev');
  });
});
