// Who gets a push notification for which police event, and what it says. Shared by the
// send-push-notifications edge function and the Notiser page, so both agree.
import { THEMES, themeOf } from './themes.ts';

export const NOTIFY_TYPES = ['police', 'fire', 'ambulance', 'traffic', 'other'] as const;
export type NotifyType = typeof NOTIFY_TYPES[number];

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

/** The kinds of crime to choose from (themes.ts), and "everything else" for events of no kind */
export const OTHER_THEME = 'annat';
export const NOTIFY_THEMES: { id: string; label: string }[] = [
  ...THEMES.map(({ id, label }) => ({ id, label })),
  { id: OTHER_THEME, label: 'Allt annat' },
];

export interface QuietHours {
  /** Hours in Swedish time, 0–23: quiet from `start` until `end` (over midnight when start > end) */
  start: number;
  end: number;
}

export interface NearArea {
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface NotifySettings {
  types: NotifyType[];
  minRisk: RiskLevel;
  /** Only these kinds of crime (NOTIFY_THEMES); null for everything the types allow */
  themes: string[] | null;
  /** No notifications these hours; null for none */
  quiet: QuietHours | null;
  /** Events within this distance of a place too, besides the watched kommuner; null for none */
  near: NearArea | null;
}

/** Everything, as before settings existed. Users without a settings row get this. */
export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = { types: [...NOTIFY_TYPES], minRisk: 'low', themes: null, quiet: null, near: null };

/** The distances to choose between for "near me", in km */
export const NEAR_RADII_KM = [1, 2, 3, 5, 10, 15, 20, 30, 50];

/** "800 m", "5 km" */
export const radiusLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`);

/** "22–07" */
export const quietLabel = (q: QuietHours) => `${String(q.start).padStart(2, '0')}–${String(q.end).padStart(2, '0')}`;

export const TYPE_LABELS: Record<NotifyType, string> = {
  police: 'Polisinsats',
  fire: 'Brand',
  ambulance: 'Ambulans',
  traffic: 'Trafikolycka',
  other: 'Övrigt',
};

const TYPE_ICONS: Record<NotifyType, string> = {
  police: '🚨',
  fire: '🔥',
  ambulance: '🚑',
  traffic: '🚗',
  other: '📍',
};

const isNotifyType = (value: string): value is NotifyType => (NOTIFY_TYPES as readonly string[]).includes(value);
const isRiskLevel = (value: string): value is RiskLevel => (RISK_LEVELS as readonly string[]).includes(value);

export interface SettingsRow {
  types?: string[] | null;
  min_risk?: string | null;
  themes?: string[] | null;
  quiet_start?: number | null;
  quiet_end?: number | null;
  near_lat?: number | null;
  near_lng?: number | null;
  near_radius_km?: number | null;
}

const isHour = (h: unknown): h is number => typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23;
const THEME_IDS = new Set(NOTIFY_THEMES.map((t) => t.id));

/** Settings from a notification_settings row; anything missing or unknown falls back to the default. */
export function settingsFromRow(row?: SettingsRow | null): NotifySettings {
  const types = (row?.types ?? []).filter(isNotifyType);
  const themes = row?.themes ? row.themes.filter((t) => THEME_IDS.has(t)) : null;
  const { near_lat: lat, near_lng: lng, near_radius_km: radius } = row ?? {};
  return {
    types: row?.types ? types : DEFAULT_NOTIFY_SETTINGS.types,
    minRisk: row?.min_risk && isRiskLevel(row.min_risk) ? row.min_risk : DEFAULT_NOTIFY_SETTINGS.minRisk,
    themes: themes && themes.length ? themes : null,
    quiet: isHour(row?.quiet_start) && isHour(row?.quiet_end) && row!.quiet_start !== row!.quiet_end ? { start: row!.quiet_start!, end: row!.quiet_end! } : null,
    near: typeof lat === 'number' && typeof lng === 'number' && typeof radius === 'number' && radius > 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, radiusKm: Math.min(radius, 100) }
      : null,
  };
}

/** The row the settings are stored as */
export function settingsToRow(settings: NotifySettings): Required<SettingsRow> {
  return {
    types: settings.types,
    min_risk: settings.minRisk,
    themes: settings.themes,
    quiet_start: settings.quiet?.start ?? null,
    quiet_end: settings.quiet?.end ?? null,
    // A place to about a hundred metres is enough to draw a circle around, and no more is kept
    near_lat: settings.near ? Math.round(settings.near.lat * 1000) / 1000 : null,
    near_lng: settings.near ? Math.round(settings.near.lng * 1000) / 1000 : null,
    near_radius_km: settings.near?.radiusKm ?? null,
  };
}

/** The kind of crime an event is ("inbrott"), or "annat" */
export function eventTheme(event: { original_type?: string | null; title?: string | null }): string {
  return themeOf(event.original_type || event.title || '')?.id ?? OTHER_THEME;
}

/**
 * Whether an event passes the user's settings: the chosen kinds of crime when there are some,
 * else the types; and serious enough.
 */
export function wantsEvent(settings: NotifySettings, event: { type: string; risk: string | null; original_type?: string | null; title?: string | null }): boolean {
  if (settings.themes) {
    if (!settings.themes.includes(eventTheme(event))) return false;
  } else {
    const type = isNotifyType(event.type) ? event.type : 'other';
    if (!settings.types.includes(type)) return false;
  }
  const risk = event.risk && isRiskLevel(event.risk) ? event.risk : 'low';
  return RISK_LEVELS.indexOf(risk) >= RISK_LEVELS.indexOf(settings.minRisk);
}

/** The distance between two places, in km */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Whether an event lies within the user's "near me" circle */
export function nearEvent(settings: NotifySettings, event: { lat?: number | null; lng?: number | null }): boolean {
  if (!settings.near || typeof event.lat !== 'number' || typeof event.lng !== 'number') return false;
  return distanceKm(settings.near.lat, settings.near.lng, event.lat, event.lng) <= settings.near.radiusKm;
}

const stockholmHour = (nowMs: number) =>
  Number(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', hourCycle: 'h23' }).format(nowMs));

/** Whether it is the user's quiet hours now, in Swedish time */
export function inQuietHours(settings: NotifySettings, nowMs: number): boolean {
  if (!settings.quiet) return false;
  const hour = stockholmHour(nowMs);
  const { start, end } = settings.quiet;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether an event area ("Uppsala", "Stockholms län", "Lunds kommun") lies in a watched kommun.
 * Whole names only, so Sala does not match Uppsala and Berg does not match Falkenberg.
 */
export function areaMatchesKommun(area: string | null | undefined, kommun: string): boolean {
  return kommunMatcher(kommun)(area);
}

/** areaMatchesKommun for one kommun, built once, for matching many areas. */
export function kommunMatcher(kommun: string): (area: string | null | undefined) => boolean {
  const name = kommun.trim().toLocaleLowerCase('sv-SE');
  if (!name) return () => false;
  // Allow the genitive ("Stockholms län") unless the name already ends in s
  const genitive = name.endsWith('s') ? '' : 's?';
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}${genitive}(?![\\p{L}\\p{N}])`, 'u');
  return (area) => {
    const text = (area ?? '').toLocaleLowerCase('sv-SE');
    return !!text && pattern.test(text);
  };
}

/** The first watched kommun an area lies in, or null. */
export function watchedKommunFor(area: string | null | undefined, kommuner: string[]): string | null {
  return kommuner.find((k) => areaMatchesKommun(area, k)) ?? null;
}

export interface PushEvent {
  id: string;
  title: string;
  area: string | null;
  lat?: number | null;
  lng?: number | null;
  type: string;
  risk: string | null;
  time: string;
  original_type: string | null;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
  incidentId: string | null;
}

const clockTime = (time: string) => {
  const date = new Date(time);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
};

/** "Rån" from Polisen's own category, else the app's label for the type. */
const categoryOf = (event: PushEvent) => {
  const type = isNotifyType(event.type) ? event.type : 'other';
  return event.original_type?.trim() || TYPE_LABELS[type];
};

const iconOf = (event: PushEvent) => TYPE_ICONS[isNotifyType(event.type) ? event.type : 'other'];

/** The notification for one user's new events, newest first: one event opens it on the map. */
export function buildPushMessage(events: PushEvent[]): PushMessage {
  const sorted = [...events].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const first = sorted[0];
  const area = first.area || 'ditt område';

  if (sorted.length === 1) {
    const time = clockTime(first.time);
    return {
      title: `${iconOf(first)} ${categoryOf(first)} · ${area}`,
      body: `${time ? `Kl. ${time} · ` : ''}Polisen rapporterar en ny händelse i ${area}. Tryck för att se den på kartan.`,
      url: `/karta?incident=${encodeURIComponent(first.id)}`,
      tag: `crimealert-incident-${first.id}`,
      incidentId: first.id,
    };
  }

  const lines = sorted.slice(0, 3).map((e) => {
    const time = clockTime(e.time);
    return `${iconOf(e)} ${categoryOf(e)} · ${e.area || 'okänd plats'}${time ? ` (${time})` : ''}`;
  });
  if (sorted.length > 3) lines.push(`och ${sorted.length - 3} till`);
  return {
    title: `${sorted.length} nya händelser i dina områden`,
    body: lines.join('\n'),
    url: '/alerts',
    tag: `crimealert-incident-${first.id}`,
    incidentId: null,
  };
}

/** The test notification opens a page in the app; only plain paths are accepted. */
export function safeAppPath(value: unknown, fallback = '/alerts'): string {
  return typeof value === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(value) ? value : fallback;
}

/** Free accounts get Polisen's events, on the map and as notifications, 15 minutes after they happened. */
export const FREE_DELAY_MS = 15 * 60 * 1000;

// "2026-10-02 14:05:00 +02:00" from Polisen or "2026-10-02T12:05:00+00:00" from the database
const eventTimeMs = (time: string) => Date.parse(time.replace(' ', 'T').replace(/\s+([+-]\d{2}:\d{2})$/, '$1'));

/** Whether a free account may be told about the event now (it is on their map). */
export function freeMayNotify(time: string, now: number): boolean {
  const at = eventTimeMs(time);
  return !Number.isNaN(at) && at + FREE_DELAY_MS <= now;
}

/** Whether the event reached free accounts within the last `windowMs`, so a push run is due for them. */
export function reachedFreeWithin(time: string, now: number, windowMs: number): boolean {
  const at = eventTimeMs(time);
  return !Number.isNaN(at) && at + FREE_DELAY_MS <= now && at + FREE_DELAY_MS > now - windowMs;
}
