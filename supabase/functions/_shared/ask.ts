// Fråga CrimeAlert: questions about crime where you live, answered by Claude from Polisen's events.
// The model gets two tools that count the archive (police_events_archive) and answers only from
// what they return. Three questions a day without Pro, as many as you like with Pro (a hundred,
// so a stuck script can't run up a bill). The ask-crimealert edge function runs it; the parts
// here are plain functions so they can be tested.
import { SWEDISH_MUNICIPALITIES } from './data/municipalities.ts';
import { kommunMatcher } from './notifications.ts';
import { THEMES, themeOf } from './themes.ts';

export const FREE_QUESTIONS_PER_DAY = 3;
/** "Obegränsat" for Pro, but not without end */
export const PRO_QUESTIONS_PER_DAY = 100;

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
    description: 'Räknar Polisens publicerade händelser per kommun i hela Sverige under de senaste dagarna och ger de tio kommuner med flest, i antal (inte per invånare). Använd för frågor om var i Sverige något är vanligast.',
    strict: true,
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'integer', description: 'Hur många dagar bakåt, 1 till 30.' },
        kind: { type: 'string', enum: KINDS, description: 'Vilken sorts händelser, eller "alla".' },
      },
      required: ['days', 'kind'],
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
  return {
    kommun,
    period: `senaste ${days} dagarna`,
    sort: kind,
    antal: now_,
    antal_perioden_innan: before,
    per_sort: [...counts].map(([sort, c]) => ({ sort, ...c })).sort((a, b) => b.nu - a.nu || b.innan - a.innan),
    senaste: listed.slice(0, MAX_LISTED).map(({ at: _at, ...rest }) => rest),
  };
}

/** sweden_ranking: needs every event in Sweden for the period */
export function swedenRanking(input: { days?: unknown; kind?: unknown }, events: AskEvent[], now: number) {
  const days = clampDays(input.days, 30);
  const kind = KINDS.includes(String(input.kind)) ? String(input.kind) : 'alla';
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
  return {
    period: `senaste ${days} dagarna`,
    sort: kind,
    antal_i_sverige: total,
    flest: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv')).slice(0, 10).map(([kommun, antal]) => ({ kommun, antal })),
    obs: 'Antal, inte per invånare. Händelser som Polisen bara anger på länsnivå räknas inte till någon kommun.',
  };
}

/** What the model is told, with today's date so "i går" and "den här veckan" mean something */
export function askSystem(now: number): string {
  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `Du är Fråga CrimeAlert, en tjänst i appen CrimeAlert som svarar på frågor om brott och händelser i Sverige utifrån det Polisen har publicerat. Idag är det ${today}.

Hämta alltid uppgifter med verktygen innan du svarar på en fråga om händelser, och svara bara utifrån det verktygen ger. Finns inget svar där, säg det rakt ut. Arkivet börjar den 28 september 2026, så längre tillbaka finns inget.

Svara på enkel svenska, kort och sakligt: oftast 2 till 5 meningar, högst 120 ord, utan rubriker eller tabeller. Säg vilken period siffrorna gäller.

Polisen publicerar ett urval av det som händer, så skriv "Polisen har rapporterat" och inte att brottsligheten är hög eller har ökat. Jämför inte kommuner per invånare, verktygen ger bara antal.

Peka aldrig ut personer: inga namn, åldrar, kön, utseenden eller gissningar om vem som gjorde vad, och svara inte på frågor om en viss persons inblandning. Spekulera inte om orsaker eller gärningsmän.

Vid akut fara: hänvisa till 112. Tips till Polisen: 114 14. Du ger inga juridiska råd.

Frågor som inte handlar om brott, trygghet eller CrimeAlert svarar du inte på; säg vänligt vad du kan hjälpa till med.`;
}
