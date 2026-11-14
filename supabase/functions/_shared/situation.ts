// Lägesbild: what has happened in a kommun the last week, in a few sentences. The facts are
// counted here from Polisen's events (police_events_archive); the situation-report edge function
// has Claude write them as text, and falls back to plainText() without it. Only what is counted
// here reaches the model, so the text cannot say more than the facts.
import { kommunMatcher } from './notifications.ts';
import { THEMES, themeOf } from './themes.ts';

const DAY = 24 * 60 * 60 * 1000;
/** Events shown to the model, newest first; enough to see what recurs */
const MAX_RECENT = 30;
/** A description is cut here: the place and what happened come first */
const MAX_TEXT = 220;

export interface SituationEvent {
  title: string;
  area: string | null;
  time: string;
  original_type: string | null;
  description?: string | null;
}

export interface ThemeCount {
  label: string;
  now: number;
  before: number;
}

export interface SituationFacts {
  kommun: string;
  /** Events the last 7 days, and the 7 before */
  thisWeek: number;
  lastWeek: number;
  /** Kinds of crime this week or the week before, most this week first */
  themes: ThemeCount[];
  /** This week's events, newest first: when, what, and the start of Polisen's text */
  recent: { when: string; kind: string; text: string }[];
}

/** Polisen's titles end with the town: "13 november 14.05, Inbrott, Gottsunda" */
const placeOfTitle = (title: string) => title.split(',').pop()?.trim() ?? '';

const isSummary = (e: SituationEvent) => /sammanfattning/i.test(e.original_type ?? '');

const weekday = (time: string) =>
  new Date(time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');

/** The facts for a kommun from the last 14 days of events */
export function situationFacts(events: SituationEvent[], kommun: string, now: number): SituationFacts {
  const inKommun = kommunMatcher(kommun);
  const counts = new Map<string, { now: number; before: number }>();
  const recent: { at: number; when: string; kind: string; text: string }[] = [];
  let thisWeek = 0;
  let lastWeek = 0;
  for (const event of events) {
    if (isSummary(event) || !(inKommun(event.area) || inKommun(placeOfTitle(event.title)))) continue;
    const at = Date.parse(event.time);
    const age = now - at;
    if (Number.isNaN(age) || age < 0 || age > 14 * DAY) continue;
    const kind = event.original_type?.trim() || 'Händelse';
    const theme = themeOf(kind);
    const c = theme ? counts.get(theme.label) ?? { now: 0, before: 0 } : null;
    if (age <= 7 * DAY) {
      thisWeek++;
      if (c) c.now++;
      const text = (event.description ?? '').replace(/\s+/g, ' ').trim();
      recent.push({ at, when: weekday(event.time), kind, text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT).trimEnd()}…` : text });
    } else {
      lastWeek++;
      if (c) c.before++;
    }
    if (theme && c) counts.set(theme.label, c);
  }
  const order = new Map(THEMES.map((t, i) => [t.label, i]));
  const themes = [...counts].map(([label, c]) => ({ label, ...c }))
    .sort((a, b) => b.now - a.now || b.before - a.before || (order.get(a.label) ?? 0) - (order.get(b.label) ?? 0));
  recent.sort((a, b) => b.at - a.at);
  return { kommun, thisWeek, lastWeek, themes, recent: recent.slice(0, MAX_RECENT).map(({ when, kind, text }) => ({ when, kind, text })) };
}

/** Too few events to say anything a sentence of counting can't */
export const tooQuiet = (facts: SituationFacts) => facts.thisWeek < 3;

const events = (n: number) => `${n} ${n === 1 ? 'händelse' : 'händelser'}`;

/** The lägesbild without AI: counts only. For quiet weeks, and when the model can't be reached */
export function plainText(facts: SituationFacts): string {
  if (facts.thisWeek === 0) {
    return `Polisen har inte rapporterat några händelser i ${facts.kommun} den senaste veckan.`;
  }
  const compared = facts.thisWeek === facts.lastWeek
    ? 'lika många som veckan innan'
    : `${facts.thisWeek > facts.lastWeek ? 'fler' : 'färre'} än veckan innan (${facts.lastWeek})`;
  const top = facts.themes.filter((t) => t.now > 0).slice(0, 2);
  const kinds = top.length ? ` Vanligast var ${top.map((t) => `${t.label.toLocaleLowerCase('sv-SE')} (${t.now})`).join(' och ')}.` : '';
  return `Polisen har rapporterat ${events(facts.thisWeek)} i ${facts.kommun} den senaste veckan, ${compared}.${kinds}`;
}

/** What the model is told to do. Fixed, so it can be cached */
export const SITUATION_SYSTEM = `Du skriver en kort lägesbild för en svensk kommun i appen CrimeAlert, utifrån de händelser Polisen har publicerat den senaste veckan.

Skriv på enkel och saklig svenska: 2 till 4 meningar, högst 80 ord, utan rubrik, punktlistor eller markdown.

Använd bara uppgifterna du får. Hitta inte på händelser, platser, orsaker eller siffror, och dra inga slutsatser som uppgifterna inte bär.

Börja med det viktigaste: hur många händelser Polisen har rapporterat och om det är fler eller färre än veckan innan. Nämn sedan de vanligaste sorterna och om något återkommer, till exempel flera inbrott i samma område eller flera trafikolyckor på samma väg. Nämn stadsdelar och vägar när texterna gör det.

Skriv aldrig ut namn, ålder, kön eller annat som pekar ut personer. Spekulera inte om gärningsmän och skriv inte om trygghet i allmänhet.

Polisen publicerar ett urval av det som händer, så skriv till exempel "Polisen har rapporterat", inte att brottsligheten har ökat.

Exempel på ton och längd, från en annan kommun (kopiera inga uppgifter härifrån):
Polisen har rapporterat 24 händelser i Gävle den senaste veckan, färre än veckan innan (31). Flest var trafikolyckorna, sex stycken, varav tre på E4 vid Skutskär. Det har också varit fyra inbrott i Sätra, alla i källarförråd under helgen.`;

/** The facts as the model reads them */
export function situationPrompt(facts: SituationFacts): string {
  const themes = facts.themes.length
    ? facts.themes.map((t) => `- ${t.label}: ${t.now} (veckan innan ${t.before})`).join('\n')
    : '- Inga av de vanliga sorterna';
  const recent = facts.recent.map((e) => `- ${e.when}, ${e.kind}${e.text ? `: ${e.text}` : ''}`).join('\n');
  return `Kommun: ${facts.kommun}
Händelser senaste 7 dagarna: ${facts.thisWeek} (veckan innan: ${facts.lastWeek})

Sorter:
${themes}

Händelserna senaste 7 dagarna, nyast först:
${recent}

Skriv lägesbilden för ${facts.kommun}.`;
}

/**
 * Whether every number in the text is one the model was given. A number it made up, or took
 * from the example in the instructions, means the text is not used. Numbers inside words, such
 * as the road E4, are left alone.
 */
export function numbersFromFacts(summary: string, prompt: string): boolean {
  const numbers = (text: string) => text.match(/(?<![\p{L}\d])\d+(?![\p{L}\d])/gu) ?? [];
  const given = new Set(numbers(prompt));
  return numbers(summary).every((n) => given.has(n));
}

/** The model's text, as one plain paragraph without markdown, or null when it is unusable */
export function cleanSummary(text: string): string | null {
  const plain = text
    .replace(/^#+\s.*$/gm, '')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length < 20) return null;
  return plain.length > 700 ? `${plain.slice(0, 700).replace(/\s+\S*$/, '')}…` : plain;
}
