// The public page per kommun (/kommun/malmo): its address, and what it shows from the police data.

import { KOMMUN_COORDINATES, SWEDISH_KOMMUNER } from '@/data/kommuner';
import type { Incident, IncidentType } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';
import { kommunSlug } from '../../supabase/functions/_shared/kommunSlug';
import { areaMatchesKommun, kommunMatcher } from '../../supabase/functions/_shared/notifications';

export { kommunSlug };

const BY_SLUG = new Map(SWEDISH_KOMMUNER.map((name) => [kommunSlug(name), name]));

/** The kommun a page address names, or null. */
export const kommunFromSlug = (slug: string | undefined): string | null => (slug ? BY_SLUG.get(slug.toLowerCase()) ?? null : null);

export const kommunPath = (name: string) => `/kommun/${kommunSlug(name)}`;

/** "Malmö" → "Malmö kommun", but "Gotland" → "Region Gotland" */
export const kommunLongName = (name: string) => (name === 'Gotland' ? 'Region Gotland' : `${name} kommun`);

const HOUR = 60 * 60 * 1000;

export interface KommunStats {
  /** The kommun's events, newest first */
  events: Incident[];
  last24h: number;
  last7d: number;
  /** Event types in the last 7 days, most common first */
  byType: { type: IncidentType; count: number }[];
  /** The most common kind of event by Polisen's own category in the last 7 days */
  topCategory: { name: string; count: number } | null;
}

/** What the police data says about one kommun. */
export function kommunStats(incidents: Incident[], kommun: string, now = Date.now()): KommunStats {
  const timed = incidents
    .filter((i) => areaMatchesKommun(i.area, kommun))
    .map((i) => ({ incident: i, at: parseIncidentTime(i.time)?.getTime() ?? NaN }))
    .filter((e) => !Number.isNaN(e.at))
    .sort((a, b) => b.at - a.at);
  const week = timed.filter((e) => now - e.at <= 7 * 24 * HOUR);

  const types = new Map<IncidentType, number>();
  const categories = new Map<string, number>();
  for (const { incident } of week) {
    types.set(incident.type, (types.get(incident.type) ?? 0) + 1);
    const category = incident.originalType?.trim();
    // Polisen's summaries are not events of their own
    if (category && !/sammanfattning/i.test(category)) categories.set(category, (categories.get(category) ?? 0) + 1);
  }
  const top = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))[0];

  return {
    events: timed.map((e) => e.incident),
    last24h: timed.filter((e) => now - e.at <= 24 * HOUR).length,
    last7d: week.length,
    byType: [...types].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    topCategory: top ? { name: top[0], count: top[1] } : null,
  };
}

/** The kommuner whose seats are closest to this one's, nearest first. */
export function neighbourKommuner(name: string, count = 6): string[] {
  const home = KOMMUN_COORDINATES.find((k) => k.name === name);
  if (!home) return [];
  const rad = Math.PI / 180;
  const distance = (p: { lat: number; lng: number }) => {
    const dLat = (p.lat - home.lat) * rad;
    const dLng = (p.lng - home.lng) * rad;
    return Math.sin(dLat / 2) ** 2 + Math.cos(home.lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLng / 2) ** 2;
  };
  return KOMMUN_COORDINATES.filter((k) => k.name !== name)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, count)
    .map((k) => k.name);
}

/** The kommuner grouped by first letter, for the index page. */
export function kommunerByLetter(): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const name of [...SWEDISH_KOMMUNER].sort((a, b) => a.localeCompare(b, 'sv'))) {
    const letter = name[0].toLocaleUpperCase('sv-SE');
    groups.set(letter, [...(groups.get(letter) ?? []), name]);
  }
  return [...groups];
}

/** Events per kommun since a time, busiest first; kommuner without events are left out. */
export function countByKommun(incidents: Incident[], since: number): { name: string; count: number }[] {
  // Count each distinct area once, then match the areas, not every event, against every kommun
  const areas = new Map<string, number>();
  for (const incident of incidents) {
    const at = parseIncidentTime(incident.time)?.getTime();
    if (at === undefined || at < since || !incident.area) continue;
    areas.set(incident.area, (areas.get(incident.area) ?? 0) + 1);
  }
  const counts: { name: string; count: number }[] = [];
  for (const name of SWEDISH_KOMMUNER) {
    const matches = kommunMatcher(name);
    let count = 0;
    for (const [area, n] of areas) if (matches(area)) count += n;
    if (count) counts.push({ name, count });
  }
  return counts.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'));
}

export interface FaqEntry { q: string; a: string }

const events = (n: number) => `${n} ${n === 1 ? 'händelse' : 'händelser'}`;

/**
 * The questions people ask about a kommun, answered from the police data on its page. Without
 * stats (still loading) the first answer says what the page shows instead of a count.
 */
export function kommunFaq(name: string, stats: KommunStats | null): FaqEntry[] {
  const long = kommunLongName(name);
  let today = `Här visas allt Polisen har rapporterat i ${long} det senaste dygnet och den senaste veckan, uppdaterat var femte minut.`;
  if (stats && stats.last24h === 0) {
    today = `Polisen har inte rapporterat någon händelse i ${long} det senaste dygnet. Den senaste veckan har det kommit ${events(stats.last7d)}.`;
  } else if (stats) {
    today = `Polisen har rapporterat ${events(stats.last24h)} i ${long} det senaste dygnet och ${events(stats.last7d)} den senaste veckan.`;
    if (stats.topCategory) today += ` Vanligast den senaste veckan är ${stats.topCategory.name.toLocaleLowerCase('sv-SE')}.`;
  }
  return [
    { q: `Vad har hänt i ${name} idag?`, a: today },
    {
      q: `Hur ser jag Polisens händelser i ${name} på en karta?`,
      a: `Tryck på "Visa ${name} på kartan". CrimeAlerts karta visar Polisens händelser i hela Sverige och är gratis att använda, utan konto.`,
    },
    {
      q: `Kan jag få en notis när något händer i ${name}?`,
      a: `Ja. Skapa ett gratis konto, välj ${name} under Notiser och slå på notiser i mobilen eller datorn. Med ett gratiskonto kommer notisen 15 minuter efter att Polisen publicerat händelsen, med Pro direkt.`,
    },
    {
      q: `Visar det här all brottslighet i ${name}?`,
      a: `Nej. Uppgifterna är Polisens händelsenotiser, ett urval av de insatser Polisen själv berättar om. Statistik över alla anmälda brott publiceras av Brottsförebyggande rådet (Brå). Platsen i en notis är ofta ungefärlig.`,
    },
  ];
}

/** Breadcrumbs and FAQ for a kommun page, as schema.org JSON-LD. */
export function kommunJsonLd(name: string, faq: FaqEntry[]): string {
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kommuner', item: 'https://crimealert.se/kommun' },
        { '@type': 'ListItem', position: 2, name, item: `https://crimealert.se${kommunPath(name)}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ]);
}
