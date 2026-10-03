// The Sunday evening notification with the week's events in each user's kommuner.
// send-push-notifications sends it (mode "weekly"); the Notiser page lets users turn it off.

import { kommunSlug } from './kommunSlug.ts';
import { kommunMatcher, type PushMessage } from './notifications.ts';

const DAY = 24 * 60 * 60 * 1000;

const stockholm = (ms: number) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), weekday: get('weekday') };
};

/** The ISO week in Sweden, "2026-W40": each user gets one summary per week. */
export function weekKey(ms: number): string {
  const { year, month, day } = stockholm(ms);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // the Thursday decides the year
  const week = Math.ceil(((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Sunday 18–21 in Sweden, summer or winter time. The schedule runs hourly on Sundays. */
export function inSummaryWindow(ms: number): boolean {
  const { weekday, hour } = stockholm(ms);
  return weekday === 'Sun' && hour >= 18 && hour < 21;
}

export interface SummaryEvent {
  area: string | null;
  original_type: string | null;
  time: string;
}

export interface KommunWeek {
  kommun: string;
  thisWeek: number;
  lastWeek: number;
  top: { name: string; count: number } | null;
}

const isSummary = (e: SummaryEvent) => /sammanfattning/i.test(e.original_type ?? '');

/** The last 7 days in a kommun, against the 7 before. Polisen's summaries are not counted. */
export function summarizeKommun(events: SummaryEvent[], kommun: string, now: number): KommunWeek {
  const matches = kommunMatcher(kommun);
  let thisWeek = 0;
  let lastWeek = 0;
  const categories = new Map<string, number>();
  for (const event of events) {
    if (isSummary(event) || !matches(event.area)) continue;
    const age = now - Date.parse(event.time);
    if (Number.isNaN(age) || age < 0) continue;
    if (age <= 7 * DAY) {
      thisWeek++;
      const category = event.original_type?.trim();
      if (category) categories.set(category, (categories.get(category) ?? 0) + 1);
    } else if (age <= 14 * DAY) {
      lastWeek++;
    }
  }
  const [top] = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'));
  return { kommun, thisWeek, lastWeek, top: top ? { name: top[0], count: top[1] } : null };
}

const events = (n: number) => `${n} ${n === 1 ? 'händelse' : 'händelser'}`;

const comparison = ({ thisWeek, lastWeek }: KommunWeek) =>
  thisWeek === lastWeek ? 'lika många som veckan innan' : `${thisWeek > lastWeek ? 'fler' : 'färre'} än veckan innan (${lastWeek})`;

/** The notification: one kommun links to its page, several to Notiser. */
export function buildWeeklyMessage(weeks: KommunWeek[]): PushMessage {
  if (weeks.length === 1) {
    const [week] = weeks;
    const body = week.thisWeek === 0
      ? `Polisen rapporterade inget i ${week.kommun} den senaste veckan.`
      : `${events(week.thisWeek)} från Polisen senaste veckan, ${comparison(week)}.${week.top ? ` Vanligast: ${week.top.name} (${week.top.count}).` : ''}`;
    return { title: `Veckan i ${week.kommun}`, body, url: `/kommun/${kommunSlug(week.kommun)}`, tag: 'crimealert-weekly', incidentId: null };
  }
  const sorted = [...weeks].sort((a, b) => b.thisWeek - a.thisWeek || a.kommun.localeCompare(b.kommun, 'sv'));
  const lines = sorted.slice(0, 4).map((w) => `${w.kommun}: ${events(w.thisWeek)} (veckan innan ${w.lastWeek})`);
  if (sorted.length > 4) lines.push(`och ${sorted.length - 4} områden till`);
  return { title: 'Veckan i dina områden', body: lines.join('\n'), url: '/alerts', tag: 'crimealert-weekly', incidentId: null };
}
