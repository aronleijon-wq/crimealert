// What the plans give and cost, in one place for everything that tells it: the website and the app
// (components/account/plans), the server (premium, police-events, ask-crimealert) and the e-mails
// (lifecycleEmails). Change a price, a limit or what Pro gives here and they all follow.
// No imports, so both the website and the edge functions can use it.

/** Must match the active prices in Stripe (create-checkout charges whatever is active there) */
export const MONTHLY_KR = 19;
export const YEARLY_KR = 199;

/** Free accounts see Polisen's events, on the map and as notifications, this many minutes late */
export const FREE_DELAY_MINUTES = 15;

/** Fråga AI: questions a day without Pro; with Pro "obegränsat", but not without end */
export const FREE_QUESTIONS_PER_DAY = 3;
export const PRO_QUESTIONS_PER_DAY = 100;
/** Pro's first questions each day get the larger model (Sonnet); Premium (coming) is to get 5 */
export const PRO_BETTER_PER_DAY = 3;

/** Days of Pro a first-time subscriber gets before the first payment, usually */
export const NORMAL_TRIAL_DAYS = 7;
/** During Black Week, through 30 November 2026 (Swedish time), a month instead */
export const BLACK_WEEK_TRIAL_DAYS = 30;
export const BLACK_WEEK_ENDS = Date.parse('2026-12-01T00:00:00+01:00');
export const isBlackWeek = (now = Date.now()) => now < BLACK_WEEK_ENDS;
/** Days of Pro a first-time subscriber gets before the first payment, at `now` */
export const trialDays = (now = Date.now()) => (isBlackWeek(now) ? BLACK_WEEK_TRIAL_DAYS : NORMAL_TRIAL_DAYS);

export type ProFeatureKey = 'live' | 'push' | 'description' | 'details' | 'analysis' | 'export' | 'ask' | 'noAds';

/** What Pro adds, as the code gates it (police-events, send-push-notifications, IncidentDetail, Analysis, ExportData, ask-crimealert) */
export const PRO_FEATURE_TEXTS: { key: ProFeatureKey; text: string; short: string }[] = [
  { key: 'live', text: `Polisens händelser direkt, utan ${FREE_DELAY_MINUTES} minuters fördröjning`, short: `Händelser direkt, utan ${FREE_DELAY_MINUTES} min väntan` },
  { key: 'push', text: 'Notiser direkt när något händer i dina kommuner', short: 'Notiser direkt i dina kommuner' },
  { key: 'description', text: 'Hela beskrivningen av varje händelse', short: 'Hela beskrivningen av varje händelse' },
  { key: 'details', text: 'Risknivå, status, Polisens kategori och platsens precision', short: 'Risknivå, status och kategori' },
  { key: 'analysis', text: 'Analys och statistik per kommun, upp till 60 dagar bakåt', short: 'Analys och statistik, 60 dagar bakåt' },
  { key: 'export', text: 'Export till PDF och CSV', short: 'Export till PDF och CSV' },
  { key: 'ask', text: `Fråga AI utan gräns, med utförligare svar (${FREE_QUESTIONS_PER_DAY} frågor per dag utan Pro)`, short: 'Fråga AI utan gräns' },
];
/** When the free plan shows ads, Pro also promises none */
export const NO_ADS_FEATURE = { key: 'noAds' as const, text: 'Ingen reklam', short: 'Ingen reklam' };
