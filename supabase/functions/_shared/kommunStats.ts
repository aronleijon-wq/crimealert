// Statistics per kommun (data/kommunStats.ts) worked out for questions: Brå's reported crimes and
// the rescue service's call-outs (MCF). For a kommun, each kind's latest level against the
// country and the year before, and its place among the 290 kommuner; for a kind, every kommun
// ranked. The country's level is weighted by population, from the kommuner's own rates.
import { STAT_RATES, STAT_TYPES, type StatType } from './data/kommunStats.ts';
import { KOMMUN_POPULATION, POPULATION_YEAR } from './data/population.ts';

export const STAT_TYPE_IDS = STAT_TYPES.map((t) => t.id);

const round1 = (n: number) => Math.round(n * 10) / 10;
const yearsOf = (id: string) => Object.keys(STAT_RATES[id] ?? {}).map(Number).sort((a, b) => a - b);
/** The newest year with figures for a kind, and the one before it (null when there is none) */
export const latestYear = (id: string) => yearsOf(id).at(-1)!;
const previousYear = (id: string) => yearsOf(id).at(-2) ?? null;

/** The country's rate per 100 000 for a kind and year, weighted by each kommun's population */
export function swedenRate(type: string, year: number): number | null {
  const rates = STAT_RATES[type]?.[year];
  if (!rates) return null;
  let count = 0;
  let people = 0;
  for (const [kommun, rate] of Object.entries(rates)) {
    const pop = KOMMUN_POPULATION[kommun];
    if (!pop) continue;
    count += (rate * pop) / 100_000;
    people += pop;
  }
  return people ? round1((count / people) * 100_000) : null;
}

/** Where a kommun is among all kommuner for a kind: 1 is the highest rate */
function rankOf(type: string, year: number, kommun: string): { plats: number; av: number } | null {
  const rates = STAT_RATES[type]?.[year];
  if (!rates || rates[kommun] === undefined) return null;
  return { plats: Object.values(rates).filter((r) => r > rates[kommun]).length + 1, av: Object.keys(rates).length };
}

function kommunFigures(t: StatType, kommun: string, invanare: number | null) {
  const year = latestYear(t.id);
  const rate = STAT_RATES[t.id]?.[year]?.[kommun];
  if (rate === undefined) return null;
  const prev = previousYear(t.id);
  const before = prev ? STAT_RATES[t.id]?.[prev]?.[kommun] : undefined;
  const sweden = swedenRate(t.id, year);
  return {
    sort: t.label,
    ar: year,
    per_100_000: rate,
    ungefar_antal_per_ar: invanare ? Math.round((rate * invanare) / 100_000) : null,
    ...(prev ? { jamfort_med_ar: prev, da_per_100_000: before ?? null, andring_procent: before ? Math.round(((rate - before) / before) * 100) : null } : {}),
    sverige_per_100_000: sweden,
    ganger_riket: sweden ? Math.round((rate / sweden) * 100) / 100 : null,
    plats_av_kommunerna: rankOf(t.id, year, kommun),
    ...(t.note ? { obs: t.note } : {}),
  };
}

/** A kommun's figures for every kind: reported crimes (Brå) and the rescue service's call-outs (MCF) */
export function kommunStats(kommun: string) {
  const invanare = KOMMUN_POPULATION[kommun] ?? null;
  const of = (source: string) => STAT_TYPES.filter((t) => t.source === source).map((t) => kommunFigures(t, kommun, invanare)).filter((x) => x !== null);
  const sources = [...new Set(STAT_TYPES.map((t) => t.source))];
  return {
    kommun,
    invanare,
    kallor: Object.fromEntries(sources.map((source) => [source, of(source)])),
    obs: `Per 100 000 invånare (invånare enligt SCB ${POPULATION_YEAR}); plats 1 är högst i landet. Brå räknar alla anmälda brott under året där brottet skedde; anmälningar utan brottsplats saknas, och små kommuner varierar mer mellan åren. Räddningstjänstens tal är snitt över flera år.`,
  };
}

/** Every kommun ranked by its rate for one kind, the highest or the lowest first */
export function statsRanking(input: { sort?: unknown; ordning?: unknown; min_invanare?: unknown }) {
  const type = STAT_TYPE_IDS.includes(String(input.sort)) ? String(input.sort) : 'brott_totalt';
  const meta = STAT_TYPES.find((t) => t.id === type)!;
  const year = latestYear(type);
  const fewest = input.ordning === 'lagst';
  const minPop = Math.max(0, Math.round(Number(input.min_invanare) || 0));
  const rows = Object.entries(STAT_RATES[type][year])
    .filter(([kommun]) => (KOMMUN_POPULATION[kommun] ?? 0) >= minPop)
    .map(([kommun, rate]) => ({ kommun, per_100_000: rate, invanare: KOMMUN_POPULATION[kommun] ?? null }))
    .sort((a, b) => (fewest ? a.per_100_000 - b.per_100_000 : b.per_100_000 - a.per_100_000) || a.kommun.localeCompare(b.kommun, 'sv'));
  return {
    sort: meta.label,
    kalla: meta.source,
    ar: year,
    ordning: fewest ? 'lägst först' : 'högst först',
    ...(minPop ? { bara_kommuner_med_minst_invanare: minPop } : {}),
    sverige_per_100_000: swedenRate(type, year),
    kommuner_i_urvalet: rows.length,
    kommuner: rows.slice(0, 10),
    obs: [meta.note, 'Per 100 000 invånare. Små kommuner kan få höga eller låga tal av ett fåtal fall; välj en minsta storlek för jämförbara svar.'].filter(Boolean).join(' '),
  };
}
