// Monthly reports per kommun (/kommun/malmo/2026-09): Polisen's events in one month, summed from
// the counts per area, kind and day that kommun_month_counts returns.

import { incidentTypeConfig, type IncidentType } from '@/data/mockIncidents';
import { kommunMatcher } from '../../supabase/functions/_shared/notifications';

/** The archive keeps every event from September 2026, so the reports start there. */
export const REPORT_START = '2026-09';

export interface MonthRow {
  area: string | null;
  type: string | null;
  original_type: string | null;
  day: string;
  events: number;
}

export interface MonthReport {
  month: string;
  total: number;
  /** Days counted: the whole month, or the days so far in the current one */
  days: number;
  complete: boolean;
  perDay: { day: string; events: number }[];
  /** Polisen's own categories, most common first */
  byCategory: { name: string; count: number }[];
  busiestDay: { day: string; events: number } | null;
  /** "fredagar": the weekday with most events on average, if the month has had each one */
  busiestWeekday: string | null;
  /** Whether events Polisen gives only for the whole län ("Stockholms län") are counted */
  countyWide: boolean;
}

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const WEEKDAYS = ['söndagar', 'måndagar', 'tisdagar', 'onsdagar', 'torsdagar', 'fredagar', 'lördagar'];

export const isMonth = (value: string | undefined): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const parts = (month: string) => month.split('-').map(Number) as [number, number];

/** "2026-09" → "september 2026" */
export const monthLabel = (month: string) => {
  const [y, m] = parts(month);
  return `${MONTHS[m - 1]} ${y}`;
};

/** The month before (-1) or after (1). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = parts(month);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Today's date and month in Swedish time: "2026-10-06" and "2026-10". */
export function stockholmToday(now = Date.now()): { date: string; month: string } {
  const date = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  return { date, month: date.slice(0, 7) };
}

/** The months with a report, newest first: from the start of the archive up to the current one. */
export function reportMonths(now = Date.now()): string[] {
  const current = stockholmToday(now).month;
  const months: string[] = [];
  for (let m = current; m >= REPORT_START; m = shiftMonth(m, -1)) months.push(m);
  return months;
}

const daysIn = (month: string) => {
  const [y, m] = parts(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** A month in one kommun, from the counts for the areas that might lie in it. */
export function buildMonthReport(rows: MonthRow[], kommun: string, month: string, now = Date.now()): MonthReport {
  const matches = kommunMatcher(kommun);
  // Polisen's summaries ("Sammanfattning natt") are not events of their own
  const own = rows.filter((r) => matches(r.area) && !/sammanfattning/i.test(r.original_type ?? ''));
  const today = stockholmToday(now);
  const complete = month < today.month;
  const days = complete ? daysIn(month) : month === today.month ? Number(today.date.slice(8)) : 0;

  const perDayMap = new Map<string, number>();
  for (let d = 1; d <= days; d++) perDayMap.set(`${month}-${String(d).padStart(2, '0')}`, 0);
  const categories = new Map<string, number>();
  let total = 0;
  for (const r of own) {
    if (!perDayMap.has(r.day)) continue;
    total += r.events;
    perDayMap.set(r.day, (perDayMap.get(r.day) ?? 0) + r.events);
    const label = r.original_type?.trim() || incidentTypeConfig[(r.type ?? 'other') as IncidentType]?.label || 'Övrigt';
    categories.set(label, (categories.get(label) ?? 0) + r.events);
  }
  const perDay = [...perDayMap].map(([day, events]) => ({ day, events }));
  const busiestDay = total ? perDay.reduce((a, b) => (b.events > a.events ? b : a)) : null;

  let busiestWeekday: string | null = null;
  if (total && days >= 7) {
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    for (const { day, events } of perDay) { sums[weekdayOf(day)] += events; counts[weekdayOf(day)] += 1; }
    const averages = sums.map((s, i) => s / counts[i]);
    busiestWeekday = WEEKDAYS[averages.indexOf(Math.max(...averages))];
  }

  return {
    month,
    total,
    days,
    complete,
    perDay,
    byCategory: [...categories].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv')),
    busiestDay,
    busiestWeekday,
    countyWide: own.some((r) => r.events > 0 && /\blän\b/i.test(r.area ?? '')),
  };
}

const events = (n: number) => `${n.toLocaleString('sv-SE')} ${n === 1 ? 'händelse' : 'händelser'}`;
/** Events per day, with a decimal only below 10: "0,3", "34". */
export const averagePerDay = (r: MonthReport) => {
  const avg = r.days ? r.total / r.days : 0;
  return avg.toLocaleString('sv-SE', { maximumFractionDigits: avg < 10 ? 1 : 0 });
};
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`);

/** The month in a few sentences, for the top of the page and its description. */
export function monthSummary(kommun: string, report: MonthReport, previous: MonthReport | null = null): string {
  const label = monthLabel(report.month);
  if (!report.total) {
    return report.complete
      ? `Polisen rapporterade inga händelser i ${kommun} i ${label}.`
      : `Polisen har inte rapporterat några händelser i ${kommun} hittills i ${label}.`;
  }
  let text = report.complete
    ? `I ${label} rapporterade Polisen ${events(report.total)} i ${kommun}, i snitt ${averagePerDay(report)} per dag.`
    : `Hittills i ${label} har Polisen rapporterat ${events(report.total)} i ${kommun}, i snitt ${averagePerDay(report)} per dag.`;
  const top = report.byCategory.slice(0, 3).map((c) => `${c.name.toLocaleLowerCase('sv-SE')} (${c.count})`);
  if (top.length) text += ` Vanligast var ${list(top)}.`;
  if (report.complete && report.busiestWeekday) text += ` Flest händelser per dag kom på ${report.busiestWeekday}.`;
  if (report.complete && previous?.complete && previous.total > 0) {
    const change = Math.round(((report.total - previous.total) / previous.total) * 100);
    const prevLabel = MONTHS[parts(previous.month)[1] - 1];
    text += Math.abs(change) < 3
      ? ` Det är ungefär lika många som i ${prevLabel}.`
      : ` Det är ${Math.abs(change)} % ${change > 0 ? 'fler' : 'färre'} än i ${prevLabel}.`;
  }
  return text;
}
