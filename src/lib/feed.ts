import type { Incident, IncidentType } from '@/data/mockIncidents';
import { sourceName, type ExternalEvent } from '@/lib/externalEvents';
import { parseIncidentTime } from '@/lib/incidentTime';
import { CRISIS_DEFAULT_DURATION_MS, filterIncidentsForMap, linkTrafficDuplicates } from '@/lib/mapFilters';
import { specificTopicsOf } from '../../supabase/functions/_shared/sources/topics';

export type FeedKind = 'police' | 'community' | 'traffic' | 'vma' | 'crisis' | 'news';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  incidentType: IncidentType | null;
  title: string;
  body: string;
  /** The text exists but is part of Pro */
  bodyLocked: boolean;
  area: string;
  time: string;
  timestamp: number;
  source: string;
  url: string | null;
  active: boolean;
  /** Active VMA, shown first */
  pinned: boolean;
  lat: number | null;
  lng: number | null;
  /** Link to the event on the map, for events the map can focus */
  mapLink: string | null;
  related: ExternalEvent[];
  /** Trafikverket's report of the same accident */
  alsoReported: Incident[];
  /** The source's own image for a news or crisis post, with its credit */
  image: { url: string; credit: string | null } | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NEWS_MAX_AGE_MS = 3 * DAY;
const CRISIS_MAX_AGE_MS = 7 * DAY;
const RELATED_BEFORE_MS = 6 * HOUR;
const RELATED_AFTER_MS = 2 * DAY;
const RELATED_DISTANCE_KM = 20;
const MAX_RELATED = 3;
const SAME_STORY_WINDOW_MS = 12 * HOUR;

/** "02 oktober 14.05, Trafikolycka, Malmö" → "Trafikolycka, Malmö" */
export function cleanPoliceTitle(title: string): string {
  const parts = title.split(',').map((p) => p.trim());
  return parts.length >= 3 && /\d/.test(parts[0]) ? parts.slice(1).join(', ') : title;
}

const normalizeArea = (area: string) =>
  area.toLowerCase().trim().replace(/\s+(kommun|län|stad)$/, '').replace(/s$/, '');

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

function samePlace(event: Pick<FeedItem, 'area' | 'lat' | 'lng'>, news: ExternalEvent): boolean {
  if (news.area && event.area) {
    const a = normalizeArea(event.area);
    const b = normalizeArea(news.area);
    if (a && b && (a.includes(b) || b.includes(a))) return true;
  }
  return event.lat !== null && event.lng !== null && news.lat !== null && news.lng !== null
    && distanceKm({ lat: event.lat, lng: event.lng }, { lat: news.lat, lng: news.lng }) <= RELATED_DISTANCE_KM;
}

/**
 * News articles about the same thing as an event: same topic (fire, shooting, …), same place,
 * published from 6 hours before to 2 days after the event. Newest first, at most 3.
 */
export function findRelatedNews(
  event: Pick<FeedItem, 'title' | 'area' | 'lat' | 'lng' | 'timestamp'> & { category?: string | null },
  news: ExternalEvent[],
): ExternalEvent[] {
  const topics = specificTopicsOf(`${event.title} ${event.category ?? ''}`);
  if (topics.length === 0) return [];
  return news
    .filter((n) => {
      const time = Date.parse(n.published_at);
      if (time < event.timestamp - RELATED_BEFORE_MS || time > event.timestamp + RELATED_AFTER_MS) return false;
      const newsTopics = n.category ? [n.category] : specificTopicsOf(n.title);
      return newsTopics.some((t) => (topics as string[]).includes(t)) && samePlace(event, n);
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .slice(0, MAX_RELATED);
}

/**
 * Groups news about the same story from different outlets: same topic, same place and
 * published within 12 hours. The newest article leads; the others become its related news.
 */
export function groupNewsStories(news: ExternalEvent[]): { lead: ExternalEvent; others: ExternalEvent[] }[] {
  const groups: { lead: ExternalEvent; others: ExternalEvent[] }[] = [];
  const newestFirst = [...news].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  for (const article of newestFirst) {
    const group = article.category
      ? groups.find(({ lead }) =>
        lead.category === article.category
        && Date.parse(lead.published_at) - Date.parse(article.published_at) <= SAME_STORY_WINDOW_MS
        && samePlace({ area: lead.area ?? '', lat: lead.lat, lng: lead.lng }, article))
      : undefined;
    if (group) group.others.push(article);
    else groups.push({ lead: article, others: [] });
  }
  return groups;
}

function incidentToItem(incident: Incident, isPremium: boolean, alsoReported: Incident[]): FeedItem {
  const kind: FeedKind = incident.type === 'trafikverket' ? 'traffic'
    : incident.source === 'Medborgarrapport' ? 'community' : 'police';
  const isSummary = !!incident.originalType?.toLowerCase().includes('sammanfattning');
  const showBody = isPremium || isSummary || kind === 'community';
  const policeUrl = incident.url?.startsWith('/') ? `https://polisen.se${incident.url}` : incident.url ?? null;
  return {
    id: incident.id,
    kind,
    incidentType: incident.type,
    title: kind === 'police' ? cleanPoliceTitle(incident.title) : incident.title,
    body: showBody ? incident.description : '',
    // The server only sends police descriptions to Pro; Trafikverket texts are Pro on the map too
    bodyLocked: !showBody && (kind === 'police' || (kind === 'traffic' && !!incident.description)),
    area: incident.area,
    time: incident.time,
    timestamp: parseIncidentTime(incident.time)?.getTime() ?? 0,
    source: kind === 'police' ? 'Polisen' : incident.source,
    // Event pages on polisen.se hold the full description, which is part of Pro
    url: kind === 'police' ? (isPremium ? policeUrl : null) : incident.url ?? null,
    active: incident.status === 'active',
    pinned: false,
    lat: incident.lat,
    lng: incident.lng,
    mapLink: kind === 'police' ? `/karta?incident=${encodeURIComponent(incident.id)}` : null,
    related: [],
    alsoReported,
    image: null,
  };
}

function externalToItem(event: ExternalEvent, now: number): FeedItem {
  const timestamp = Date.parse(event.published_at);
  const end = event.ends_at ? Date.parse(event.ends_at) : timestamp + CRISIS_DEFAULT_DURATION_MS;
  const active = event.kind === 'news' ? false : end >= now;
  return {
    id: event.id,
    kind: event.kind,
    incidentType: event.kind === 'vma' || event.kind === 'crisis' ? 'crisis' : null,
    title: event.title,
    body: event.summary,
    bodyLocked: false,
    area: event.area ?? 'Sverige',
    time: event.published_at,
    timestamp,
    source: sourceName(event.source),
    url: event.url,
    active,
    pinned: event.kind === 'vma' && active,
    lat: event.lat,
    lng: event.lng,
    mapLink: null,
    related: [],
    alsoReported: [],
    image: event.image_url ? { url: event.image_url, credit: event.image_credit ?? null } : null,
  };
}

export interface FeedSources {
  police: Incident[];
  traffic: Incident[];
  community: Incident[];
  external: ExternalEvent[];
  isPremium: boolean;
  now?: number;
}

/**
 * Everything for the feed, newest first with active VMA on top. Police, traffic and community
 * items follow the map's rules (7 days, Pro delay); crisis info stays 7 days, news 3 days.
 * News related to an event is shown under that event instead of as its own post.
 */
export function buildFeed({ police, traffic, community, external, isPremium, now = Date.now() }: FeedSources): FeedItem[] {
  const { traffic: separateTraffic, linked } = linkTrafficDuplicates(police, traffic);
  // Roadworks stay on the map; the feed only gets acute disruptions
  const acuteTraffic = separateTraffic.filter((t) => t.acute !== false);
  const visibleIncidents = filterIncidentsForMap(
    [...police, ...acuteTraffic, ...(isPremium ? community : [])],
    { isPremium, now },
  );

  const items: FeedItem[] = visibleIncidents.map((i) => incidentToItem(i, isPremium, linked.get(i.id) ?? []));
  const news: ExternalEvent[] = [];
  for (const event of external) {
    const age = now - Date.parse(event.published_at);
    if (event.kind === 'news') {
      if (age <= NEWS_MAX_AGE_MS) news.push(event);
    } else if ((event.kind === 'vma' || event.kind === 'crisis') && age <= CRISIS_MAX_AGE_MS) {
      items.push(externalToItem(event, now));
    }
  }

  const usedNews = new Set<string>();
  for (const item of items) {
    if (item.kind === 'traffic') continue;
    const category = item.kind === 'police' ? item.title : null;
    item.related = findRelatedNews({ ...item, category }, news);
    item.related.forEach((n) => usedNews.add(n.id));
  }
  for (const { lead, others } of groupNewsStories(news.filter((n) => !usedNews.has(n.id)))) {
    items.push({ ...externalToItem(lead, now), related: others.slice(0, MAX_RELATED) });
  }

  return items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.timestamp - a.timestamp);
}

export type FeedFilter = 'all' | 'police' | 'traffic' | 'crisis' | 'news' | 'mine';

export function filterFeed(items: FeedItem[], filter: FeedFilter, watchedKommuner: string[] = []): FeedItem[] {
  switch (filter) {
    case 'police': return items.filter((i) => i.kind === 'police' || i.kind === 'community');
    case 'traffic': return items.filter((i) => i.kind === 'traffic');
    case 'crisis': return items.filter((i) => i.kind === 'vma' || i.kind === 'crisis');
    case 'news': return items.filter((i) => i.kind === 'news' || i.related.length > 0);
    case 'mine': {
      const watched = watchedKommuner.map(normalizeArea).filter(Boolean);
      return items.filter((i) => {
        const area = normalizeArea(i.area);
        return !!area && watched.some((k) => area.includes(k) || k.includes(area));
      });
    }
    default: return items;
  }
}

export interface FeedSection {
  key: string;
  label: string;
  items: FeedItem[];
}

const dayKey = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Splits the feed into "Viktigt just nu" (active VMA), "Idag", "Igår" and older days. */
export function groupByDay(items: FeedItem[], now = Date.now()): FeedSection[] {
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY);
  const weekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  const sections: FeedSection[] = [];
  for (const item of items) {
    const key = item.pinned ? 'pinned' : dayKey(item.timestamp);
    let section = sections.find((s) => s.key === key);
    if (!section) {
      const label = key === 'pinned' ? 'Viktigt just nu'
        : key === today ? 'Idag'
        : key === yesterday ? 'Igår'
        : weekday.format(new Date(item.timestamp)).replace(/^./, (c) => c.toUpperCase());
      section = { key, label, items: [] };
      sections.push(section);
    }
    section.items.push(item);
  }
  return sections;
}
