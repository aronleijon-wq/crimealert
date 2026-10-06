import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import type { Incident } from '@/data/mockIncidents';
import { countByKommun, kommunFaq, kommunFromSlug, kommunJsonLd, kommunPath, kommunSlug, kommunStats, neighbourKommuner } from './kommunPages';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600e3).toISOString();
const event = (id: string, area: string, h: number, extra: Partial<Incident> = {}): Incident => ({
  id, type: 'police', title: `03 oktober 10.00, Stöld, ${area}`, description: '', lat: 59, lng: 17, area,
  time: hoursAgo(h), status: 'active', risk: 'low', source: 'Polisen.se', originalType: 'Stöld', ...extra,
});

describe('kommun addresses', () => {
  it('gives every kommun its own address and finds it again', () => {
    const slugs = SWEDISH_KOMMUNER.map(kommunSlug);
    expect(new Set(slugs).size).toBe(290);
    for (const name of SWEDISH_KOMMUNER) expect(kommunFromSlug(kommunSlug(name))).toBe(name);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
  });

  it('writes Swedish names plainly', () => {
    expect(kommunSlug('Malmö')).toBe('malmo');
    expect(kommunSlug('Upplands Väsby')).toBe('upplands-vasby');
    expect(kommunSlug('Habo')).toBe('habo');
    expect(kommunSlug('Håbo')).toBe('haabo');
    expect(kommunFromSlug('MALMO')).toBe('Malmö');
    expect(kommunFromSlug('atlantis')).toBeNull();
    expect(kommunFromSlug(undefined)).toBeNull();
  });

  it('lists every kommun page in the sitemap', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    for (const name of SWEDISH_KOMMUNER) expect(sitemap).toContain(`<loc>https://crimealert.se${kommunPath(name)}</loc>`);
    expect(sitemap).toContain('<loc>https://crimealert.se/kommun</loc>');
  });
});

describe('kommunStats', () => {
  const incidents = [
    event('a', 'Uppsala', 1, { type: 'fire', originalType: 'Brand' }),
    event('b', 'Uppsala', 5),
    event('c', 'Uppsala', 30),
    event('d', 'Uppsala län', 50, { originalType: 'Sammanfattning natt' }),
    event('e', 'Uppsala', 24 * 8),
    event('f', 'Sala', 2),
  ];

  it('counts the kommun’s day and week, newest first, and not Sala for Uppsala', () => {
    const stats = kommunStats(incidents, 'Uppsala', NOW);
    expect(stats.events.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(stats.last24h).toBe(2);
    expect(stats.last7d).toBe(4);
    expect(stats.byType).toEqual([{ type: 'police', count: 3 }, { type: 'fire', count: 1 }]);
    // Summaries are not a kind of event
    expect(stats.topCategory).toEqual({ name: 'Stöld', count: 2 });
  });

  it('is empty for a quiet kommun', () => {
    const stats = kommunStats(incidents, 'Kiruna', NOW);
    expect(stats).toEqual({ events: [], last24h: 0, last7d: 0, byType: [], topCategory: null });
  });

  it('ranks the busiest kommuner of the day', () => {
    expect(countByKommun(incidents, NOW - 24 * 3600e3)).toEqual([{ name: 'Uppsala', count: 2 }, { name: 'Sala', count: 1 }]);
  });
});

describe('neighbourKommuner', () => {
  it('lists the nearest kommuner', () => {
    const near = neighbourKommuner('Lund', 6);
    expect(near).toHaveLength(6);
    expect(near).not.toContain('Lund');
    expect(near).toContain('Malmö');
    expect(neighbourKommuner('Atlantis')).toEqual([]);
  });
});

describe('countByKommun speed', () => {
  it('handles a week of events across the country quickly', () => {
    const areas = [...SWEDISH_KOMMUNER, ...SWEDISH_KOMMUNER.map((k) => `${k}s län`)];
    const week = Array.from({ length: 2000 }, (_, i) => event(`w${i}`, areas[i % areas.length], (i % 160) / 10));
    const started = performance.now();
    const counts = countByKommun(week, NOW - 24 * 3600e3);
    expect(counts.length).toBeGreaterThan(100);
    expect(performance.now() - started).toBeLessThan(400);
  });
});

describe('kommun FAQ', () => {
  it('answers what happened today from the counts on the page', () => {
    const stats = kommunStats([event('a', 'Malmö', 2), event('b', 'Malmö', 30), event('c', 'Malmö', 50, { originalType: 'Brand' })], 'Malmö', NOW);
    const [today, map, notify, all] = kommunFaq('Malmö', stats);
    expect(today.q).toBe('Vad har hänt i Malmö idag?');
    expect(today.a).toBe('Polisen har rapporterat 1 händelse i Malmö kommun det senaste dygnet och 3 händelser den senaste veckan. Vanligast den senaste veckan är stöld.');
    expect(map.q).toBe('Hur ser jag Polisens händelser i Malmö på en karta?');
    expect(notify.a).toMatch(/15 minuter/);
    expect(all.a).toMatch(/Brå/);
  });

  it('says so when nothing has happened, and what the page shows before the data is in', () => {
    const quiet = kommunStats([event('a', 'Malmö', 30)], 'Malmö', NOW);
    expect(kommunFaq('Malmö', quiet)[0].a).toBe('Polisen har inte rapporterat någon händelse i Malmö kommun det senaste dygnet. Den senaste veckan har det kommit 1 händelse.');
    expect(kommunFaq('Gotland', null)[0].a).toMatch(/^Här visas allt Polisen har rapporterat i Region Gotland/);
  });

  it('gives search engines the breadcrumbs and the same questions and answers', () => {
    const faq = kommunFaq('Malmö', null);
    const [crumbs, page] = JSON.parse(kommunJsonLd('Malmö', faq));
    expect(crumbs.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Malmö', item: 'https://crimealert.se/kommun/malmo' });
    expect(page['@type']).toBe('FAQPage');
    expect(page.mainEntity.map((q: { name: string }) => q.name)).toEqual(faq.map((f) => f.q));
    expect(page.mainEntity[0].acceptedAnswer.text).toBe(faq[0].a);
  });
});
