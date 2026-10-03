import { describe, it, expect } from 'vitest';
import type { Incident } from '@/data/mockIncidents';
import { firstEnd, historyEvents, historyLabel, HISTORY_RANGES } from './history';
import { heatPalette, heatStyle } from './heatLayer';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600e3).toISOString();
const event = (id: string, h: number, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'police', title: 'Stöld', description: '', lat: 59, lng: 18, area: 'Stockholm', time: hoursAgo(h),
  status: 'active', risk: 'low', source: 'Polisen.se', ...extra,
});

describe('historyEvents', () => {
  const incidents = [
    event('a', 1), event('b', 5), event('c', 30), event('d', 24 * 10), event('e', 24 * 40),
    event('tv', 1, { type: 'trafikverket', source: 'Trafikverket' }), event('vma', 1, { type: 'crisis' }),
    event('rep', 1, { source: 'Medborgarrapport' }),
  ];

  it('keeps Polisen’s events in the range', () => {
    expect(historyEvents(incidents, '24h', null, NOW).map((i) => i.id)).toEqual(['a', 'b']);
    expect(historyEvents(incidents, '7d', null, NOW).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(historyEvents(incidents, '30d', null, NOW).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the window ending at a chosen time', () => {
    expect(historyEvents(incidents, '24h', NOW - 4 * 3600e3, NOW).map((i) => i.id)).toEqual(['b']);
    expect(historyEvents(incidents, '7d', NOW - 24 * 3600e3, NOW).map((i) => i.id)).toEqual(['c']);
  });

  it('starts the window one window into the range', () => {
    expect(firstEnd('7d', NOW)).toBe(NOW - 7 * 86400e3 + HISTORY_RANGES['7d'].window);
  });
});

describe('historyLabel', () => {
  it('names the range or the window', () => {
    expect(historyLabel('7d', null)).toBe('Senaste 7 dagar');
    expect(historyLabel('24h', null)).toBe('Senaste dygnet');
    expect(historyLabel('24h', Date.parse('2026-10-03T12:00:00Z'))).toBe('lör 3 okt 12:00 – 14:00');
  });
});

describe('heatmap', () => {
  it('runs from transparent through blue to red', () => {
    const p = heatPalette();
    expect([...p.slice(0, 4)]).toEqual([43, 131, 186, 0]);
    expect([...p.slice(255 * 4, 255 * 4 + 3)]).toEqual([229, 56, 59]);
    expect(p[255 * 4 + 3]).toBeGreaterThan(200);
  });

  it('draws larger blobs when zoomed in', () => {
    expect(heatStyle(5).radius).toBeLessThan(heatStyle(10).radius);
    expect(heatStyle(16).radius).toBe(34);
  });
});
