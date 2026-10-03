import { describe, it, expect } from 'vitest';
import { buildWeeklyMessage, inSummaryWindow, summarizeKommun, weekKey } from './weeklySummary';

describe('week and window', () => {
  it('numbers weeks as in Sweden', () => {
    expect(weekKey(Date.parse('2026-10-04T16:30:00Z'))).toBe('2026-W40'); // Sunday 18:30 CEST
    expect(weekKey(Date.parse('2026-10-04T22:30:00Z'))).toBe('2026-W41'); // already Monday in Sweden
    expect(weekKey(Date.parse('2027-01-03T12:00:00Z'))).toBe('2026-W53');
  });

  it('sends on Sunday evenings, summer and winter time', () => {
    expect(inSummaryWindow(Date.parse('2026-10-04T16:05:00Z'))).toBe(true); // 18:05 CEST
    expect(inSummaryWindow(Date.parse('2026-10-04T15:05:00Z'))).toBe(false); // 17:05
    expect(inSummaryWindow(Date.parse('2026-12-06T17:05:00Z'))).toBe(true); // 18:05 CET
    expect(inSummaryWindow(Date.parse('2026-12-06T20:05:00Z'))).toBe(false); // 21:05
    expect(inSummaryWindow(Date.parse('2026-10-03T16:05:00Z'))).toBe(false); // Saturday
  });
});

describe('summarizeKommun', () => {
  const now = Date.parse('2026-10-04T16:00:00Z');
  const ago = (days: number) => new Date(now - days * 86400e3).toISOString();
  const events = [
    { area: 'Malmö', original_type: 'Stöld', time: ago(1) },
    { area: 'Malmö', original_type: 'Stöld', time: ago(2) },
    { area: 'Malmö', original_type: 'Rån', time: ago(3) },
    { area: 'Malmö', original_type: 'Sammanfattning natt', time: ago(1) },
    { area: 'Malmö', original_type: 'Brand', time: ago(9) },
    { area: 'Malmö', original_type: 'Brand', time: ago(20) },
    { area: 'Sala', original_type: 'Stöld', time: ago(1) },
  ];

  it('counts this week and last week, without summaries', () => {
    expect(summarizeKommun(events, 'Malmö', now)).toEqual({ kommun: 'Malmö', thisWeek: 3, lastWeek: 1, top: { name: 'Stöld', count: 2 } });
    expect(summarizeKommun(events, 'Uppsala', now)).toEqual({ kommun: 'Uppsala', thisWeek: 0, lastWeek: 0, top: null });
  });

  it('writes one kommun as a sentence linking to its page', () => {
    expect(buildWeeklyMessage([summarizeKommun(events, 'Malmö', now)])).toEqual({
      title: 'Veckan i Malmö',
      body: '3 händelser från Polisen senaste veckan, fler än veckan innan (1). Vanligast: Stöld (2).',
      url: '/kommun/malmo', tag: 'crimealert-weekly', incidentId: null,
    });
    expect(buildWeeklyMessage([summarizeKommun(events, 'Upplands Väsby', now)]).body).toBe('Polisen rapporterade inget i Upplands Väsby den senaste veckan.');
  });

  it('lists several kommuner, busiest first', () => {
    const message = buildWeeklyMessage(['Lund', 'Malmö', 'Sala'].map((k) => summarizeKommun(events, k, now)));
    expect(message.title).toBe('Veckan i dina områden');
    expect(message.body).toBe('Malmö: 3 händelser (veckan innan 1)\nSala: 1 händelse (veckan innan 0)\nLund: 0 händelser (veckan innan 0)');
    expect(message.url).toBe('/alerts');
  });
});
