// The crime atlas: what is most common in a kommun compared with Sweden, and where a kind of crime
// is most common, per inhabitant. From Polisen's published events, summed in the database
// (crime_atlas), and SCB's population (data/kommunPopulation). Polisen publishes a selection of
// what happens, so this is what Polisen has reported, not all crime.
import { KOMMUN_COORDINATES, SWEDISH_KOMMUNER } from '@/data/kommuner';
import { KOMMUN_POPULATION } from '@/data/kommunPopulation';
import { kommunMatcher } from '../../supabase/functions/_shared/notifications';
import { THEMES, themeOf, type Theme } from '../../supabase/functions/_shared/themes';

export { THEMES, type Theme };

/** One sum from crime_atlas(_places): events in a place and category, in the period and the one before */
export interface AtlasRow {
  area: string;
  /** The town at the end of Polisen's title, "Södertälje" (crime_atlas_places) */
  place?: string | null;
  /** Where the events were, when better known than the län's middle (crime_atlas_places) */
  lat?: number | null;
  lng?: number | null;
  category: string;
  now_count: number;
  before_count: number;
}

export interface Counts {
  now: number;
  before: number;
}

export interface Atlas {
  /** kommun → theme id → counts; "alla" is every event in the kommun, themed or not */
  byKommun: Map<string, Map<string, Counts>>;
  /** theme id → counts in all of Sweden's kommuner */
  sweden: Map<string, Counts>;
  population: number;
}

export const ALL = 'alla';

/** The first day the archive holds Polisen's events for (police_events_archive) */
export const ARCHIVE_START = '2026-09-28';

/** Whole days from the archive's first day to now, so "Sedan start" asks for all of it */
export const daysSinceStart = (now = Date.now()) => Math.max(1, Math.ceil((now - Date.parse(`${ARCHIVE_START}T00:00:00+02:00`)) / 86_400_000));

export interface Period {
  days: number;
  /** "30 dagar", "sedan 28 sep" */
  short: string;
  /** "de senaste 30 dagarna", "sedan 28 september" */
  long: string;
}

export function periodOf(choice: string, now = Date.now()): Period {
  if (choice === 'start') {
    const date = new Date(`${ARCHIVE_START}T12:00:00Z`);
    const day = date.getUTCDate();
    const month = date.toLocaleDateString('sv-SE', { month: 'long', timeZone: 'UTC' });
    return { days: daysSinceStart(now), short: `sedan ${day} ${month.slice(0, 3)}`, long: `sedan ${day} ${month}` };
  }
  const days = Number(choice) || 30;
  return { days, short: `${days} dagar`, long: `de senaste ${days} dagarna` };
}

/** Fewer events than this say too little to compare */
export const MIN_EVENTS = 3;

const areaCache = new Map<string, string | null>();
const matchers = SWEDISH_KOMMUNER.map((name) => ({ name, matches: kommunMatcher(name) }));

/** The kommun a place name from Polisen lies in: an exact name first, then a name within it */
export function kommunOfArea(area: string): string | null {
  let found = areaCache.get(area);
  if (found !== undefined) return found;
  const text = area.trim().toLocaleLowerCase('sv-SE');
  found = SWEDISH_KOMMUNER.find((k) => k.toLocaleLowerCase('sv-SE') === text)
    ?? matchers.find((m) => m.matches(area))?.name
    ?? null;
  areaCache.set(area, found);
  return found;
}

const isLan = (name: string | null | undefined) => !!name && /\blän$/i.test(name.trim());

// A position belongs to the nearest kommun's middle, if one is this close; further out it may as
// well be the next one, and the event is better left out than put in the wrong place
const NEAREST_KM = 25;

export function nearestKommun(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestKm = NEAREST_KM;
  const cos = Math.cos((lat * Math.PI) / 180);
  for (const k of KOMMUN_COORDINATES) {
    const km = Math.hypot(k.lat - lat, (k.lng - lng) * cos) * 111;
    if (km < bestKm) { bestKm = km; best = k.name; }
  }
  return best;
}

/**
 * The kommun a sum belongs to: the area when it is a kommun, else the town in Polisen's title,
 * else the nearest kommun to where it happened. Polisen puts many events on a whole län
 * ("Stockholms län"), and without this Stockholm had almost none.
 */
export function kommunOfRow(row: Pick<AtlasRow, 'area' | 'place' | 'lat' | 'lng'>): string | null {
  if (!isLan(row.area)) {
    const k = kommunOfArea(row.area);
    if (k) return k;
  }
  if (row.place && !isLan(row.place)) {
    const k = kommunOfArea(row.place);
    if (k) return k;
  }
  if (row.lat != null && row.lng != null) return nearestKommun(row.lat, row.lng);
  return null;
}

const add = (map: Map<string, Counts>, key: string, row: AtlasRow) => {
  const c = map.get(key) ?? { now: 0, before: 0 };
  c.now += row.now_count;
  c.before += row.before_count;
  map.set(key, c);
};

export function buildAtlas(rows: AtlasRow[]): Atlas {
  const byKommun = new Map<string, Map<string, Counts>>();
  const sweden = new Map<string, Counts>();
  for (const row of rows) {
    const kommun = kommunOfRow(row);
    if (!kommun) continue;
    const themes = byKommun.get(kommun) ?? new Map<string, Counts>();
    byKommun.set(kommun, themes);
    const theme = themeOf(row.category);
    for (const key of theme ? [ALL, theme.id] : [ALL]) {
      add(themes, key, row);
      add(sweden, key, row);
    }
  }
  const population = SWEDISH_KOMMUNER.reduce((sum, k) => sum + (KOMMUN_POPULATION[k] ?? 0), 0);
  return { byKommun, sweden, population };
}

const count = (atlas: Atlas, kommun: string, theme: string): Counts => atlas.byKommun.get(kommun)?.get(theme) ?? { now: 0, before: 0 };

/** Events per 100 000 inhabitants */
export const per100k = (events: number, population: number) => (population > 0 ? (events / population) * 100_000 : 0);

/** How many times more common in the kommun than in Sweden, or null when there is too little */
export function ratioToSweden(atlas: Atlas, kommun: string, theme: string): number | null {
  const here = count(atlas, kommun, theme).now;
  const pop = KOMMUN_POPULATION[kommun] ?? 0;
  const all = atlas.sweden.get(theme)?.now ?? 0;
  if (here < MIN_EVENTS || !pop || !all) return null;
  return per100k(here, pop) / per100k(all, atlas.population);
}

/** Percent from the period before to this one, or null when too little to say */
export function changeOf({ now, before }: Counts): number | null {
  if (before < 5) return null;
  return Math.round(((now - before) / before) * 100);
}

export interface KommunTheme {
  theme: Theme;
  count: number;
  /** Of all the kommun's themed events, 0–1 */
  share: number;
  ratio: number | null;
  change: number | null;
}

export interface KommunProfile {
  kommun: string;
  population: number;
  total: number;
  /** All events per 100 000 inhabitants, and against Sweden */
  rate: number;
  ratio: number | null;
  themes: KommunTheme[];
  /** The kind that stands out most: most over Sweden's level, with enough events */
  standout: KommunTheme | null;
}

export function kommunProfile(atlas: Atlas, kommun: string): KommunProfile {
  const population = KOMMUN_POPULATION[kommun] ?? 0;
  const total = count(atlas, kommun, ALL).now;
  const themed = THEMES.map((theme) => ({ theme, counts: count(atlas, kommun, theme.id) })).filter((t) => t.counts.now > 0);
  const themedTotal = themed.reduce((s, t) => s + t.counts.now, 0);
  const themes = themed
    .map(({ theme, counts }) => ({
      theme,
      count: counts.now,
      share: themedTotal ? counts.now / themedTotal : 0,
      ratio: ratioToSweden(atlas, kommun, theme.id),
      change: changeOf(counts),
    }))
    .sort((a, b) => b.count - a.count || a.theme.label.localeCompare(b.theme.label, 'sv'));
  const standout = themes.filter((t) => t.ratio !== null && t.ratio >= 1.3).sort((a, b) => b.ratio! - a.ratio!)[0] ?? null;
  return { kommun, population, total, rate: per100k(total, population), ratio: ratioToSweden(atlas, kommun, ALL), themes, standout };
}

export interface KommunRate {
  kommun: string;
  count: number;
  rate: number;
  change: number | null;
}

/** Every kommun with the theme's events and rate, most common per inhabitant first */
export function themeRanking(atlas: Atlas, theme: string): KommunRate[] {
  const rows: KommunRate[] = [];
  for (const kommun of SWEDISH_KOMMUNER) {
    const counts = count(atlas, kommun, theme);
    const pop = KOMMUN_POPULATION[kommun] ?? 0;
    if (!counts.now && !counts.before) continue;
    rows.push({ kommun, count: counts.now, rate: per100k(counts.now, pop), change: changeOf(counts) });
  }
  return rows.sort((a, b) => b.rate - a.rate || b.count - a.count);
}

/** Where it is most common per inhabitant, among kommuner with enough events to say so */
export const mostCommon = (ranking: KommunRate[], limit = 10) => ranking.filter((r) => r.count >= MIN_EVENTS).slice(0, limit);

/** Where it rose most, among kommuner with enough events before */
export const risingMost = (ranking: KommunRate[], limit = 5) =>
  ranking.filter((r) => r.change !== null && r.change > 0).sort((a, b) => b.change! - a.change!).slice(0, limit);

/** "2,3×", "0,8×" */
export const formatRatio = (ratio: number) => `${ratio.toLocaleString('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: ratio < 10 ? 1 : 0 })}×`;

/** "12,4", "3" */
export const formatRate = (rate: number) => rate.toLocaleString('sv-SE', { maximumFractionDigits: rate < 10 ? 1 : 0 });

/** "Inbrott är 2,3× vanligare i Nacka än i Sverige", or "mindre vanligt" */
export function ratioSentence(theme: Theme, kommun: string, ratio: number): string {
  if (ratio >= 1) return `${theme.label} är ${formatRatio(ratio)} vanligare i ${kommun} än i Sverige`;
  return `${theme.label} är ${formatRatio(1 / ratio)} ovanligare i ${kommun} än i Sverige`;
}
