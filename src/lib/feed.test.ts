import { describe, it, expect } from 'vitest';
import type { Incident } from '@/data/mockIncidents';
import type { ExternalEvent } from '@/lib/externalEvents';
import { buildFeed, cleanPoliceTitle, filterFeed, findRelatedNews, groupByDay, groupNewsStories } from './feed';

const NOW = Date.parse('2026-02-18T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60 * 1000).toISOString();

const incident = (overrides: Partial<Incident>): Incident => ({
  id: 'pol-1', type: 'fire', title: '18 februari 12.30, Brand, Uppsala', description: 'Brand i radhus.',
  lat: 59.8586, lng: 17.6389, area: 'Uppsala', time: minutesAgo(60), status: 'active', risk: 'medium',
  source: 'Polisen.se', url: '/aktuellt/handelser/1', ...overrides,
});

const external = (overrides: Partial<ExternalEvent>): ExternalEvent => ({
  id: 'news-svt-1', source: 'svt', kind: 'news', title: 'Kraftig brand i radhus i Uppsala', summary: '',
  url: 'https://www.svt.se/a', area: 'Uppsala', lat: 59.8586, lng: 17.6389, published_at: minutesAgo(30),
  ends_at: null, severity: 'low', category: 'brand', ...overrides,
});

describe('cleanPoliceTitle', () => {
  it('drops the leading date from police titles', () => {
    expect(cleanPoliceTitle('02 oktober 14.05, Trafikolycka, Malmö')).toBe('Trafikolycka, Malmö');
    expect(cleanPoliceTitle('Rån')).toBe('Rån');
  });
});

describe('findRelatedNews', () => {
  const event = { title: 'Brand, Uppsala', area: 'Uppsala', lat: 59.8586, lng: 17.6389, timestamp: NOW - 60 * 60 * 1000 };

  it('matches news on the same topic and place around the same time', () => {
    const news = [
      external({ id: 'same' }),
      external({ id: 'other-topic', title: 'Rån i Uppsala', category: 'rån' }),
      external({ id: 'other-place', area: 'Luleå', lat: 65.58, lng: 22.15 }),
      external({ id: 'too-early', published_at: minutesAgo(60 * 10) }),
      external({ id: 'nearby', area: 'Knivsta', lat: 59.72, lng: 17.79 }),
    ];
    expect(findRelatedNews(event, news).map((n) => n.id)).toEqual(['same', 'nearby']);
  });

  it('finds nothing for events without a recognisable topic', () => {
    expect(findRelatedNews({ ...event, title: 'Övrigt, Uppsala' }, [external({})])).toEqual([]);
  });
});

describe('buildFeed', () => {
  const base = { police: [], traffic: [], community: [], external: [], isPremium: true, now: NOW };

  it('puts active VMA first, then everything newest first, with related news under its event', () => {
    const items = buildFeed({
      ...base,
      police: [incident({})],
      external: [
        external({ id: 'news-related' }),
        external({ id: 'news-own', title: 'Skottlossning i Malmö', area: 'Malmö', lat: 55.6, lng: 13.0, category: 'skjutning', published_at: minutesAgo(10) }),
        external({ id: 'vma-1', kind: 'vma', source: 'sr-vma', title: 'VMA: Gasutsläpp', category: null, published_at: minutesAgo(120), ends_at: minutesAgo(-60) }),
        external({ id: 'kris-old', kind: 'crisis', source: 'krisinformation', title: 'Gammal info', published_at: minutesAgo(60 * 24 * 8) }),
      ],
    });
    expect(items.map((i) => i.id)).toEqual(['vma-1', 'news-own', 'pol-1']);
    expect(items[0]).toMatchObject({ pinned: true, active: true, source: 'Sveriges Radio (VMA)' });
    expect(items[2]).toMatchObject({ title: 'Brand, Uppsala', source: 'Polisen', mapLink: '/karta?incident=pol-1' });
    expect(items[2].related.map((n) => n.id)).toEqual(['news-related']);
  });

  it('locks police descriptions and event links for free users, and applies the 15-minute delay', () => {
    const items = buildFeed({
      ...base,
      isPremium: false,
      police: [incident({ description: '' }), incident({ id: 'pol-new', time: minutesAgo(5) })],
    });
    expect(items.map((i) => i.id)).toEqual(['pol-1']);
    expect(items[0]).toMatchObject({ body: '', bodyLocked: true, url: null });
  });

  it('shows police summaries and crisis text to everyone', () => {
    const items = buildFeed({
      ...base,
      isPremium: false,
      police: [incident({ originalType: 'Sammanfattning natt', description: 'Lugn natt.' })],
      external: [external({ id: 'kris-1', kind: 'crisis', source: 'krisinformation', title: 'Elavbrott', summary: 'Många utan ström.', category: null })],
    });
    expect(items.map((i) => [i.id, i.body, i.bodyLocked])).toEqual([
      ['kris-1', 'Många utan ström.', false],
      ['pol-1', 'Lugn natt.', false],
    ]);
  });

  it('keeps roadworks out, and folds a Trafikverket accident into the police report of it', () => {
    const items = buildFeed({
      ...base,
      police: [incident({ id: 'pol-2', type: 'traffic', title: 'Trafikolycka, Solna', area: 'Solna', lat: 59.36, lng: 18.0 })],
      traffic: [
        incident({ id: 'tv-acc', type: 'trafikverket', title: 'E4 — Trafikolycka', source: 'Trafikverket', lat: 59.361, lng: 18.0, acute: true }),
        incident({ id: 'tv-work', type: 'trafikverket', title: 'Vägarbete', source: 'Trafikverket', acute: false }),
        incident({ id: 'tv-closed', type: 'trafikverket', title: 'Vägen avstängd', source: 'Trafikverket', lat: 60, lng: 15, acute: true }),
      ],
    });
    expect(items.map((i) => i.id).sort()).toEqual(['pol-2', 'tv-closed']);
    expect(items.find((i) => i.id === 'pol-2')!.alsoReported.map((t) => t.id)).toEqual(['tv-acc']);
  });

  it('shows community reports to Pro only', () => {
    const report = incident({ id: 'cr-1', type: 'other', source: 'Medborgarrapport', title: 'Trasig belysning' });
    expect(buildFeed({ ...base, community: [report] }).map((i) => i.kind)).toEqual(['community']);
    expect(buildFeed({ ...base, isPremium: false, community: [report] })).toEqual([]);
  });
});

describe('filterFeed', () => {
  const items = buildFeed({
    police: [incident({}), incident({ id: 'pol-malmo', area: 'Malmö', title: 'Rån, Malmö' })],
    traffic: [], community: [], isPremium: true, now: NOW,
    external: [
      external({ id: 'kris-1', kind: 'crisis', source: 'krisinformation', title: 'Elavbrott', area: 'Gävleborgs län', category: null }),
      external({ id: 'news-1', title: 'Explosion i Lund', area: 'Lund', category: 'explosion' }),
      external({ id: 'news-uppsala' }),
    ],
  });

  it('filters by kind', () => {
    expect(filterFeed(items, 'crisis').map((i) => i.id)).toEqual(['kris-1']);
    expect(filterFeed(items, 'police').map((i) => i.id).sort()).toEqual(['pol-1', 'pol-malmo']);
    expect(filterFeed(items, 'news').map((i) => i.id).sort()).toEqual(['news-1', 'pol-1']);
  });

  it('filters by watched municipalities', () => {
    expect(filterFeed(items, 'mine', ['Malmö']).map((i) => i.id)).toEqual(['pol-malmo']);
    expect(filterFeed(items, 'mine', [])).toEqual([]);
  });
});

describe('groupNewsStories', () => {
  it('folds the same story from several outlets into one post', () => {
    const svt = external({ id: 'svt', source: 'svt', title: 'Man skjuten i Malmö', area: 'Malmö', lat: 55.6, lng: 13.0, category: 'skjutning', published_at: minutesAgo(30) });
    const svd = external({ id: 'svd', source: 'svd', title: 'Skottlossning i Malmö – en skadad', area: 'Malmö', lat: 55.6, lng: 13.0, category: 'skjutning', published_at: minutesAgo(10) });
    const otherCity = external({ id: 'ab', source: 'aftonbladet', title: 'Man skjuten i Umeå', area: 'Umeå', lat: 63.8, lng: 20.3, category: 'skjutning', published_at: minutesAgo(5) });
    const dayLater = external({ id: 'old', source: 'svt', title: 'Skjuten i Malmö i går', area: 'Malmö', lat: 55.6, lng: 13.0, category: 'skjutning', published_at: minutesAgo(60 * 20) });

    expect(groupNewsStories([svt, svd, otherCity, dayLater]).map((g) => [g.lead.id, g.others.map((o) => o.id)])).toEqual([
      ['ab', []],
      ['svd', ['svt']],
      ['old', []],
    ]);
  });

  it('shows the other outlets as related news in the feed', () => {
    const items = buildFeed({
      police: [], traffic: [], community: [], isPremium: true, now: NOW,
      external: [
        external({ id: 'svt', source: 'svt', category: 'rån', title: 'Rån i Lund', area: 'Lund', lat: 55.7, lng: 13.19, published_at: minutesAgo(40) }),
        external({ id: 'svd', source: 'svd', category: 'rån', title: 'Butik rånad i Lund', area: 'Lund', lat: 55.7, lng: 13.19, published_at: minutesAgo(20) }),
      ],
    });
    expect(items.map((i) => [i.id, i.related.map((r) => r.id)])).toEqual([['svd', ['svt']]]);
  });
});

describe('groupByDay', () => {
  it('puts active VMA first, then today, yesterday and older days', () => {
    const now = Date.parse('2026-02-18T12:00:00');
    const at = (iso: string) => Date.parse(iso);
    const items = buildFeed({
      police: [], traffic: [], community: [], isPremium: true, now,
      external: [
        external({ id: 'vma', kind: 'vma', source: 'sr-vma', category: null, title: 'VMA', published_at: new Date(at('2026-02-18T09:00:00')).toISOString(), ends_at: new Date(at('2026-02-18T18:00:00')).toISOString() }),
        external({ id: 'today', title: 'Rån i Lund', category: 'rån', area: 'Lund', lat: 55.7, lng: 13.2, published_at: new Date(at('2026-02-18T08:00:00')).toISOString() }),
        external({ id: 'yesterday', title: 'Brand i Umeå', area: 'Umeå', lat: 63.8, lng: 20.3, published_at: new Date(at('2026-02-17T20:00:00')).toISOString() }),
        external({ id: 'older', title: 'Explosion i Malmö', category: 'explosion', area: 'Malmö', lat: 55.6, lng: 13.0, published_at: new Date(at('2026-02-16T10:00:00')).toISOString() }),
      ],
    });
    expect(groupByDay(items, now).map((s) => [s.label, s.items.map((i) => i.id)])).toEqual([
      ['Viktigt just nu', ['vma']],
      ['Idag', ['today']],
      ['Igår', ['yesterday']],
      ['Måndag 16 februari', ['older']],
    ]);
  });

  it('carries the source image and credit for news', () => {
    const [item] = buildFeed({
      police: [], traffic: [], community: [], isPremium: true, now: NOW,
      external: [external({ image_url: 'https://img.svt.se/a.jpg', image_credit: 'Anna Andersson/TT' })],
    });
    expect(item.image).toEqual({ url: 'https://img.svt.se/a.jpg', credit: 'Anna Andersson/TT' });
  });
});
