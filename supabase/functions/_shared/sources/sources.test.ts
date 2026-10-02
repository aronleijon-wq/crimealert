import { describe, it, expect } from 'vitest';
import { findPlace, placeFromAreaName } from './geo.ts';
import { parseFeed } from './rss.ts';
import { enabledNewsFeeds, newsItemsToEvents, SVT_FEEDS } from './news.ts';
import { isSafetyRelated, specificTopicsOf } from './topics.ts';
import { parseSituations, deviationPosition, trafikverketToExternal } from './trafikverket.ts';
import { parseKrisinformationNews, parseVmaAlerts } from './krisinformation.ts';
import { htmlToText, truncate } from './text.ts';

const NOW = Date.parse('2026-02-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600e3).toISOString();

describe('findPlace', () => {
  it('finds the first municipality, including the genitive', () => {
    expect(findPlace('Brand i lägenhet i Västerås – flera evakuerade')?.name).toBe('Västerås');
    expect(findPlace('Göteborgs hamn stängd efter olycka')?.name).toBe('Göteborg');
    expect(findPlace('Bil körde av vägen i Lilla Edet')?.name).toBe('Lilla Edet');
  });

  it('only treats ambiguous names as places after a preposition or before "kommun"', () => {
    expect(findPlace('Det kan vara farligt att gå ut')).toBeNull();
    expect(findPlace('Man skadad i Vara')?.name).toBe('Vara');
    expect(findPlace('Mark kommun varnar för halka')?.name).toBe('Mark');
  });

  it('does not match a municipality inside another word or a county name', () => {
    expect(findPlace('Stockholmarna fick vänta')).toBeNull();
    expect(findPlace('Brand i Stockholms län')?.name).toBe('Stockholms län');
    expect(findPlace('Olycka i Stockholms län, nära Södertälje')?.name).toBe('Södertälje');
    expect(findPlace('Översvämning i Gotlands län')?.kind).toBe('län');
  });
});

describe('placeFromAreaName', () => {
  it('handles counties, municipalities and the whole country', () => {
    expect(placeFromAreaName('Västra Götalands län')).toMatchObject({ kind: 'län', lat: 57.7089 });
    expect(placeFromAreaName('Västerås kommun')).toMatchObject({ kind: 'kommun', name: 'Västerås' });
    expect(placeFromAreaName('Hela landet')).toEqual({ name: 'Hela landet', kind: 'land', lat: null, lng: null });
    expect(placeFromAreaName('')).toBeNull();
  });
});

describe('topics', () => {
  it('recognises safety news and ignores the rest', () => {
    expect(isSafetyRelated('Kraftig brand i flerfamiljshus')).toBe(true);
    expect(isSafetyRelated('Man skjuten i Malmö – polisen söker vittnen')).toBe(true);
    expect(isSafetyRelated('Nytt bibliotek invigs i Knivsta')).toBe(false);
    expect(isSafetyRelated('Från och med i dag är det sommartid')).toBe(false);
    expect(specificTopicsOf('Trafikolycka på E4 – två till sjukhus')).toEqual(['trafik']);
  });
});

describe('parseFeed', () => {
  it('reads RSS items with CDATA and entities', () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>SVT</title>
      <item><title><![CDATA[Brand i radhus i Uppsala]]></title><link>https://www.svt.se/nyheter/lokalt/uppsala/brand-1</link>
        <description>&lt;p&gt;Räddningstjänsten är på plats &amp; arbetar.&lt;/p&gt;</description><pubDate>Wed, 18 Feb 2026 10:00:00 +0100</pubDate></item>
      <item><title>Utan länk</title></item>
    </channel></rss>`;
    expect(parseFeed(xml)).toEqual([{
      title: 'Brand i radhus i Uppsala',
      link: 'https://www.svt.se/nyheter/lokalt/uppsala/brand-1',
      description: 'Räddningstjänsten är på plats & arbetar.',
      published: 'Wed, 18 Feb 2026 10:00:00 +0100',
      guid: null,
    }]);
  });

  it('reads Atom entries', () => {
    const xml = `<feed><entry><title>Rån i Lund</title><link href="https://example.se/a"/><updated>2026-02-18T10:00:00Z</updated></entry></feed>`;
    expect(parseFeed(xml)[0]).toMatchObject({ title: 'Rån i Lund', link: 'https://example.se/a' });
  });
});

describe('newsItemsToEvents', () => {
  const feed = SVT_FEEDS.find((f) => f.url.includes('/uppsala/'))!;
  const item = (title: string, published = 'Wed, 18 Feb 2026 10:00:00 +0100', description = '') =>
    ({ title, link: `https://www.svt.se/${encodeURIComponent(title)}`, description, published, guid: null });

  it('keeps safety news with headline, link, place and topic only', () => {
    const [event] = newsItemsToEvents(feed, [item('Brand i radhus i Enköping', undefined, 'Lång brödtext som inte ska sparas.')], NOW);
    expect(event).toMatchObject({
      source: 'svt', kind: 'news', title: 'Brand i radhus i Enköping', summary: '',
      area: 'Enköping', category: 'brand', url: 'https://www.svt.se/Brand%20i%20radhus%20i%20Enk%C3%B6ping',
    });
    expect(event.lat).toBeCloseTo(59.64, 1);
  });

  it('falls back to the newsroom region, and drops old or unrelated articles', () => {
    const events = newsItemsToEvents(feed, [
      item('Polisen larmades till skola'),
      item('Ny cykelbana öppnar'),
      item('Brand i lada', 'Mon, 09 Feb 2026 10:00:00 +0100'),
    ], NOW);
    expect(events.map((e) => [e.title, e.area, e.lat])).toEqual([['Polisen larmades till skola', 'Uppsala län', null]]);
  });

  it('gives each article a stable id', () => {
    const a = newsItemsToEvents(feed, [item('Rån i butik')], NOW)[0];
    const b = newsItemsToEvents(feed, [item('Rån i butik')], NOW)[0];
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^news-svt-[0-9a-f]{8}$/);
  });
});

describe('enabledNewsFeeds', () => {
  it('uses SVT by default and adds tabloids only when configured', () => {
    expect(enabledNewsFeeds(undefined).every((f) => f.source === 'svt')).toBe(true);
    expect(enabledNewsFeeds('aftonbladet').map((f) => f.source)).toContain('aftonbladet');
    expect(enabledNewsFeeds('aftonbladet').map((f) => f.source)).not.toContain('expressen');
  });
});

describe('Trafikverket', () => {
  const situation = (deviation: Record<string, unknown>) => ({ RESPONSE: { RESULT: [{ Situation: [{ Id: 'S1', Deviation: [deviation] }] }] } });

  it('reads point deviations like before', () => {
    const [e] = parseSituations(situation({
      Id: 'D1', MessageCodeValue: 'accident', MessageType: 'Olycka', RoadNumber: 'E4',
      Geometry: { Point: { WGS84: 'POINT (18.0686 59.3293)' } }, StartTime: hoursAgo(1),
      SeverityText: 'Stor påverkan', LocationDescriptor: 'E4 vid Häggvik', Message: 'Två bilar',
    }), NOW);
    expect(e).toMatchObject({
      id: 'tv-D1', title: 'E4 — Trafikolycka', lat: 59.3293, lng: 18.0686, risk: 'high',
      area: 'E4 vid Häggvik', description: 'Två bilar', acute: true, type: 'trafikverket',
    });
  });

  it('places line-only deviations at the middle of the line', () => {
    expect(deviationPosition({ Line: { WGS84: 'LINESTRING (18.0 59.0, 18.1 59.1, 18.2 59.2)' } })).toEqual({ lat: 59.1, lng: 18.1 });
    expect(deviationPosition({ Point: { WGS84: 'POINT (18.0 59.0 0)' } })).toEqual({ lat: 59.0, lng: 18.0 });
    expect(deviationPosition({ Point: { WGS84: 'POINT (2.35 48.85)' } })).toBeNull();
  });

  it("uses Trafikverket's Swedish text for codes we don't translate", () => {
    const [e] = parseSituations(situation({
      Id: 'D2', MessageCodeValue: 'resurfacingWork', MessageCode: 'Beläggningsarbete',
      Geometry: { Line: { WGS84: 'LINESTRING (16.5 59.6, 16.6 59.6)' } }, StartTime: hoursAgo(30),
    }), NOW);
    expect(e.title).toBe('Beläggningsarbete');
    expect(e.acute).toBe(false);
  });

  it('skips ended, deleted, ferry and stale acute deviations', () => {
    const base = { Geometry: { Point: { WGS84: 'POINT (18 59)' } }, StartTime: hoursAgo(1) };
    expect(parseSituations(situation({ ...base, Id: 'a', EndTime: hoursAgo(0.5) }), NOW)).toEqual([]);
    expect(parseSituations(situation({ ...base, Id: 'b', Deleted: true }), NOW)).toEqual([]);
    expect(parseSituations(situation({ ...base, Id: 'c', MessageCodeValue: 'ferryServiceSuspended' }), NOW)).toEqual([]);
    expect(parseSituations(situation({ ...base, Id: 'd', MessageCodeValue: 'accident', StartTime: hoursAgo(30) }), NOW)).toEqual([]);
  });

  it('maps to an external event row', () => {
    const [e] = parseSituations(situation({
      Id: 'D3', MessageCodeValue: 'roadClosed', Geometry: { Point: { WGS84: 'POINT (18 59)' } }, StartTime: hoursAgo(1),
    }), NOW);
    expect(trafikverketToExternal(e)).toMatchObject({ id: 'tv-D3', source: 'trafikverket', kind: 'traffic', title: 'Vägen avstängd' });
  });
});

describe('Krisinformation news', () => {
  it('maps news with area, preamble and link, skipping test items', () => {
    const events = parseKrisinformationNews([
      {
        Identifier: 'abc', Headline: 'Kraftigt <b>snöfall</b>', Preamble: '<p>SMHI varnar för snö.</p>',
        Published: '2026-02-18T09:00:00+01:00', Web: 'https://www.krisinformation.se/nyheter/abc',
        Area: [{ Type: 'County', Description: 'Jämtlands län' }], Push: true, Event: 'Väder',
      },
      { Identifier: 'test', Headline: 'Test', Published: '2026-02-18T09:00:00+01:00', IsTest: true },
    ]);
    expect(events).toEqual([{
      id: 'kris-abc', source: 'krisinformation', kind: 'crisis', title: 'Kraftigt snöfall', summary: 'SMHI varnar för snö.',
      url: 'https://www.krisinformation.se/nyheter/abc', area: 'Jämtlands län', lat: 63.1792, lng: 14.6357,
      published_at: '2026-02-18T08:00:00.000Z', ends_at: null, severity: 'high', category: 'Väder',
    }]);
  });

  it('treats national news as having no map position', () => {
    const [e] = parseKrisinformationNews([{ Identifier: 'n', Headline: 'Info', Published: '2026-02-18T09:00:00Z', Area: [{ Description: 'Hela landet' }] }]);
    expect(e).toMatchObject({ area: 'Hela landet', lat: null, lng: null, severity: 'medium' });
  });

  it('ignores unexpected input', () => {
    expect(parseKrisinformationNews({ error: 'x' })).toEqual([]);
    expect(parseKrisinformationNews([null, 1, { Headline: 'utan id' }])).toEqual([]);
  });
});

describe('VMA', () => {
  const alert = (overrides: Record<string, unknown> = {}) => ({
    identifier: 'SRCAP1', sent: '2026-02-18T10:00:00+01:00', status: 'Actual', msgType: 'Alert',
    info: [
      { language: 'en-US', event: 'Fire', headline: 'Fire in Västerås' },
      {
        language: 'sv-SE', event: 'Brand', headline: 'VMA: Brand i Västerås', description: 'Stäng dörrar och fönster.',
        expires: '2026-02-18T16:00:00+01:00', area: [{ areaDesc: 'Västerås kommun' }],
      },
    ],
    ...overrides,
  });

  it('reads Swedish info, area and expiry from real alerts', () => {
    const { events, cancelledIds } = parseVmaAlerts({ alerts: [alert()] });
    expect(cancelledIds).toEqual([]);
    expect(events).toEqual([{
      id: 'vma-SRCAP1', source: 'sr-vma', kind: 'vma', title: 'VMA: Brand i Västerås', summary: 'Stäng dörrar och fönster.',
      url: 'https://www.sverigesradio.se/vma', area: 'Västerås kommun', lat: 59.6099, lng: 16.5448,
      published_at: '2026-02-18T09:00:00.000Z', ends_at: '2026-02-18T15:00:00.000Z', severity: 'high', category: 'Brand',
    }]);
  });

  it('uses the CAP circle when there is one', () => {
    const withCircle = alert({ info: [{ language: 'sv-SE', headline: 'VMA', area: [{ areaDesc: 'Område', circle: '57.70,11.97 5' }] }] });
    expect(parseVmaAlerts([withCircle]).events[0]).toMatchObject({ lat: 57.7, lng: 11.97 });
  });

  it('skips exercises and reports cancelled or updated alerts', () => {
    expect(parseVmaAlerts({ alerts: [alert({ status: 'Exercise' })] }).events).toEqual([]);
    const cancel = parseVmaAlerts({ alerts: [alert({ identifier: 'SRCAP2', msgType: 'Cancel', references: 'https://vmaapi.sr.se,SRCAP1,2026-02-18T10:00:00+01:00' })] });
    expect(cancel).toEqual({ events: [], cancelledIds: ['vma-SRCAP1'] });
    const update = parseVmaAlerts({ alerts: [alert({ identifier: 'SRCAP3', msgType: 'Update', references: 'x,SRCAP1,y' })] });
    expect(update.events.map((e) => e.id)).toEqual(['vma-SRCAP3']);
    expect(update.cancelledIds).toEqual(['vma-SRCAP1']);
  });
});

describe('text helpers', () => {
  it('strips html and truncates on a word boundary', () => {
    expect(htmlToText('<p>Hej&nbsp;<b>där</b> &#229;</p>')).toBe('Hej där å');
    expect(truncate('Ett två tre fyra fem', 12)).toBe('Ett två tre…');
  });
});
