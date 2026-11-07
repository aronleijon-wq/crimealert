import { describe, it, expect } from 'vitest';
import {
  areaMatchesKommun,
  buildPushMessage,
  DEFAULT_NOTIFY_SETTINGS,
  freeMayNotify,
  reachedFreeWithin,
  safeAppPath,
  settingsFromRow,
  settingsToRow,
  inQuietHours,
  nearEvent,
  distanceKm,
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
    expect(settingsFromRow({ types: ['fire', 'bogus'], min_risk: 'nonsense' })).toEqual({ types: ['fire'], minRisk: 'low', themes: null, quiet: null, near: null });
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

describe('kinds of crime, quiet hours and near me', () => {
  it('lets through only the chosen kinds of crime, whatever their type', () => {
    const s = settingsFromRow({ types: ['fire'], themes: ['inbrott', 'skjutning', 'okänd'] });
    expect(s.themes).toEqual(['inbrott', 'skjutning']);
    expect(wantsEvent(s, { type: 'police', risk: 'low', original_type: 'Inbrott, försök' })).toBe(true);
    expect(wantsEvent(s, { type: 'police', risk: 'high', original_type: 'Skottlossning' })).toBe(true);
    expect(wantsEvent(s, { type: 'fire', risk: 'high', original_type: 'Brand' })).toBe(false);
    // "Allt annat": what belongs to no kind of crime
    const other = settingsFromRow({ themes: ['annat'] });
    expect(wantsEvent(other, { type: 'other', risk: 'low', original_type: 'Försvunnen person' })).toBe(true);
    expect(wantsEvent(other, { type: 'police', risk: 'low', original_type: 'Rån' })).toBe(false);
    // Nothing chosen is the same as everything
    expect(settingsFromRow({ themes: [] }).themes).toBeNull();
  });

  it('keeps quiet in the chosen hours, over midnight too', () => {
    const s = settingsFromRow({ quiet_start: 23, quiet_end: 7 });
    expect(s.quiet).toEqual({ start: 23, end: 7 });
    // 23.30 and 06.59 Swedish winter time (UTC+1)
    expect(inQuietHours(s, Date.UTC(2026, 10, 7, 22, 30))).toBe(true);
    expect(inQuietHours(s, Date.UTC(2026, 10, 8, 5, 59))).toBe(true);
    expect(inQuietHours(s, Date.UTC(2026, 10, 8, 6, 0))).toBe(false);
    expect(inQuietHours(s, Date.UTC(2026, 10, 7, 12, 0))).toBe(false);
    const day = settingsFromRow({ quiet_start: 9, quiet_end: 17 });
    expect(inQuietHours(day, Date.UTC(2026, 10, 7, 12, 0))).toBe(true);
    expect(settingsFromRow({ quiet_start: 8, quiet_end: 8 }).quiet).toBeNull();
    expect(inQuietHours(DEFAULT_NOTIFY_SETTINGS, Date.now())).toBe(false);
  });

  it('tells about events within the circle', () => {
    const s = settingsFromRow({ near_lat: 59.3293, near_lng: 18.0686, near_radius_km: 5 });
    expect(nearEvent(s, { lat: 59.3326, lng: 18.0649 })).toBe(true); // Stockholm's centre
    expect(nearEvent(s, { lat: 59.8586, lng: 17.6389 })).toBe(false); // Uppsala, 65 km off
    expect(nearEvent(s, { lat: null, lng: null })).toBe(false);
    expect(nearEvent(DEFAULT_NOTIFY_SETTINGS, { lat: 59.33, lng: 18.07 })).toBe(false);
    expect(Math.round(distanceKm(59.3293, 18.0686, 57.7089, 11.9746))).toBe(397); // Stockholm–Göteborg as the crow flies
  });

  it('stores the place to about a hundred metres', () => {
    const s = settingsFromRow({ near_lat: 59.329312, near_lng: 18.068581, near_radius_km: 3, quiet_start: 22, quiet_end: 6, themes: ['inbrott'] });
    expect(settingsToRow(s)).toEqual({ types: s.types, min_risk: 'low', themes: ['inbrott'], quiet_start: 22, quiet_end: 6, near_lat: 59.329, near_lng: 18.069, near_radius_km: 3 });
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
