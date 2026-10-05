// The map's timeline (Pro): Polisen's events over the last day, week, month or two months, as a
// whole or a moving window that can be played through.

import type { Incident } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type HistoryRange = '24h' | '7d' | '30d' | '60d';

/** How far back, how wide the moving window is, and how far one step moves it. */
export const HISTORY_RANGES: Record<HistoryRange, { label: string; span: number; window: number; step: number }> = {
  '24h': { label: '24 tim', span: DAY, window: 2 * HOUR, step: 15 * MINUTE },
  '7d': { label: '7 dagar', span: 7 * DAY, window: 12 * HOUR, step: HOUR },
  '30d': { label: '30 dagar', span: 30 * DAY, window: 2 * DAY, step: 6 * HOUR },
  '60d': { label: '60 dagar', span: 60 * DAY, window: 4 * DAY, step: 12 * HOUR },
};

/** Days of archive a range reads; 0 for the ranges the events already loaded cover. */
export const archiveDaysFor = (range: HistoryRange): number => (range === '60d' ? 60 : range === '30d' ? 30 : 0);

const isPolice = (i: Incident) => i.type !== 'trafikverket' && i.type !== 'crisis' && i.source !== 'Medborgarrapport';

/**
 * Polisen's events in the range, or in the window ending at `end` when one is chosen.
 * Traffic disruptions, crisis messages and citizen reports are about now, so they are left out.
 */
export function historyEvents(incidents: Incident[], range: HistoryRange, end: number | null, now: number): Incident[] {
  const { span, window } = HISTORY_RANGES[range];
  const from = end === null ? now - span : Math.max(now - span, end - window);
  const to = end === null ? now : end;
  return incidents.filter((i) => {
    if (!isPolice(i)) return false;
    const t = parseIncidentTime(i.time)?.getTime();
    return t !== undefined && t >= from && t <= to;
  });
}

/** The window's first end: one window into the range. */
export const firstEnd = (range: HistoryRange, now: number) => now - HISTORY_RANGES[range].span + HISTORY_RANGES[range].window;

const fmt = (ms: number, withDay: boolean) =>
  new Date(ms)
    .toLocaleString('sv-SE', {
      ...(withDay ? { weekday: 'short', day: 'numeric', month: 'short' } : {}),
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm',
    })
    .replace(/\.(?=\s)/g, ''); // "okt." → "okt"

/** "tis 30 sep 14:00 – 16:00", or "Senaste 7 dagarna" for the whole range. */
export function historyLabel(range: HistoryRange, end: number | null): string {
  if (end === null) return range === '24h' ? 'Senaste dygnet' : `Senaste ${HISTORY_RANGES[range].label}`;
  const start = end - HISTORY_RANGES[range].window;
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  return `${fmt(start, true)} – ${fmt(end, !sameDay)}`;
}
