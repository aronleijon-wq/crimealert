// "Pågår nu": when several people report from the same place within a short time, it is something
// happening right now, before Polisen has written anything. The same rule decides it in the app
// (the live card on the map and in the feed) and on the server (the notification to those
// nearby, send-push-notifications mode "report").
import { REPORT_CATEGORY_LABELS } from './reportCategories.ts';

/** Reports this recent count; an hour without a new one ends it */
export const LIVE_WINDOW_MS = 60 * 60 * 1000;
/** Reports this close to the middle of the others are the same place */
export const LIVE_RADIUS_KM = 0.5;
/** Different people needed before it is "Pågår nu" */
export const LIVE_MIN_PEOPLE = 2;

export interface LiveReport {
  id: string;
  category: string | null;
  area: string | null;
  lat: number;
  lng: number;
  /** Milliseconds */
  at: number;
  /** Who reported: the same value for the same person (never shown) */
  reporter: string | number;
  eventId?: string | null;
}

export interface LiveHappening {
  /** The first report's id: the same while the happening grows */
  id: string;
  lat: number;
  lng: number;
  /** "Fisksätra" */
  place: string;
  /** What most say they see, "Rök eller brand" */
  label: string;
  category: string;
  people: number;
  reports: LiveReport[];
  startedAt: number;
  lastAt: number;
  /** The police event someone tied it to, if any */
  eventId: string | null;
}

const RAD = Math.PI / 180;
export function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * RAD;
  const dLng = (bLng - aLng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const mostCommon = (values: string[]): string | null => {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export const categoryLabel = (category: string | null) =>
  (category && (REPORT_CATEGORY_LABELS as Record<string, string>)[category]) || 'Något händer';

/** The most exact part of a report's place: "Fisksätra" from "Fisksätra, Nacka" */
export const placeOf = (area: string | null) => (area ?? '').split(',').map((p) => p.trim()).filter(Boolean)[0] ?? '';

/**
 * The happenings going on now, newest first: reports of the last hour, grouped by place (each
 * joins the group whose middle is within 500 m), kept when at least two different people stand
 * behind them.
 */
export function findLiveHappenings(reports: LiveReport[], now: number, minPeople = LIVE_MIN_PEOPLE): LiveHappening[] {
  const recent = reports
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && (r.lat !== 0 || r.lng !== 0) && now - r.at <= LIVE_WINDOW_MS && r.at <= now + 60_000)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const groups: { lat: number; lng: number; reports: LiveReport[] }[] = [];
  for (const r of recent) {
    const near = groups
      .map((g) => ({ g, d: km(g.lat, g.lng, r.lat, r.lng) }))
      .filter(({ d }) => d <= LIVE_RADIUS_KM)
      .sort((a, b) => a.d - b.d)[0]?.g;
    if (!near) { groups.push({ lat: r.lat, lng: r.lng, reports: [r] }); continue; }
    near.reports.push(r);
    near.lat = near.reports.reduce((s, x) => s + x.lat, 0) / near.reports.length;
    near.lng = near.reports.reduce((s, x) => s + x.lng, 0) / near.reports.length;
  }
  return groups
    .map((g) => {
      const people = new Set(g.reports.map((r) => String(r.reporter))).size;
      const category = mostCommon(g.reports.map((r) => r.category ?? 'other').filter((c) => c !== 'other')) ?? 'other';
      return {
        id: g.reports[0].id,
        lat: g.lat,
        lng: g.lng,
        place: mostCommon(g.reports.map((r) => placeOf(r.area))) ?? '',
        label: categoryLabel(category),
        category,
        people,
        reports: g.reports,
        startedAt: g.reports[0].at,
        lastAt: g.reports[g.reports.length - 1].at,
        eventId: g.reports.map((r) => r.eventId).find(Boolean) ?? null,
      };
    })
    .filter((h) => h.people >= minPeople)
    .sort((a, b) => b.lastAt - a.lastAt);
}

/** The happening a report belongs to, if it is one */
export const happeningOf = (happenings: LiveHappening[], reportId: string) =>
  happenings.find((h) => h.reports.some((r) => r.id === reportId)) ?? null;

export function liveMessage(h: Pick<LiveHappening, 'place' | 'people' | 'label'>) {
  return {
    title: `🔴 Pågår nu${h.place ? ` i ${h.place}` : ' nära dig'}`,
    body: `${h.people} personer på plats · ${h.label}. Se vad de ser.`,
  };
}

/** The key in sent_push_log: each person hears of a happening once */
export const liveLogKey = (id: string) => `live:${id}`;
