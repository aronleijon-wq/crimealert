// Brå's reported crimes per kommun (data/braRates.ts), worked out for questions: a kommun's level
// for each kind of crime against the country and the year before, and every kommun ranked for one
// kind. The country's level is weighted by population, from the kommuner's own rates.
import { BRA_RATES, BRA_SOURCE, BRA_TYPES, BRA_YEARS } from './data/braRates.ts';
import { KOMMUN_POPULATION, POPULATION_YEAR } from './data/population.ts';

export const BRA_TYPE_IDS = BRA_TYPES.map((t) => t.id);
export const BRA_LATEST = BRA_YEARS[BRA_YEARS.length - 1];
const BRA_PREVIOUS = BRA_YEARS.length > 1 ? BRA_YEARS[BRA_YEARS.length - 2] : null;

const round1 = (n: number) => Math.round(n * 10) / 10;
const labelOf = (id: string) => BRA_TYPES.find((t) => t.id === id)?.label ?? id;

/** The country's rate per 100 000 for a kind and year, weighted by each kommun's population */
export function swedenRate(type: string, year: number): number | null {
  const rates = BRA_RATES[type]?.[year];
  if (!rates) return null;
  let crimes = 0;
  let people = 0;
  for (const [kommun, rate] of Object.entries(rates)) {
    const pop = KOMMUN_POPULATION[kommun];
    if (!pop) continue;
    crimes += (rate * pop) / 100_000;
    people += pop;
  }
  return people ? round1((crimes / people) * 100_000) : null;
}

/** Where a kommun is among all kommuner for a kind: 1 is the highest rate */
function rankOf(type: string, year: number, kommun: string): { plats: number; av: number } | null {
  const rates = BRA_RATES[type]?.[year];
  if (!rates || rates[kommun] === undefined) return null;
  const higher = Object.values(rates).filter((r) => r > rates[kommun]).length;
  return { plats: higher + 1, av: Object.keys(rates).length };
}

/** A kommun's reported crimes for every kind: the latest year, the year before, the country, and its place */
export function braKommun(kommun: string) {
  const invanare = KOMMUN_POPULATION[kommun] ?? null;
  const sorter = BRA_TYPES.map((t) => {
    const rate = BRA_RATES[t.id]?.[BRA_LATEST]?.[kommun];
    if (rate === undefined) return null;
    const before = BRA_PREVIOUS ? BRA_RATES[t.id]?.[BRA_PREVIOUS]?.[kommun] : undefined;
    const sweden = swedenRate(t.id, BRA_LATEST);
    return {
      sort: t.label,
      per_100_000: rate,
      ungefar_antal: invanare ? Math.round((rate * invanare) / 100_000) : null,
      aret_innan_per_100_000: before ?? null,
      andring_procent: before ? Math.round(((rate - before) / before) * 100) : null,
      sverige_per_100_000: sweden,
      ganger_riket: sweden ? Math.round((rate / sweden) * 100) / 100 : null,
      plats_av_kommunerna: rankOf(t.id, BRA_LATEST, kommun),
    };
  }).filter((x) => x !== null);
  return {
    kommun,
    ar: BRA_LATEST,
    jamfort_med: BRA_PREVIOUS,
    invanare,
    kalla: BRA_SOURCE,
    sorter,
    obs: `Alla anmälda brott under året, per 100 000 invånare (invånare enligt SCB ${POPULATION_YEAR}). Plats 1 är högst i landet. Anmälningar utan brottsplats saknas, och små kommuner varierar mer mellan åren.`,
  };
}

/** Every kommun ranked by its rate for one kind, the highest or the lowest first */
export function braRanking(input: { sort?: unknown; ordning?: unknown; min_invanare?: unknown }) {
  const type = BRA_TYPE_IDS.includes(String(input.sort)) ? String(input.sort) : 'brott_totalt';
  const fewest = input.ordning === 'lagst';
  const minPop = Math.max(0, Math.round(Number(input.min_invanare) || 0));
  const rates = BRA_RATES[type][BRA_LATEST];
  const rows = Object.entries(rates)
    .filter(([kommun]) => (KOMMUN_POPULATION[kommun] ?? 0) >= minPop)
    .map(([kommun, rate]) => ({ kommun, per_100_000: rate, invanare: KOMMUN_POPULATION[kommun] ?? null }))
    .sort((a, b) => (fewest ? a.per_100_000 - b.per_100_000 : b.per_100_000 - a.per_100_000) || a.kommun.localeCompare(b.kommun, 'sv'));
  return {
    sort: labelOf(type),
    ar: BRA_LATEST,
    ordning: fewest ? 'lägst först' : 'högst först',
    ...(minPop ? { bara_kommuner_med_minst_invanare: minPop } : {}),
    sverige_per_100_000: swedenRate(type, BRA_LATEST),
    kommuner_i_urvalet: rows.length,
    kommuner: rows.slice(0, 10),
    kalla: BRA_SOURCE,
    obs: 'Alla anmälda brott under året, per 100 000 invånare. Små kommuner kan få höga eller låga tal av ett fåtal brott; välj en minsta storlek för jämförbara svar.',
  };
}
