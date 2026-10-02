import { describe, it, expect } from 'vitest';
import { keepBackfilledSummaries, needsDetailScrape, planArchiveWrites, type ArchivableIncident } from './archiveDiff';

const event = (id: string, extra: Partial<ArchivableIncident> = {}): ArchivableIncident => ({
  id, type: 'police', title: `02 oktober 14.05, Rån, Malmö`, description: 'Kort text', lat: 55.6, lng: 13.0,
  area: 'Malmö', time: '2026-10-02 14:05:00 +02:00', status: 'active', risk: 'high', source: 'Polisen.se',
  originalType: 'Rån', url: '/aktuellt/1', location_precision: 'area', ...extra,
});

// The same event as the archive returns it
const stored = (e: ArchivableIncident): ArchivableIncident => ({
  ...e, time: new Date(Date.parse(e.time.replace(' ', 'T').replace(' +', '+'))).toISOString().replace('.000Z', '+00:00'),
  originalType: undefined, original_type: e.originalType ?? null,
});

describe('planArchiveWrites', () => {
  it('leaves unchanged events alone, even with the database time format', () => {
    const fresh = [event('a'), event('b')];
    expect(planArchiveWrites(fresh, fresh.map(stored))).toEqual({ inserts: [], updates: [] });
  });

  it('inserts new events and updates changed ones', () => {
    const archived = [stored(event('a')), stored(event('b'))];
    const fresh = [event('a'), event('b', { status: 'resolved' }), event('c')];
    const { inserts, updates } = planArchiveWrites(fresh, archived);
    expect(inserts.map((e) => e.id)).toEqual(['c']);
    expect(updates.map((e) => e.id)).toEqual(['b']);
  });

  it('notices moved positions and new descriptions', () => {
    const archived = [stored(event('a')), stored(event('b'))];
    const fresh = [event('a', { lat: 55.61 }), event('b', { description: 'Uppdaterad text' })];
    expect(planArchiveWrites(fresh, archived).updates.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('keepBackfilledSummaries', () => {
  const summary = (description: string) =>
    event('s', { title: '02 oktober 06.00, Sammanfattning natt, Stockholm', originalType: 'Sammanfattning natt', description });

  it('keeps the full summary text scraped earlier', () => {
    const full = 'Ett urval av nattens händelser: ' + 'lång text '.repeat(40);
    const [kept] = keepBackfilledSummaries([summary('Ett urval av nattens polisverksamhet')], [stored(summary(full))]);
    expect(kept.description).toBe(full);
    // and so the archive has nothing to rewrite
    expect(planArchiveWrites([kept], [stored(summary(full))])).toEqual({ inserts: [], updates: [] });
  });

  it('leaves other events and new summaries as they are', () => {
    const fresh = [event('a', { description: 'Kort' }), summary('Teaser')];
    expect(keepBackfilledSummaries(fresh, [stored(event('a', { description: 'Mycket längre gammal text' }))])).toEqual(fresh);
  });
});

describe('needsDetailScrape', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3600e3).toISOString();
  const incident = (hoursAgo: number) => ({ url: '/aktuellt/1', time: at(hoursAgo), description: 'Kort' });
  const MIN = 60e3;

  it('always fetches events from the last 6 hours, as before', () => {
    expect(needsDetailScrape(incident(1), 'Lång arkiverad text', now - 5 * MIN, now)).toBe(true);
  });

  it('fetches older events every 30 minutes or every 2 hours', () => {
    expect(needsDetailScrape(incident(10), undefined, now - 20 * MIN, now)).toBe(false);
    expect(needsDetailScrape(incident(10), undefined, now - 31 * MIN, now)).toBe(true);
    expect(needsDetailScrape(incident(30), undefined, now - 90 * MIN, now)).toBe(false);
    expect(needsDetailScrape(incident(30), undefined, now - 121 * MIN, now)).toBe(true);
  });

  it('uses the archived text when this instance has not fetched the page yet', () => {
    expect(needsDetailScrape(incident(10), 'Lång arkiverad text', undefined, now)).toBe(false);
    expect(needsDetailScrape(incident(10), undefined, undefined, now)).toBe(true);
  });

  it('never fetches events older than 3 days or without a page', () => {
    expect(needsDetailScrape(incident(80), undefined, undefined, now)).toBe(false);
    expect(needsDetailScrape({ ...incident(1), url: null }, undefined, undefined, now)).toBe(false);
  });
});
