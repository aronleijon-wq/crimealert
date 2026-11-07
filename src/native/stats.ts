// What the Statistik tab in the iPhone app (NativeStats) works out from Polisen's events: how
// many of each kind of crime, whether it rises or falls, when in the week things happen, how
// long since the last shooting, and which kommuner change most. All of it from the archive the
// app already reads; nothing is stored.
import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import { kommunMatcher } from '../../supabase/functions/_shared/notifications';

/** One event, as much as the statistics need of it */
export interface StatEvent {
  /** Milliseconds */
  at: number;
  area: string;
  /** Polisen's own category, "Skottlossning" */
  category: string;
}

export interface Theme {
  id: string;
  label: string;
  /** "skjutningar" in a sentence */
  plural: string;
  match: RegExp;
  /** "en skjutning", for kinds where "days since the last one" says something */
  one?: string;
}

/** Polisen's categories grouped as people talk about them; the first match wins */
export const THEMES: Theme[] = [
  { id: 'skjutning', label: 'Skjutningar', plural: 'skjutningar', match: /skottlossning/i, one: 'en skjutning' },
  { id: 'sprangning', label: 'Sprängningar', plural: 'sprängningar', match: /detonation|explosion|sprängning/i, one: 'en sprängning' },
  { id: 'mord', label: 'Mord och dråp', plural: 'mord och dråp', match: /mord|dråp/i, one: 'mord eller dråp' },
  { id: 'ran', label: 'Rån', plural: 'rån', match: /^rån/i, one: 'ett rån' },
  { id: 'misshandel', label: 'Misshandel', plural: 'misshandelsfall', match: /misshandel/i },
  { id: 'inbrott', label: 'Inbrott', plural: 'inbrott', match: /inbrott/i },
  { id: 'stold', label: 'Stölder', plural: 'stölder', match: /stöld/i },
  { id: 'hot', label: 'Olaga hot', plural: 'fall av olaga hot', match: /olaga hot/i },
  { id: 'bedrageri', label: 'Bedrägerier', plural: 'bedrägerier', match: /bedrägeri/i },
  { id: 'narkotika', label: 'Narkotikabrott', plural: 'narkotikabrott', match: /narkotika/i },
  { id: 'rattfylleri', label: 'Rattfylleri', plural: 'rattfyllerier', match: /rattfylleri/i },
  { id: 'brand', label: 'Bränder', plural: 'bränder', match: /brand/i },
  { id: 'trafik', label: 'Trafikolyckor', plural: 'trafikolyckor', match: /trafikolycka/i },
];

const themeCache = new Map<string, Theme | null>();

export function themeOf(category: string): Theme | null {
  let theme = themeCache.get(category);
  if (theme === undefined) themeCache.set(category, (theme = THEMES.find((t) => t.match.test(category)) ?? null));
  return theme;
}

const DAY = 24 * 60 * 60 * 1000;

const stockholm = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

/** The Swedish calendar day, hour and weekday (0 = måndag) of a moment */
export function swedishTime(at: number): { day: string; hour: number; weekday: number } {
  const parts = Object.fromEntries(stockholm.formatToParts(at).map((p) => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return { day, hour: Number(parts.hour) % 24, weekday };
}

/** Events in an area: a kommun, or all of Sweden for null */
export function inArea(events: StatEvent[], kommun: string | null): StatEvent[] {
  if (!kommun) return events;
  const matches = kommunMatcher(kommun);
  const areas = new Map<string, boolean>();
  return events.filter((e) => {
    let hit = areas.get(e.area);
    if (hit === undefined) areas.set(e.area, (hit = matches(e.area)));
    return hit;
  });
}

const isSummary = (e: StatEvent) => /sammanfattning/i.test(e.category);

/** Change from before to now in percent, or null when there is too little to say */
export function change(now: number, before: number): number | null {
  if (before < 3 && now < 3) return null;
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export interface ThemeTrend {
  theme: Theme;
  count: number;
  previous: number;
  /** Percent, null when the numbers are too small */
  change: number | null;
  /** Events per week, oldest first, for a small chart */
  weeks: number[];
}

export interface Pulse {
  last24h: number;
  /** What an ordinary day has had, over the period before today */
  perDay: number;
  level: 'calm' | 'normal' | 'busy';
}

export interface AreaStats {
  total: number;
  previousTotal: number;
  totalChange: number | null;
  pulse: Pulse;
  /** Events per Swedish day over the period, oldest first */
  daily: { day: string; count: number }[];
  /** [weekday][hour], weekday 0 = måndag */
  heatmap: number[][];
  peak: { weekday: number; hour: number; count: number } | null;
  trends: ThemeTrend[];
  /** How long since the last of the serious kinds, within what the archive holds */
  sinceLast: { theme: Theme; days: number | null; at: number | null }[];
}

/**
 * The statistics for one area over `days` days up to `now`, compared with the `days` before.
 * `events` should reach back 2 × days.
 */
export function areaStats(all: StatEvent[], kommun: string | null, days: number, now = Date.now()): AreaStats {
  const events = inArea(all, kommun).filter((e) => !isSummary(e) && e.at <= now);
  const start = now - days * DAY;
  const previousStart = now - 2 * days * DAY;
  const current = events.filter((e) => e.at > start);
  const previous = events.filter((e) => e.at > previousStart && e.at <= start);

  const last24h = current.filter((e) => e.at > now - DAY).length;
  const before = events.filter((e) => e.at > now - (days + 1) * DAY && e.at <= now - DAY).length;
  const perDay = before / days;
  const ratio = perDay > 0 ? last24h / perDay : last24h > 0 ? 2 : 1;
  const pulse: Pulse = { last24h, perDay, level: ratio < 0.75 ? 'calm' : ratio > 1.3 ? 'busy' : 'normal' };

  const dayCounts = new Map<string, number>();
  for (let d = days - 1; d >= 0; d--) dayCounts.set(swedishTime(now - d * DAY).day, 0);
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const e of current) {
    const t = swedishTime(e.at);
    if (dayCounts.has(t.day)) dayCounts.set(t.day, (dayCounts.get(t.day) ?? 0) + 1);
    heatmap[t.weekday][t.hour] += 1;
  }
  let peak: AreaStats['peak'] = null;
  heatmap.forEach((hours, weekday) => hours.forEach((count, hour) => {
    if (count > (peak?.count ?? 0)) peak = { weekday, hour, count };
  }));

  const weeksBack = Math.max(2, Math.round((2 * days) / 7));
  const trends: ThemeTrend[] = THEMES.map((theme) => {
    const mine = events.filter((e) => themeOf(e.category) === theme);
    const weeks = Array<number>(weeksBack).fill(0);
    for (const e of mine) {
      const back = Math.floor((now - e.at) / (7 * DAY));
      if (back < weeksBack) weeks[weeksBack - 1 - back] += 1;
    }
    const count = mine.filter((e) => e.at > start).length;
    const prev = mine.filter((e) => e.at > previousStart && e.at <= start).length;
    return { theme, count, previous: prev, change: change(count, prev), weeks };
  })
    // The serious kinds first, in a fixed order, even when they are few; then the rest, busiest first
    .filter((t) => t.count + t.previous > 0 || t.theme.one)
    .sort((a, b) => (a.theme.one ? 0 : 1) - (b.theme.one ? 0 : 1)
      || (a.theme.one ? THEMES.indexOf(a.theme) - THEMES.indexOf(b.theme) : b.count - a.count || b.previous - a.previous));

  const sinceLast = THEMES.filter((t) => t.one).map((theme) => {
    const last = events.filter((e) => themeOf(e.category) === theme).reduce((max, e) => Math.max(max, e.at), 0);
    return { theme, at: last || null, days: last ? Math.floor((now - last) / DAY) : null };
  });

  return {
    total: current.length,
    previousTotal: previous.length,
    totalChange: change(current.length, previous.length),
    pulse,
    daily: [...dayCounts].map(([day, count]) => ({ day, count })),
    heatmap,
    peak,
    trends,
    sinceLast,
  };
}

export interface KommunChange {
  name: string;
  count: number;
  previous: number;
  change: number | null;
}

/** Every kommun's events in the period and the one before, busiest first */
export function kommunChanges(all: StatEvent[], days: number, now = Date.now()): KommunChange[] {
  const start = now - days * DAY;
  const previousStart = now - 2 * days * DAY;
  const areas = new Map<string, [number, number]>();
  for (const e of all) {
    if (isSummary(e) || e.at > now || e.at <= previousStart || !e.area) continue;
    const counts = areas.get(e.area) ?? [0, 0];
    counts[e.at > start ? 0 : 1] += 1;
    areas.set(e.area, counts);
  }
  const rows: KommunChange[] = [];
  for (const name of SWEDISH_KOMMUNER) {
    const matches = kommunMatcher(name);
    let count = 0;
    let previous = 0;
    for (const [area, [c, p]] of areas) if (matches(area)) { count += c; previous += p; }
    if (count || previous) rows.push({ name, count, previous, change: change(count, previous) });
  }
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'));
}

/** Kommuner where the events rose most, among those with enough to compare */
export function risingKommuner(rows: KommunChange[], min = 10, limit = 5): KommunChange[] {
  return rows
    .filter((r) => r.previous >= min && r.change !== null && r.change > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
    .slice(0, limit);
}

export const WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
export const WEEKDAYS_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

const hourSpan = (hour: number) => `${String(hour).padStart(2, '0')}–${String((hour + 1) % 24).padStart(2, '0')}`;

/** A few sentences that say the most interesting things in the numbers */
export function insights(stats: AreaStats, place: string, days: number): string[] {
  const out: string[] = [];
  const period = `de senaste ${days} dagarna`;
  const moved = stats.trends
    .filter((t) => t.change !== null && Math.abs(t.change) >= 15 && t.count + t.previous >= 6)
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))[0];
  if (moved && moved.change !== null) {
    const word = moved.change > 0 ? 'ökat' : 'minskat';
    out.push(`${moved.theme.label} har ${word} med ${Math.abs(moved.change)} % i ${place} ${period}, jämfört med perioden före (${moved.previous} → ${moved.count}).`);
  }
  if (stats.peak && stats.total >= 20) {
    out.push(`Flest händelser rapporteras på ${WEEKDAYS[stats.peak.weekday]}ar kl. ${hourSpan(stats.peak.hour)}.`);
  }
  const quiet = stats.sinceLast.filter((s) => s.days !== null && s.days >= 7).sort((a, b) => (b.days ?? 0) - (a.days ?? 0))[0];
  if (quiet && quiet.days !== null) {
    out.push(`Det har gått ${quiet.days} dagar sedan Polisen senast rapporterade ${quiet.theme.one} i ${place}.`);
  }
  if (stats.totalChange !== null && Math.abs(stats.totalChange) >= 5) {
    out.push(`Totalt ${stats.total} händelser ${period}, ${Math.abs(stats.totalChange)} % ${stats.totalChange > 0 ? 'fler' : 'färre'} än perioden före.`);
  }
  return out.slice(0, 3);
}
