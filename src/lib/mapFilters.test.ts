import { describe, it, expect } from 'vitest';
import type { Incident } from '@/data/mockIncidents';
import { filterIncidentsForMap, sortNewestFirst } from './mapFilters';

const NOW = Date.parse('2026-02-18T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60 * 1000).toISOString();
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

// Polisen.se style timestamp ("2026-02-18 13:00:00 +01:00"), i.e. what the live API returns
const polisenTime = (m: number) => {
  const d = new Date(NOW - m * 60 * 1000 + 60 * 60 * 1000);
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} +01:00`;
};

const incident = (overrides: Partial<Incident>): Incident => ({
  id: 'x',
  type: 'police',
  title: 'Händelse',
  description: '',
  lat: 59.33,
  lng: 18.07,
  area: 'Stockholm',
  time: minutesAgo(60),
  status: 'active',
  risk: 'low',
  source: 'Polisen.se',
  ...overrides,
});

const ids = (incidents: Incident[]) => incidents.map((i) => i.id);

describe('filterIncidentsForMap', () => {
  it('delays new incidents 15 minutes for free users only', () => {
    const incidents = [
      incident({ id: 'fresh', time: minutesAgo(5) }),
      incident({ id: 'delayed', time: minutesAgo(20) }),
    ];
    expect(ids(filterIncidentsForMap(incidents, { isPremium: false, now: NOW }))).toEqual(['delayed']);
    expect(ids(filterIncidentsForMap(incidents, { isPremium: true, now: NOW }))).toEqual(['fresh', 'delayed']);
  });

  it('drops incidents older than 7 days', () => {
    const incidents = [
      incident({ id: 'six-days', time: daysAgo(6) }),
      incident({ id: 'eight-days', time: daysAgo(8) }),
    ];
    expect(ids(filterIncidentsForMap(incidents, { isPremium: true, now: NOW }))).toEqual(['six-days']);
  });

  it('applies the cutoffs to Polisen.se timestamps too', () => {
    const incidents = [
      incident({ id: 'fresh', time: polisenTime(5) }),
      incident({ id: 'ok', time: polisenTime(60) }),
      incident({ id: 'old', time: polisenTime(8 * 24 * 60) }),
    ];
    expect(ids(filterIncidentsForMap(incidents, { isPremium: false, now: NOW }))).toEqual(['ok']);
  });

  it('shows community reports for 24 hours', () => {
    const incidents = [
      incident({ id: 'today', source: 'Medborgarrapport', time: minutesAgo(5) }),
      incident({ id: 'yesterday', source: 'Medborgarrapport', time: daysAgo(2) }),
    ];
    expect(ids(filterIncidentsForMap(incidents, { isPremium: false, now: NOW }))).toEqual(['today']);
  });

  it('shows Trafikverket disruptions until they end, regardless of start time', () => {
    const incidents = [
      incident({ id: 'ongoing', type: 'trafikverket', time: daysAgo(10), endTime: minutesAgo(-60) }),
      incident({ id: 'no-end', type: 'trafikverket', time: minutesAgo(1), endTime: null }),
      incident({ id: 'ended', type: 'trafikverket', time: minutesAgo(120), endTime: minutesAgo(30) }),
    ];
    expect(ids(filterIncidentsForMap(incidents, { isPremium: false, now: NOW }))).toEqual(['ongoing', 'no-end']);
  });

  it('keeps incidents whose time cannot be parsed', () => {
    const incidents = [incident({ id: 'unknown', time: 'okänd tid' })];
    expect(ids(filterIncidentsForMap(incidents, { isPremium: false, now: NOW }))).toEqual(['unknown']);
  });
});

describe('sortNewestFirst', () => {
  it('orders mixed Polisen.se and ISO timestamps by actual time', () => {
    const incidents = [
      incident({ id: 'police-2h', time: polisenTime(120) }),
      incident({ id: 'traffic-30m', type: 'trafikverket', time: minutesAgo(30) }),
      incident({ id: 'police-10m', time: polisenTime(10) }),
      incident({ id: 'community-1h', source: 'Medborgarrapport', time: minutesAgo(60) }),
    ];
    expect(ids(sortNewestFirst(incidents))).toEqual(['police-10m', 'traffic-30m', 'community-1h', 'police-2h']);
  });

  it('puts unparsable times last and does not mutate the input', () => {
    const incidents = [incident({ id: 'unknown', time: '' }), incident({ id: 'known', time: minutesAgo(5) })];
    expect(ids(sortNewestFirst(incidents))).toEqual(['known', 'unknown']);
    expect(ids(incidents)).toEqual(['unknown', 'known']);
  });
});
