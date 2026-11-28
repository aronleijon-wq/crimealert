// The numbers the admin dashboard's command centre shows, worked out from admin-dashboard's
// "pulse": the way from a visit to paying, week against week, and how many come back.

export interface Pulse {
  last24: { visits: number; signups: number; reports: number | null; push: number | null; ask: number | null; events: number | null };
  reports7: number | null;
  activity: { dau: number; wau: number; mau: number; d7: { cohort: number; back: number }; d30: { cohort: number; back: number } } | null;
  growth: { thisWeek: number; weekBefore: number };
  funnel30: { visits: number; signups: number; proStarts: number; paying: number };
  sources: { source: string; visits: number }[];
}

/** Part of the whole in per cent, one decimal; null when there is no whole */
export const share = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

/** This week against the week before, in per cent; null when the week before had none */
export const change = (now: number, before: number): number | null =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

export interface FunnelStep {
  label: string;
  value: number;
  /** Of the step before */
  fromPrevious: number | null;
  /** Bar width against the first step, 0–100 (at least 2 when there is anyone) */
  width: number;
}

export function funnelSteps(f: Pulse['funnel30']): FunnelStep[] {
  const steps: [string, number][] = [
    ['Besök', f.visits],
    ['Nya konton', f.signups],
    ['Startade Pro', f.proStarts],
    ['Betalar nu', f.paying],
  ];
  const top = Math.max(1, ...steps.map(([, v]) => v));
  return steps.map(([label, value], i) => ({
    label,
    value,
    fromPrevious: i === 0 ? null : share(value, steps[i - 1][1]),
    width: value > 0 ? Math.max(2, Math.round((value / top) * 100)) : 0,
  }));
}

/** How often the month's users come: DAU of MAU ("stickiness") */
export const stickiness = (a: NonNullable<Pulse['activity']>) => share(a.dau, a.mau);

const SOURCE_NAMES: Record<string, string> = {
  direct: 'Direkt', direkt: 'Direkt', meta: 'Meta (FB/IG)', chatgpt: 'ChatGPT', google: 'Google', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
  app: 'Appen', apple: 'Apple', bing: 'Bing', youtube: 'YouTube', reddit: 'Reddit', x: 'X', linkedin: 'LinkedIn',
};
export const sourceName = (s: string) => SOURCE_NAMES[s.toLowerCase()] ?? s;
