// Which police events police-events needs to write to police_events_archive. Each fetch
// returns Polisen's latest ~500 events; almost all are already archived and unchanged, and
// rewriting them every five minutes only churns the database (dead rows, WAL, storage).

export interface ArchivableIncident {
  id: string;
  type: string;
  title: string;
  description: string;
  lat: number | null;
  lng: number | null;
  area: string;
  time: string;
  status: string;
  risk: string;
  source: string;
  originalType?: string | null;
  original_type?: string | null;
  url?: string | null;
  location_precision: string;
}

const isSummary = (i: ArchivableIncident) =>
  /sammanfattning/i.test(`${i.originalType ?? i.original_type ?? ''} ${i.title ?? ''}`);

/**
 * Polisen's API only has a teaser for night and evening summaries; the full text is scraped
 * from polisen.se and stored in the archive. Fresh summaries take that stored text, so it isn't
 * overwritten by the teaser and scraped again on every fetch.
 */
export function keepBackfilledSummaries<T extends ArchivableIncident>(fresh: T[], archived: ArchivableIncident[]): T[] {
  const stored = new Map(archived.map((a) => [a.id, a]));
  return fresh.map((incident) => {
    const previous = stored.get(incident.id);
    if (!previous || !isSummary(incident)) return incident;
    const kept = previous.description ?? '';
    return kept.length > (incident.description ?? '').length ? { ...incident, description: kept } : incident;
  });
}

const sameText = (a: string | null | undefined, b: string | null | undefined) => (a ?? '') === (b ?? '');
const sameNumber = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? a == b : Math.abs(a - b) < 1e-9;
// "2026-10-02 14:05:00 +02:00" from Polisen and "2026-10-02T12:05:00+00:00" from the database
const sameTime = (a: string, b: string) => {
  const ta = Date.parse(a.replace(' ', 'T').replace(/\s+([+-]\d{2}:\d{2})$/, '$1'));
  const tb = Date.parse(b.replace(' ', 'T').replace(/\s+([+-]\d{2}:\d{2})$/, '$1'));
  return Number.isNaN(ta) || Number.isNaN(tb) ? a === b : ta === tb;
};

/** Whether the archived row already holds everything the fresh event says. */
export function unchanged(fresh: ArchivableIncident, archived: ArchivableIncident): boolean {
  return (
    sameText(fresh.type, archived.type) &&
    sameText(fresh.title, archived.title) &&
    sameText(fresh.description, archived.description) &&
    sameNumber(fresh.lat, archived.lat) &&
    sameNumber(fresh.lng, archived.lng) &&
    sameText(fresh.area, archived.area) &&
    sameTime(fresh.time, archived.time) &&
    sameText(fresh.status, archived.status) &&
    sameText(fresh.risk, archived.risk) &&
    sameText(fresh.source || 'Polisen.se', archived.source) &&
    sameText(fresh.originalType ?? fresh.original_type, archived.originalType ?? archived.original_type) &&
    sameText(fresh.url, archived.url) &&
    sameText(fresh.location_precision || 'area', archived.location_precision)
  );
}

/** New events to insert and archived ones whose content changed; the rest are left alone. */
export function planArchiveWrites<T extends ArchivableIncident>(fresh: T[], archived: ArchivableIncident[]) {
  const stored = new Map(archived.map((a) => [a.id, a]));
  const inserts: T[] = [];
  const updates: T[] = [];
  for (const incident of fresh) {
    const previous = stored.get(incident.id);
    if (!previous) inserts.push(incident);
    else if (!unchanged(incident, previous)) updates.push(incident);
  }
  return { inserts, updates };
}

const HOUR = 60 * 60 * 1000;

/**
 * Whether to fetch an event's page on polisen.se for its full, updated text. Events from the
 * last 6 hours, where updates come, every time as before; older ones every 30 minutes (up to a
 * day old) or every 2 hours (up to 3 days), using the text already archived in between.
 */
export function needsDetailScrape(
  incident: Pick<ArchivableIncident, 'url' | 'time' | 'description'>,
  archivedDescription: string | undefined,
  lastScrapedAt: number | undefined,
  now: number,
): boolean {
  if (!incident.url) return false;
  const at = Date.parse(incident.time.replace(' ', 'T').replace(/\s+([+-]\d{2}:\d{2})$/, '$1'));
  if (Number.isNaN(at)) return false;
  const age = now - at;
  if (age > 72 * HOUR) return false;
  if (age < 6 * HOUR) return true;
  const interval = age < 24 * HOUR ? HOUR / 2 : 2 * HOUR;
  if (lastScrapedAt !== undefined) return now - lastScrapedAt >= interval;
  // Not fetched by this instance yet: the archive already has the full text if it is longer
  return !(archivedDescription && archivedDescription.length > (incident.description ?? '').length);
}
