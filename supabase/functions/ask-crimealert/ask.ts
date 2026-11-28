// Fråga CrimeAlert: questions about crime where you live, answered by Claude from Polisen's events.
// The model gets two tools that count the archive (police_events_archive) and answers only from
// what they return. Three questions a day without Pro, answered by Haiku; as many as you like
// with Pro (a hundred, so a stuck script can't run up a bill), the first five a day by Sonnet. The ask-crimealert edge function runs it; the parts
// here are plain functions so they can be tested.
import { SWEDISH_MUNICIPALITIES } from '../_shared/data/municipalities.ts';
import { KOMMUN_POPULATION, POPULATION_YEAR } from '../_shared/data/population.ts';
import { kommunMatcher } from '../_shared/notifications.ts';
import { THEMES, themeOf } from '../_shared/themes.ts';
import { STAT_TYPE_IDS } from './kommunStats.ts';

// How many questions, and how many from the larger model (planFacts)
import { FREE_QUESTIONS_PER_DAY, PRO_BETTER_PER_DAY, PRO_QUESTIONS_PER_DAY } from '../_shared/planFacts.ts';
export { FREE_QUESTIONS_PER_DAY, PRO_BETTER_PER_DAY, PRO_QUESTIONS_PER_DAY };

const DAY = 24 * 60 * 60 * 1000;
const MAX_LISTED = 25;
const MAX_TEXT = 200;

export interface AskEvent {
  id?: string;
  title: string;
  area: string | null;
  time: string;
  original_type: string | null;
  description?: string | null;
}

/** The start of today in Swedish time, in ms: questions are counted per Swedish day */
export function stockholmMidnight(now: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = wall - Math.floor(now / 1000) * 1000;
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset;
}

/** Pro's first questions each day get the larger model (Sonnet); the rest, and all free ones, Haiku */

/** Which model answers the next question: 'better' for Pro's first three a day */
export const modelTier = (used: number, isPro: boolean): 'better' | 'fast' => (isPro && used < PRO_BETTER_PER_DAY ? 'better' : 'fast');

/** Of Pro's better answers, how many are left today (null without Pro) */
export const betterLeft = (used: number, isPro: boolean): number | null => (isPro ? Math.max(0, PRO_BETTER_PER_DAY - used) : null);

/** Questions left today; null means as many as you like (Pro) */
export function questionsLeft(used: number, isPro: boolean): number | null {
  if (isPro) return used >= PRO_QUESTIONS_PER_DAY ? 0 : null;
  return Math.max(0, FREE_QUESTIONS_PER_DAY - used);
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The conversation as the app sent it, checked: user and assistant taking turns, ending with the
 * user's new question, the last twelve turns at most, each of a sensible length. Null when it
 * can't be used.
 */
export function cleanHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-12)) {
    const role = (item as { role?: unknown })?.role;
    const text = String((item as { content?: unknown })?.content ?? '').trim();
    if ((role !== 'user' && role !== 'assistant') || !text) return null;
    if (turns.length && turns[turns.length - 1].role === role) return null;
    turns.push({ role, content: text.slice(0, role === 'user' ? 500 : 2000) });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns.length && turns[turns.length - 1].role === 'user' ? turns : null;
}

// ---- Where an event belongs ----

const KOMMUN_NAMES = SWEDISH_MUNICIPALITIES.map((m) => m.name);
const byLowerName = new Map(KOMMUN_NAMES.map((n) => [n.toLocaleLowerCase('sv-SE'), n]));
let matchers: { name: string; matches: (area: string | null | undefined) => boolean }[] | null = null;

/** A kommun's name as written, from how someone typed it ("malmö" → "Malmö"), or null */
export function kommunNamed(text: string): string | null {
  const t = text.trim().toLocaleLowerCase('sv-SE').replace(/s? kommun$/, '');
  return byLowerName.get(t) ?? null;
}

/** The kommun an event happened in: the town at the end of the title, else the area unless it is a whole län */
export function kommunOfEvent(event: Pick<AskEvent, 'title' | 'area'>): string | null {
  const place = event.title.split(',').pop()?.trim().toLocaleLowerCase('sv-SE') ?? '';
  const named = byLowerName.get(place);
  if (named) return named;
  if (!event.area || /\blän$/i.test(event.area.trim())) return null;
  matchers ??= KOMMUN_NAMES.map((name) => ({ name, matches: kommunMatcher(name) }));
  return matchers.find((m) => m.matches(event.area))?.name ?? null;
}

const isSummary = (e: AskEvent) => /sammanfattning/i.test(e.original_type ?? '');
const kindOf = (e: AskEvent) => e.original_type?.trim() || 'Händelse';
const day = (time: string) => new Date(time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');

/** The kinds the tools can count, by id ("inbrott"), and "alla" for everything */
export const KINDS = ['alla', ...THEMES.map((t) => t.id)];
const matchesKind = (e: AskEvent, kind: string) => kind === 'alla' || themeOf(kindOf(e))?.id === kind;

// ---- The tools ----

export const ASK_TOOLS = [
  {
    name: 'kommun_events',
    description: 'Räknar och listar Polisens publicerade händelser i en svensk kommun under de senaste dagarna, jämfört med lika lång tid innan. Ger antal per sort och de senaste händelserna med datum, sort, ort och början av Polisens text (där stadsdelar och vägar ofta nämns). Använd för frågor om en viss kommun eller en plats i den.',
    strict: true,
    input_schema: {
      type: 'object' as const,
      properties: {
        kommun: { type: 'string', description: 'Kommunens namn, till exempel "Uppsala" eller "Upplands Väsby".' },
        days: { type: 'integer', description: 'Hur många dagar bakåt, 1 till 60. 7 för "senaste veckan", 30 för "senaste månaden".' },
        kind: { type: 'string', enum: KINDS, description: 'Vilken sorts händelser, eller "alla".' },
      },
      required: ['kommun', 'days', 'kind'],
      additionalProperties: false,
    },
  },
  {
    name: 'sweden_ranking',
    description: 'Räknar Polisens publicerade händelser per kommun i hela Sverige under de senaste dagarna och rangordnar kommunerna, i antal eller per 100 000 invånare, flest eller minst först. Ger de tio första, hela landets nivå per 100 000 invånare och hur många kommuner som inte har någon händelse alls. Använd för frågor om var i Sverige något är vanligast eller ovanligast, och för att jämföra en kommun med riket.',
    strict: true,
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'integer', description: 'Hur många dagar bakåt, 1 till 60.' },
        kind: { type: 'string', enum: KINDS, description: 'Vilken sorts händelser, eller "alla".' },
        matt: { type: 'string', enum: ['antal', 'per_invanare'], description: '"antal" rangordnar efter antal händelser, "per_invanare" efter händelser per 100 000 invånare.' },
        ordning: { type: 'string', enum: ['flest', 'minst'], description: '"flest" eller "minst" först.' },
        min_invanare: { type: 'integer', description: 'Ta bara med kommuner med minst så många invånare, 0 för alla. Använd till exempel 20000 eller 50000 vid "per_invanare", annars hamnar små kommuner med en enda händelse överst.' },
      },
      required: ['days', 'kind', 'matt', 'ordning', 'min_invanare'],
      additionalProperties: false,
    },
  },
  {
    name: 'kommun_statistik',
    description: 'Statistik för en kommun per 100 000 invånare: Brå:s alla anmälda brott 2025 för 16 sorter (bland annat totalt, våldsbrott, bostadsinbrott inklusive källare, vind och fritidshus, stöld, skadegörelse, narkotika, personrån, bilbrott), och räddningstjänstens insatser (MCF) till bränder i byggnad och trafikolyckor. För varje sort: kommunens nivå, förändringen mot ett tidigare år, hela landets nivå, hur många gånger rikets nivå det är och kommunens plats bland alla kommuner. Använd för frågor om hur mycket brott eller bränder det är i en kommun, eller hur den står sig mot riket.',
    strict: true,
    input_schema: {
      type: 'object' as const,
      properties: {
        kommun: { type: 'string', description: 'Kommunens namn, till exempel "Norrköping".' },
      },
      required: ['kommun'],
      additionalProperties: false,
    },
  },
  {
    name: 'sverige_statistik',
    description: 'Rangordnar alla kommuner per 100 000 invånare för en sort, högst eller lägst först, och ger hela landets nivå: Brå:s anmälda brott 2025, eller räddningstjänstens insatser till bränder i byggnad och trafikolyckor. Använd för frågor om var i Sverige något är vanligast eller ovanligast, till exempel var det är minst bostadsinbrott per invånare.',
    strict: true,
    input_schema: {
      type: 'object' as const,
      properties: {
        sort: { type: 'string', enum: STAT_TYPE_IDS, description: 'Vilken sort: ett brott enligt Brå, eller byggnadsbrander och trafikolyckor_raddningsinsats från räddningstjänsten.' },
        ordning: { type: 'string', enum: ['hogst', 'lagst'], description: '"hogst" eller "lagst" först.' },
        min_invanare: { type: 'integer', description: 'Ta bara med kommuner med minst så många invånare, 0 för alla. Använd till exempel 20000 eller 50000 för jämförbara svar.' },
      },
      required: ['sort', 'ordning', 'min_invanare'],
      additionalProperties: false,
    },
  },
];

const clampDays = (value: unknown, max: number) => Math.min(max, Math.max(1, Math.round(Number(value) || 7)));
const cut = (text: string | null | undefined) => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT).trimEnd()}…` : t;
};

/** kommun_events: needs the events in the kommun for twice the period */
export function kommunEvents(input: { kommun?: unknown; days?: unknown; kind?: unknown }, events: AskEvent[], now: number) {
  const kommun = kommunNamed(String(input.kommun ?? ''));
  if (!kommun) return { error: `Ingen svensk kommun heter "${String(input.kommun ?? '')}".` };
  const days = clampDays(input.days, 60);
  const kind = KINDS.includes(String(input.kind)) ? String(input.kind) : 'alla';
  const counts = new Map<string, { nu: number; innan: number }>();
  const listed: { at: number; datum: string; sort: string; ort: string; text: string }[] = [];
  let now_ = 0;
  let before = 0;
  for (const e of events) {
    if (isSummary(e) || kommunOfEvent(e) !== kommun || !matchesKind(e, kind)) continue;
    const at = Date.parse(e.time);
    const age = now - at;
    if (Number.isNaN(age) || age < 0 || age > 2 * days * DAY) continue;
    const theme = themeOf(kindOf(e))?.label ?? 'Övrigt';
    const c = counts.get(theme) ?? { nu: 0, innan: 0 };
    if (age <= days * DAY) {
      now_++;
      c.nu++;
      listed.push({ at, datum: day(e.time), sort: kindOf(e), ort: e.title.split(',').pop()?.trim() ?? kommun, text: cut(e.description) });
    } else {
      before++;
      c.innan++;
    }
    counts.set(theme, c);
  }
  listed.sort((a, b) => b.at - a.at);
  const invanare = KOMMUN_POPULATION[kommun] ?? null;
  return {
    kommun,
    invanare,
    per_100_000_invanare: invanare ? round2((now_ / invanare) * 100_000) : null,
    period: `senaste ${days} dagarna`,
    sort: kind,
    antal: now_,
    antal_perioden_innan: before,
    per_sort: [...counts].map(([sort, c]) => ({ sort, ...c })).sort((a, b) => b.nu - a.nu || b.innan - a.innan),
    senaste: listed.slice(0, MAX_LISTED).map(({ at: _at, ...rest }) => rest),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const SWEDEN_POPULATION = Object.values(KOMMUN_POPULATION).reduce((a, b) => a + b, 0);

/** sweden_ranking: needs every event in Sweden for the period */
export function swedenRanking(
  input: { days?: unknown; kind?: unknown; matt?: unknown; ordning?: unknown; min_invanare?: unknown },
  events: AskEvent[],
  now: number,
) {
  const days = clampDays(input.days, 60);
  const kind = KINDS.includes(String(input.kind)) ? String(input.kind) : 'alla';
  const perCapita = input.matt === 'per_invanare';
  const fewest = input.ordning === 'minst';
  const minPop = Math.max(0, Math.round(Number(input.min_invanare) || 0));
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    if (isSummary(e) || !matchesKind(e, kind)) continue;
    const age = now - Date.parse(e.time);
    if (Number.isNaN(age) || age < 0 || age > days * DAY) continue;
    total++;
    const kommun = kommunOfEvent(e);
    if (kommun) counts.set(kommun, (counts.get(kommun) ?? 0) + 1);
  }
  // Every kommun is in the ranking, those without events too, so "minst" means something
  const rows = Object.entries(KOMMUN_POPULATION)
    .filter(([, pop]) => pop >= minPop)
    .map(([kommun, invanare]) => {
      const antal = counts.get(kommun) ?? 0;
      return { kommun, antal, invanare, per_100_000_invanare: round2((antal / invanare) * 100_000) };
    });
  const key = (r: (typeof rows)[number]) => (perCapita ? r.per_100_000_invanare : r.antal);
  rows.sort((a, b) => (fewest ? key(a) - key(b) : key(b) - key(a)) || (fewest ? b.invanare - a.invanare : a.kommun.localeCompare(b.kommun, 'sv')));
  // Most first lists only kommuner that have events; fewest first also those without
  const list = (fewest ? rows : rows.filter((r) => r.antal > 0)).slice(0, 10).map((r) => (perCapita ? r : { kommun: r.kommun, antal: r.antal, invanare: r.invanare }));
  return {
    period: `senaste ${days} dagarna`,
    sort: kind,
    matt: perCapita ? 'per 100 000 invånare' : 'antal',
    ...(minPop ? { bara_kommuner_med_minst_invanare: minPop } : {}),
    antal_i_sverige: total,
    sverige_per_100_000_invanare: round2((total / SWEDEN_POPULATION) * 100_000),
    kommuner_i_urvalet: rows.length,
    kommuner_utan_handelser: rows.filter((r) => r.antal === 0).length,
    [fewest ? 'minst' : 'flest']: list,
    obs: `Invånare enligt SCB ${POPULATION_YEAR}. Polisen publicerar ett urval av händelserna, och händelser som Polisen bara anger på länsnivå räknas inte till någon kommun. Med få händelser blir siffrorna per invånare osäkra.`,
  };
}

/** What the model is told, with today's date so "i går" and "den här veckan" mean something */
export function askSystem(now: number): string {
  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `Du är Fråga CrimeAlert, en tjänst i appen CrimeAlert som svarar på frågor om brott och händelser i Sverige utifrån det Polisen har publicerat. Idag är det ${today}.

Hämta alltid uppgifter med verktygen innan du svarar på en fråga om brott eller händelser, och svara bara utifrån det verktygen ger.

Du har två sorters underlag. Statistiken (kommun_statistik, sverige_statistik) räknar alla anmälda brott under ett helt år enligt Brå, och räddningstjänstens insatser till bränder och trafikolyckor, per kommun och invånare; den visar nivån, alltså var det är mycket eller lite brott, och är det rätta underlaget för frågor som "var är det minst inbrott per invånare" eller "är det mycket brott i X". Polisens händelser (kommun_events, sweden_ranking) är ett urval av vad som hänt de senaste dagarna och veckorna; de visar vad som händer just nu, var och när. Använd båda när frågan gäller både läget nu och nivån, och säg vilken källa en siffra kommer från. Frågar någon per 1 000 invånare, dela talen per 100 000 med 100. Finns inget svar där, säg det rakt ut. Polisens händelser finns från den 28 september 2026; Brå:s statistik gäller hela år.

Tänk igenom vad frågan egentligen kräver innan du svarar, och hämta det som behövs för att dra en slutsats, gärna med flera verktygsanrop. Jämför när det hjälper: med perioden innan, med andra kommuner och med hela landet per invånare. Frågar någon var något är vanligast eller ovanligast, räkna per invånare med sweden_ranking och välj en rimlig minsta kommunstorlek, så att en liten kommun med en enda händelse inte avgör svaret. Säg vad siffrorna pekar på och hur säkert det är; med få händelser, säg att skillnaderna kan vara slumpen.

Svara på enkel svenska och sakligt, utan rubriker eller tabeller: oftast 3 till 6 meningar, högst 180 ord. Säg vilken period siffrorna gäller.

Polisen publicerar ett urval av det som händer, inte alla anmälda brott, så skriv "Polisen har rapporterat" och påstå inte att brottsligheten i sig är högre eller lägre. Inbrott och många andra brott publiceras sällan, så för dem säger Polisens händelser lite om var det faktiskt sker mest; säg det när det gäller frågan.

Peka aldrig ut personer: inga namn, åldrar, kön, utseenden eller gissningar om vem som gjorde vad, och svara inte på frågor om en viss persons inblandning. Spekulera inte om orsaker eller gärningsmän.

Vid akut fara: hänvisa till 112. Tips till Polisen: 114 14. Du ger inga juridiska råd.

Frågor som inte handlar om brott, trygghet eller CrimeAlert svarar du inte på; säg vänligt vad du kan hjälpa till med.`;
}
