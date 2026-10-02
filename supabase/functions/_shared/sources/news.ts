import { findPlace } from './geo.ts';
import type { FeedItem } from './rss.ts';
import { hashString, toIso, truncate } from './text.ts';
import { isSafetyRelated, specificTopicsOf } from './topics.ts';
import type { ExternalEvent } from './types.ts';

export type NewsSource = 'svt' | 'svd' | 'aftonbladet' | 'expressen';

export interface NewsFeed {
  source: NewsSource;
  /** Shown in the app, e.g. "SVT Nyheter Väst" */
  name: string;
  url: string;
  /** Area shown when the article names no municipality */
  region?: string;
}

// SVT's local newsrooms; each has a feed at svt.se/nyheter/lokalt/<slug>/rss.xml
const SVT_REGIONS: [slug: string, name: string, region: string][] = [
  ['blekinge', 'Blekinge', 'Blekinge län'],
  ['dalarna', 'Dalarna', 'Dalarnas län'],
  ['gavleborg', 'Gävleborg', 'Gävleborgs län'],
  ['halland', 'Halland', 'Hallands län'],
  ['helsingborg', 'Helsingborg', 'Skåne län'],
  ['jamtland', 'Jämtland', 'Jämtlands län'],
  ['jonkoping', 'Jönköping', 'Jönköpings län'],
  ['norrbotten', 'Norrbotten', 'Norrbottens län'],
  ['skane', 'Skåne', 'Skåne län'],
  ['smaland', 'Småland', 'Kronobergs län'],
  ['stockholm', 'Stockholm', 'Stockholms län'],
  ['sormland', 'Sörmland', 'Södermanlands län'],
  ['uppsala', 'Uppsala', 'Uppsala län'],
  ['varmland', 'Värmland', 'Värmlands län'],
  ['vast', 'Väst', 'Västra Götalands län'],
  ['vasterbotten', 'Västerbotten', 'Västerbottens län'],
  ['vasternorrland', 'Västernorrland', 'Västernorrlands län'],
  ['vastmanland', 'Västmanland', 'Västmanlands län'],
  ['orebro', 'Örebro', 'Örebro län'],
  ['ost', 'Öst', 'Östergötlands län'],
];

export const SVT_FEEDS: NewsFeed[] = [
  // National news; articles that are also in a local feed share their link and id
  { source: 'svt', name: 'SVT Nyheter', url: 'https://www.svt.se/rss.xml' },
  ...SVT_REGIONS.map(([slug, name, region]): NewsFeed => ({
    source: 'svt',
    name: `SVT Nyheter ${name}`,
    url: `https://www.svt.se/nyheter/lokalt/${slug}/rss.xml`,
    region,
  })),
];

// National newspapers. Off unless listed in the NEWS_EXTRA_SOURCES secret
// (e.g. "svd,aftonbladet,expressen"), so they are only turned on after their terms for
// commercial use have been checked.
export const EXTRA_FEEDS: NewsFeed[] = [
  { source: 'svd', name: 'Svenska Dagbladet', url: 'https://www.svd.se/feed/articles.rss' },
  { source: 'aftonbladet', name: 'Aftonbladet', url: 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt/' },
  // Older address, kept in case the one above stops working; duplicates share an id
  { source: 'aftonbladet', name: 'Aftonbladet', url: 'https://www.aftonbladet.se/rss.xml' },
  { source: 'expressen', name: 'Expressen', url: 'https://feeds.expressen.se/nyheter/' },
];

/**
 * Sources whose own article images may be shown, from the NEWS_IMAGES secret
 * (e.g. "svt,svd"). Empty by default: press photos need the publisher's permission.
 */
export function imageSources(setting: string | undefined): Set<string> {
  return new Set((setting ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function enabledNewsFeeds(extraSources: string | undefined): NewsFeed[] {
  const extra = new Set((extraSources ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  return [...SVT_FEEDS, ...EXTRA_FEEDS.filter((feed) => extra.has(feed.source))];
}

const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Safety-related articles from one feed as external events. Only the headline is kept
 * (plus a link); the article text is read once to find the place and topic, never stored.
 */
export function newsItemsToEvents(
  feed: NewsFeed,
  items: FeedItem[],
  now = Date.now(),
  { withImages = false }: { withImages?: boolean } = {},
): ExternalEvent[] {
  const events: ExternalEvent[] = [];
  for (const item of items) {
    const text = `${item.title} ${item.description}`;
    if (!item.title || !isSafetyRelated(text)) continue;

    const published = toIso(item.published) ?? new Date(now).toISOString();
    if (now - new Date(published).getTime() > MAX_AGE_MS) continue;

    const place = findPlace(text);
    events.push({
      id: `news-${feed.source}-${hashString(item.link)}`,
      source: feed.source,
      kind: 'news',
      title: truncate(item.title, 200),
      summary: '',
      url: item.link,
      area: place?.name ?? feed.region ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      published_at: published,
      ends_at: null,
      severity: 'low',
      category: specificTopicsOf(text)[0] ?? null,
      ...(withImages && item.image ? { image_url: item.image.url, image_credit: item.image.credit } : {}),
    });
  }
  return events;
}
