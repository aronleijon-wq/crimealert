import { describe, it, expect } from 'vitest';
import { areaStats, change, insights, kommunChanges, risingKommuner, swedishTime, themeOf, type StatEvent } from './stats';

const DAY = 24 * 60 * 60 * 1000;
// Friday 6 November 2026, 12:00 in Sweden
const NOW = Date.UTC(2026, 10, 6, 11, 0);
const ev = (daysAgo: number, category: string, area = 'Malmö', hour = 0): StatEvent => ({ at: NOW - daysAgo * DAY - hour * 60 * 60 * 1000, area, category });

describe('the app’s statistics', () => {
  it('groups Polisen’s categories as people talk about them', () => {
    expect(themeOf('Skottlossning, misstänkt')?.id).toBe('skjutning');
    expect(themeOf('Detonation')?.id).toBe('sprangning');
    expect(themeOf('Rån väpnat')?.id).toBe('ran');
    expect(themeOf('Stöld/inbrott')?.id).toBe('inbrott');
    expect(themeOf('Misshandel, grov')?.id).toBe('misshandel');
    expect(themeOf('Ordningslagen')).toBeNull();
  });

  it('tells Swedish day, hour and weekday', () => {
    expect(swedishTime(NOW)).toEqual({ day: '2026-11-06', hour: 12, weekday: 4 });
  });

  it('says only meaningful changes', () => {
    expect(change(10, 5)).toBe(100);
    expect(change(4, 8)).toBe(-50);
    expect(change(1, 2)).toBeNull();
    expect(change(5, 0)).toBeNull();
  });

  it('counts kinds of crime now and before, for one kommun', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => ev(1 + i, 'Skottlossning')),
      ...Array.from({ length: 3 }, (_, i) => ev(10 + i, 'Skottlossning')),
      ev(2, 'Rån'), ev(3, 'Skottlossning', 'Lund'), ev(1, 'Sammanfattning natt'),
    ];
    const stats = areaStats(events, 'Malmö', 7, NOW);
    const shootings = stats.trends.find((t) => t.theme.id === 'skjutning')!;
    expect(shootings).toMatchObject({ count: 6, previous: 3, change: 100 });
    expect(stats.total).toBe(7);
    expect(stats.daily).toHaveLength(7);
    expect(stats.sinceLast.find((s) => s.theme.id === 'skjutning')?.days).toBe(1);
    expect(stats.sinceLast.find((s) => s.theme.id === 'mord')?.days).toBeNull();
    expect(areaStats(events, null, 7, NOW).total).toBe(8);
    // Shootings, explosions, murder and robbery always lead, even at zero
    expect(stats.trends.slice(0, 4).map((t) => t.theme.id)).toEqual(['skjutning', 'sprangning', 'mord', 'ran']);
  });

  it('finds when in the week things happen', () => {
    const stats = areaStats([ev(0, 'Stöld', 'Malmö', 1), ev(7 * 0 + 0, 'Stöld', 'Malmö', 1), ev(3, 'Stöld')], 'Malmö', 7, NOW);
    expect(stats.peak).toMatchObject({ weekday: 4, hour: 11, count: 2 });
  });

  it('compares kommuner and finds where it rises most', () => {
    const events = [
      ...Array.from({ length: 20 }, (_, i) => ev(i % 7, 'Stöld', 'Lund')),
      ...Array.from({ length: 10 }, (_, i) => ev(8 + (i % 6), 'Stöld', 'Lund')),
      ...Array.from({ length: 12 }, (_, i) => ev(8 + (i % 6), 'Stöld', 'Malmö')),
    ];
    const rows = kommunChanges(events, 7, NOW);
    expect(rows[0]).toMatchObject({ name: 'Lund', count: 20, previous: 10, change: 100 });
    expect(risingKommuner(rows).map((r) => r.name)).toEqual(['Lund']);
  });

  it('writes what matters in plain Swedish', () => {
    const events = [
      ...Array.from({ length: 12 }, (_, i) => ev(i % 7, 'Inbrott')),
      ...Array.from({ length: 4 }, (_, i) => ev(8 + i, 'Inbrott')),
      ...Array.from({ length: 10 }, (_, i) => ev(i % 7, 'Stöld', 'Malmö', 2)),
      ev(20, 'Skottlossning'),
    ];
    const lines = insights(areaStats(events, 'Malmö', 7, NOW), 'Malmö', 7);
    expect(lines[0]).toMatch(/^Inbrott har ökat med 200 % i Malmö/);
    expect(lines.join(' ')).toMatch(/Det har gått 20 dagar sedan Polisen senast rapporterade en skjutning i Malmö/);
  });
});
