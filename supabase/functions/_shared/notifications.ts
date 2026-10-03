// Who gets a push notification for which police event, and what it says. Shared by the
// send-push-notifications edge function and the Notiser page, so both agree.

export const NOTIFY_TYPES = ['police', 'fire', 'ambulance', 'traffic', 'other'] as const;
export type NotifyType = typeof NOTIFY_TYPES[number];

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

export interface NotifySettings {
  types: NotifyType[];
  minRisk: RiskLevel;
}

/** Everything, as before settings existed. Users without a settings row get this. */
export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = { types: [...NOTIFY_TYPES], minRisk: 'low' };

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

/** Settings from a notification_settings row; anything missing or unknown falls back to the default. */
export function settingsFromRow(row?: { types?: string[] | null; min_risk?: string | null } | null): NotifySettings {
  const types = (row?.types ?? []).filter(isNotifyType);
  return {
    types: row?.types ? types : DEFAULT_NOTIFY_SETTINGS.types,
    minRisk: row?.min_risk && isRiskLevel(row.min_risk) ? row.min_risk : DEFAULT_NOTIFY_SETTINGS.minRisk,
  };
}

/** Whether an event of this type and risk passes the user's settings. */
export function wantsEvent(settings: NotifySettings, event: { type: string; risk: string | null }): boolean {
  const type = isNotifyType(event.type) ? event.type : 'other';
  if (!settings.types.includes(type)) return false;
  const risk = event.risk && isRiskLevel(event.risk) ? event.risk : 'low';
  return RISK_LEVELS.indexOf(risk) >= RISK_LEVELS.indexOf(settings.minRisk);
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
