// What a medborgarrapport can be about: shared by submit-community-report (which accepts only
// these) and the website and app (lib/communityReports). The first five are what people see
// happen right now ("Vad är det för helikopter?"), the rest what they notice in their area.

export const REPORT_CATEGORY_LABELS = {
  police_here: 'Polisinsats',
  sirens: 'Blåljus och sirener',
  smoke_fire: 'Rök eller brand',
  bangs: 'Smällar',
  cordon: 'Avspärrning',
  suspicious_activity: 'Misstänkt aktivitet',
  unsafe_area: 'Otrygg plats',
  vandalism: 'Skadegörelse',
  broken_lighting: 'Trasig belysning',
  other: 'Annat',
} as const;

export type ReportCategoryValue = keyof typeof REPORT_CATEGORY_LABELS;

export const REPORT_CATEGORY_VALUES = Object.keys(REPORT_CATEGORY_LABELS) as ReportCategoryValue[];

export const isReportCategory = (value: string): value is ReportCategoryValue =>
  Object.prototype.hasOwnProperty.call(REPORT_CATEGORY_LABELS, value);

/** A police event's id as the app has it ("pol-123456"), or null for anything else */
export function eventIdOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^[A-Za-z0-9:._-]{1,100}$/.test(value) ? value : null;
}

/** How many reports one account may send in a day: enough for anyone on the spot, not for spam */
export const REPORTS_PER_DAY = 10;
