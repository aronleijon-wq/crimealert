import { describe, it, expect } from 'vitest';
import {
  areaMatchesKommun,
  buildPushMessage,
  DEFAULT_NOTIFY_SETTINGS,
  freeMayNotify,
  reachedFreeWithin,
  safeAppPath,
  settingsFromRow,
  wantsEvent,
  watchedKommunFor,
  type PushEvent,
} from './notifications';

describe('areaMatchesKommun', () => {
  it('matches the kommun, its genitive and its county', () => {
    expect(areaMatchesKommun('Uppsala', 'Uppsala')).toBe(true);
    expect(areaMatchesKommun('Lunds kommun', 'Lund')).toBe(true);
    expect(areaMatchesKommun('Stockholms län', 'Stockholm')).toBe(true);
    expect(areaMatchesKommun('Upplands-Bro', 'Upplands-Bro')).toBe(true);
    expect(areaMatchesKommun('Borås', 'Borås')).toBe(true);
    expect(areaMatchesKommun('MALMÖ', 'Malmö')).toBe(true);
  });

  it('does not match a kommun inside another name', () => {
    expect(areaMatchesKommun('Uppsala', 'Sala')).toBe(false);
    expect(areaMatchesKommun('Falkenberg', 'Berg')).toBe(false);
    expect(areaMatchesKommun('Sundbyberg', 'Berg')).toBe(false);
    expect(areaMatchesKommun('Markaryd', 'Mark')).toBe(false);
    expect(areaMatchesKommun('', 'Lund')).toBe(false);
    expect(areaMatchesKommun(null, 'Lund')).toBe(false);
  });

  it('finds the watched kommun', () => {
    expect(watchedKommunFor('Uppsala län', ['Sala', 'Uppsala'])).toBe('Uppsala');
    expect(watchedKommunFor('Uppsala', ['Sala'])).toBeNull();
  });
});

describe('settings', () => {
  it('defaults to everything', () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_NOTIFY_SETTINGS);
    expect(settingsFromRow({ types: ['fire', 'bogus'], min_risk: 'nonsense' })).toEqual({ types: ['fire'], minRisk: 'low' });
  });

  it('filters by type and risk', () => {
    const s = settingsFromRow({ types: ['fire', 'police'], min_risk: 'medium' });
    expect(wantsEvent(s, { type: 'fire', risk: 'high' })).toBe(true);
    expect(wantsEvent(s, { type: 'police', risk: 'medium' })).toBe(true);
    expect(wantsEvent(s, { type: 'police', risk: 'low' })).toBe(false);
    expect(wantsEvent(s, { type: 'traffic', risk: 'high' })).toBe(false);
    expect(wantsEvent(DEFAULT_NOTIFY_SETTINGS, { type: 'unknown', risk: null })).toBe(true);
  });
});

describe('buildPushMessage', () => {
  const event = (id: string, time: string, extra: Partial<PushEvent> = {}): PushEvent => ({
    id, title: `02 oktober, Brand, Uppsala`, area: 'Uppsala', type: 'fire', risk: 'high', time, original_type: 'Brand', ...extra,
  });

  it('describes a single event and opens it on the map', () => {
    const message = buildPushMessage([event('e1', '2026-10-02T12:05:00+00:00')]);
    expect(message.title).toBe('🔥 Brand · Uppsala');
    expect(message.body).toBe('Kl. 14:05 · Polisen rapporterar en ny händelse i Uppsala. Tryck för att se den på kartan.');
    expect(message.url).toBe('/karta?incident=e1');
    expect(message.incidentId).toBe('e1');
  });

  it('summarises several events, newest first', () => {
    const message = buildPushMessage([
      event('e1', '2026-10-02T10:00:00Z'),
      event('e2', '2026-10-02T11:00:00Z', { type: 'police', original_type: 'Rån', area: 'Malmö' }),
      event('e3', '2026-10-02T09:00:00Z', { type: 'traffic', original_type: null, area: 'Lund' }),
      event('e4', '2026-10-02T08:00:00Z'),
    ]);
    expect(message.title).toBe('4 nya händelser i dina områden');
    expect(message.body.split('\n')).toEqual([
      '🚨 Rån · Malmö (13:00)',
      '🔥 Brand · Uppsala (12:00)',
      '🚗 Trafikolycka · Lund (11:00)',
      'och 1 till',
    ]);
    expect(message.url).toBe('/alerts');
    expect(message.incidentId).toBeNull();
  });
});

describe('safeAppPath', () => {
  it('only accepts paths inside the app', () => {
    expect(safeAppPath('/debug-push')).toBe('/debug-push');
    expect(safeAppPath('https://evil.example')).toBe('/alerts');
    expect(safeAppPath('//evil.example')).toBe('/alerts');
    expect(safeAppPath(undefined)).toBe('/alerts');
  });
});

describe('free delay', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');

  it('lets free accounts hear about an event 15 minutes after it happened, as on the map', () => {
    expect(freeMayNotify('2026-10-03 13:44:00 +02:00', now)).toBe(true);
    expect(freeMayNotify('2026-10-03T11:46:00+00:00', now)).toBe(false);
    expect(freeMayNotify('inte en tid', now)).toBe(false);
  });

  it('notices events that just reached free accounts', () => {
    const window = 12 * 60 * 1000;
    expect(reachedFreeWithin('2026-10-03T11:40:00+00:00', now, window)).toBe(true);
    expect(reachedFreeWithin('2026-10-03T11:30:00+00:00', now, window)).toBe(false);
    expect(reachedFreeWithin('2026-10-03T11:50:00+00:00', now, window)).toBe(false);
  });
});
