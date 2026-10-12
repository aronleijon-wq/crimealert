// National crime figures for /statistik, from Polisen and Brå (not from CrimeAlert's own archive).
// Update when Polisen publishes its year (January) and Brå its final statistics (end of March).

export interface Source {
  label: string;
  url: string;
}

export interface YearValue {
  year: number;
  value: number;
}

export interface Trend {
  id: string;
  title: string;
  /** "skjutningar": for the chart's description and the tooltip */
  unit: string;
  /** Oldest year first */
  values: YearValue[];
  /** More rows for the table, such as the dead and injured in shootings */
  details?: { label: string; values: YearValue[] }[];
  text: string[];
  /** The latest half year compared with the same half a year earlier */
  halfYear?: { label: string; value: number; before: number; beforeLabel: string };
  sources: Source[];
}

const POLISEN_STATISTIK: Source = {
  label: 'Polisen: Statistik och lägesbild över skjutningar och sprängningar',
  url: 'https://polisen.se/om-polisen/polisens-arbete/sprangningar-och-skjutningar/',
};
const POLISEN_2025: Source = {
  label: 'Polisen: Minskat antal skjutningar men fler sprängningar under 2025 (januari 2026)',
  url: 'https://polisen.se/aktuellt/nyheter/nationell/2026/januari/minskat-antal-skjutningar-men-fler-sprangningar-under-2025/',
};
const POLISEN_H1_2026: Source = {
  label: 'Polisen: Skjutningarna på historiskt låga nivåer (juli 2026)',
  url: 'https://polisen.se/aktuellt/nyheter/nationell/2026/juli/skjutningarna-pa-historiskt-laga-nivaer/',
};
export const BRA_2025: Source = {
  label: 'Brå: Anmälda brott 2025, slutlig statistik (mars 2026)',
  url: 'https://bra.se/rapporter/arkiv/2026-03-31-anmalda-brott-2025',
};

export const SHOOTINGS: Trend = {
  id: 'skjutningar',
  title: 'Skjutningar',
  unit: 'skjutningar',
  values: [
    { year: 2023, value: 368 },
    { year: 2024, value: 270 },
    { year: 2025, value: 158 },
  ],
  details: [
    { label: 'Döda', values: [{ year: 2023, value: 54 }, { year: 2024, value: 44 }, { year: 2025, value: 46 }] },
    { label: 'Skadade', values: [{ year: 2023, value: 108 }, { year: 2024, value: 57 }, { year: 2025, value: 44 }] },
  ],
  text: [
    'Skjutningarna har mer än halverats på tre år. Toppåret var 2022, med 391 skjutningar och 62 döda.',
    'Antalet döda har inte minskat i samma takt. I siffran för 2025 ingår, enligt Polisen, skjutningen på Campus Risbergska i Örebro i februari.',
  ],
  halfYear: { label: 'Första halvåret 2026', value: 39, before: 86, beforeLabel: 'första halvåret 2025' },
  sources: [POLISEN_STATISTIK, POLISEN_2025, POLISEN_H1_2026],
};

export const EXPLOSIONS: Trend = {
  id: 'sprangningar',
  title: 'Sprängningar',
  unit: 'sprängningar',
  values: [
    { year: 2023, value: 149 },
    { year: 2024, value: 136 },
    { year: 2025, value: 189 },
  ],
  text: [
    'Sprängningarna ökade kraftigt under 2025. Enligt Polisen finns ingen enskild förklaring, men god tillgång till handgranater och rekrytering av unga som utför dåden pekas ut. Under årets tre sista månader var nivåerna klart lägre.',
  ],
  halfYear: { label: 'Första halvåret 2026', value: 68, before: 108, beforeLabel: 'första halvåret 2025' },
  sources: [POLISEN_STATISTIK, POLISEN_2025, POLISEN_H1_2026],
};

export interface ReportedCrime {
  label: string;
  /** 2024 and 2025, as in Brå's final statistics for 2025 */
  before: number;
  after: number;
}

/** Reported crimes in 2025 compared with 2024 (Brå, final statistics). */
export const REPORTED: ReportedCrime[] = [
  { label: 'Bostadsinbrott', before: 10_427, after: 8_820 },
  { label: 'Inbrottsstöld totalt', before: 63_290, after: 51_896 },
  { label: 'Stöld- och tillgreppsbrott', before: 348_551, after: 305_219 },
  { label: 'Misshandel', before: 89_317, after: 92_535 },
  { label: 'Bedrägeri', before: 230_330, after: 232_862 },
];
export const REPORTED_YEARS = { before: 2024, after: 2025 };

/** Change in percent, rounded: -57, +39 */
export const percentChange = (from: number, to: number) => Math.round(((to - from) / from) * 100);

/** "−57 %", "+4 %", "±0 %" with a real minus sign */
export const formatChange = (percent: number) =>
  percent === 0 ? '±0 %' : `${percent > 0 ? '+' : '−'}${Math.abs(percent)} %`;

export const formatNumber = (n: number) => n.toLocaleString('sv-SE');

export const first = (t: Trend) => t.values[0];
export const last = (t: Trend) => t.values[t.values.length - 1];
export const previous = (t: Trend) => t.values[t.values.length - 2];

/** The three numbers most people ask about, newest year against an earlier one. */
export const headlineTiles = () => [
  { label: `Skjutningar ${last(SHOOTINGS).year}`, value: last(SHOOTINGS).value, change: percentChange(first(SHOOTINGS).value, last(SHOOTINGS).value), since: `sedan ${first(SHOOTINGS).year}` },
  { label: `Sprängningar ${last(EXPLOSIONS).year}`, value: last(EXPLOSIONS).value, change: percentChange(previous(EXPLOSIONS).value, last(EXPLOSIONS).value), since: `jämfört med ${previous(EXPLOSIONS).year}` },
  { label: `Bostadsinbrott ${REPORTED_YEARS.after}`, value: REPORTED[0].after, change: percentChange(REPORTED[0].before, REPORTED[0].after), since: `jämfört med ${REPORTED_YEARS.before}` },
];
