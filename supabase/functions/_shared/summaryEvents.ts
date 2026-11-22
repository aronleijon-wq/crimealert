// Polisen's summaries ("Sammanfattning natt, Stockholms län") list the night's events in one
// text: "Nacka 02.10 Stöld. En man …". Each of them is an event of its own here, in its own
// kommun and at its own time, so a kommun's numbers and its map count the night too and not only
// the events Polisen publishes one by one. Used by police-events, which places, archives and
// shows them like any other event; send-push-notifications leaves them out (they are hours old
// when the summary comes).

/** The summary an event came from, as police-events has it */
export interface SummarySource {
  id: string;
  title: string;
  description: string;
  area: string;
  time: string;
  url?: string | null;
}

/** One event found in a summary */
export interface SummaryPart {
  /** The summary's id with "-s" and its number: "pol-123-s2" */
  id: string;
  kommun: string;
  /** Polisen's name for the kind of event: "Stöld", "Misshandel" */
  type: string;
  /** ISO time with Sweden's offset, or the summary's own time when the text has none */
  time: string;
  /** The text about it, heading included */
  text: string;
}

/** What the splitter needs to know about places */
export interface SummaryPlaces {
  /** The kommuner a summary for this area can name: its län's, or all of Sweden's */
  kommunerFor: (area: string) => string[];
  /** The kommun a district or village in this area's län lies in ("Södermalm" → "Stockholm") */
  placeKommun?: (area: string, name: string) => string | null;
  /** The area itself when it is a kommun (a summary for Göteborg), else null */
  kommunOfArea?: (area: string) => string | null;
}

/**
 * A län's districts and villages by name, each with its kommun, for placeKommun. A name found in
 * more than one kommun is left out, unless exactly one of them has a town of that name.
 */
export function placeKommunIndex(perKommun: [string, [string, number, number, string][] | undefined][]): Map<string, string> {
  const all = new Map<string, { kommun: string; town: boolean }[]>();
  for (const [kommun, places] of perKommun) {
    for (const [name, , , kind] of places ?? []) {
      const key = norm(name);
      if (key.length < 4) continue;
      const list = all.get(key) ?? [];
      if (!list.some((e) => e.kommun === kommun)) list.push({ kommun, town: kind === 'c' });
      all.set(key, list);
    }
  }
  const index = new Map<string, string>();
  for (const [key, list] of all) {
    const towns = list.filter((e) => e.town);
    if (list.length === 1) index.set(key, list[0].kommun);
    else if (towns.length === 1) index.set(key, towns[0].kommun);
  }
  return index;
}

export const placeKey = (name: string) => norm(name);

/** Whether an event is one found in a summary */
export const isSummaryPart = (id: string | null | undefined) => /-s\d+$/.test(id ?? '');

export const isSummary = (originalType: string | null | undefined, title?: string | null) =>
  /sammanfattning/i.test(`${originalType ?? ''} ${title ?? ''}`);

// The kinds of event, the most specific first: a robbery is not a theft, violence against an
// officer not an ordinary assault. Names as Polisen writes them, so the rest of CrimeAlert
// (themes, colours, pictures) treats these events as it treats Polisen's own.
const KINDS: [RegExp, string][] = [
  [/skottlossning|skott (?:har )?avlossa|sköt (?:mot|på)/, 'Skottlossning'],
  [/sprängning|explosion|detonation|smäll(?:en)? hördes/, 'Explosion'],
  [/\bmord\b|\bdråp\b|mordförsök/, 'Mord/dråp'],
  [/\brån\b|\brånad|\brånet\b|\brånförsök|personrån/, 'Rån'],
  [/våld(?: eller hot)? mot tjänsteman|hot mot tjänsteman|våld mot polis/, 'Våld/hot mot tjänsteman'],
  [/våldtäkt|sexualbrott|sexuellt ofredande|sexuellt övergrepp/, 'Sexualbrott'],
  [/inbrott/, 'Inbrott'],
  [/rattfylleri|rattfull|drograttfylleri|påverkad förare|alkoholpåverkad förare/, 'Rattfylleri'],
  [/trafikolycka|singelolycka|viltolycka|kollision|krock|frontalkrock|påkörd|körde av vägen|i diket/, 'Trafikolycka'],
  [/\bbrand\b|branden\b|brann\b|brinner|brinnande|\bbränd|\bbrändes|eldsvåda|bilbrand|anlagd brand|rökutveckling|satt i brand|tänt eld/, 'Brand'],
  [/misshandel|misshandla/, 'Misshandel'],
  [/knivlagen/, 'Brott mot knivlagen'],
  [/vapenlagen/, 'Vapenlagen'],
  [/narkotika/, 'Narkotikabrott'],
  [/olaga hot|\bhotade\b|\bhotats\b/, 'Olaga hot'],
  [/ofredande/, 'Ofredande/förargelse'],
  [/bedrägeri|bedragen|bedragits/, 'Bedrägeri'],
  [/skadegörelse|klotter|vandalis|krossade rutor|krossat rutor/, 'Skadegörelse'],
  [/\bbråk\b|slagsmål|tumult|\bbråkade/, 'Bråk'],
  [/försvunnen|saknad person|anmäldes saknad|efterlyst/, 'Försvunnen person'],
  [/arbetsplatsolycka/, 'Arbetsplatsolycka'],
  [/olaga intrång|hemfridsbrott/, 'Olaga intrång'],
  [/häleri/, 'Häleri'],
  [/stöld|\bstal\b|stulen|stulet|stulna|snatteri|tillgrepp|\bstjäl/, 'Stöld'],
  [/fylleri|\blob\b|kraftigt berusad|omhändertogs (?:för|enligt) lob/, 'Fylleri/LOB'],
  [/olovlig körning|trafikkontroll|hastighetskontroll/, 'Trafikkontroll'],
];

/** Polisen's name for the kind of event a text is about, or null */
export function kindOf(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [rx, name] of KINDS) if (rx.test(lower)) return name;
  return null;
}

// Not inside a word: JavaScript's \b doesn't know å, ä and ö
const B = '(?<![A-Za-zÅÄÖÉåäöéü])';
const E = '(?![A-Za-zÅÄÖÉåäöéü])';

/**
 * A time in a text: "kl. 02.10", "klockan 2.10", "02:10", "vid 03-tiden", "strax före 23".
 * A bare "22.11" only at the start of a heading, where it can't be a date in a sentence.
 */
export function timeIn(text: string, heading = false): { h: number; m: number } | null {
  const ok = (h: number, m: number) => (h >= 0 && h <= 23 && m >= 0 && m <= 59 ? { h, m } : null);
  let m = new RegExp(`${B}(?:kl\\.?|klockan|vid|runt|omkring|cirka|ca\\.?)\\s*(\\d{1,2})[.:](\\d{2})${E}`, 'i').exec(text);
  if (m) return ok(+m[1], +m[2]);
  m = new RegExp(`${B}(\\d{1,2})[:](\\d{2})${E}`).exec(text);
  if (m) return ok(+m[1], +m[2]);
  m = new RegExp(`${B}(?:vid|runt|vid ungefär|omkring)\\s+(\\d{1,2})-tiden`, 'i').exec(text);
  if (m) return ok(+m[1], 0);
  m = new RegExp(`${B}(?:kl\\.?|klockan)\\s*(\\d{1,2})${E}`, 'i').exec(text);
  if (m) return ok(+m[1], 0);
  if (heading) {
    m = new RegExp(`${B}(\\d{1,2})\\.(\\d{2})${E}`).exec(text.slice(0, 60));
    if (m) return ok(+m[1], +m[2]);
  }
  return null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Kommun names that are also ordinary words; found only with a capital letter not starting a sentence
const WORDLIKE = new Set(['ale', 'mark', 'vara', 'kil', 'bjuv', 'åre', 'sala', 'tierp', 'nora', 'boden', 'sunne', 'falun', 'mora']);

/** The kommun a block is in: the first kommun or known place it names */
function kommunIn(text: string, kommuner: string[], places: SummaryPlaces, area: string): string | null {
  let best: { at: number; kommun: string } | null = null;
  for (const k of kommuner) {
    const rx = new RegExp(`${B}${escape(k)}(?:s)?${E}`, 'g');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      // "Vara" or "Mark" opening a sentence is a word, not the kommun
      if (WORDLIKE.has(norm(k)) && (m.index === 0 || /[.!?]\s*$/.test(text.slice(0, m.index)))) continue;
      if (!best || m.index < best.at) best = { at: m.index, kommun: k };
      break;
    }
  }
  if (places.placeKommun) {
    for (const m of text.matchAll(/[A-ZÅÄÖÉ][a-zåäöéü]+(?:[- ][A-ZÅÄÖÉ][a-zåäöéü]+)?/g)) {
      if ((m.index ?? 0) >= (best?.at ?? Infinity)) break;
      if (m[0].length < 4) continue;
      const kommun = places.placeKommun(area, m[0]) ?? (m[0].includes(' ') ? places.placeKommun(area, m[0].split(' ')[0]) : null);
      if (kommun) { best = { at: m.index ?? 0, kommun }; break; }
    }
  }
  return best?.kommun ?? null;
}

/** Whether a line opens with a kind of event, in its first few words ("Inbrott i villa.") */
const opensWithKind = (line: string) => {
  const opening = line.split(/[.,:;–]/)[0];
  return opening.split(' ').length <= 5 && kindOf(opening.split(' ').slice(0, 2).join(' ')) !== null;
};

/** A line that heads an event: short and not a sentence ("Nacka 02.10 – Stöld") */
const isHeading = (line: string) => line.length <= 80 && !/[.!?]["”)]?$/.test(line);
// Lines about the summary itself, not an event
const ABOUT = /^(ett urval|urval av|sammanfattning|nedan följer|här följer|polisen i |händelser under|nattens händelser|kvällens händelser|helgens händelser|kontakta|tips|uppdatering|\(?bilden)/i;

/** The summary's text, one block per event: a heading with its text, or a paragraph on its own */
export function summaryBlocks(description: string): { heading: string; body: string }[] {
  const lines = description.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const blocks: { heading: string; body: string }[] = [];
  for (const line of lines) {
    if (ABOUT.test(line)) continue;
    const last = blocks[blocks.length - 1];
    if (isHeading(line)) blocks.push({ heading: line, body: '' });
    else if (last && !last.body) last.body = line;
    // A paragraph that goes on about the last event: no time, and it doesn't open with a place
    // ("Solna, …") or a kind of event ("Skadegörelse på en skola.")
    else if (last && !timeIn(line) && !/^[A-ZÅÄÖ][a-zåäö]+(?:[ -][A-ZÅÄÖ][a-zåäö]+)?\s*[,:–-]/.test(line) && !opensWithKind(line)) last.body += ` ${line}`;
    else blocks.push({ heading: '', body: line });
  }
  return blocks.filter((b) => b.heading || b.body);
}

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

/** A date and time in Sweden, from a moment */
function swedish(ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  return { y: +parts.year, mo: +parts.month, d: +parts.day, h: +parts.hour, mi: +parts.minute };
}

/** The moment a Swedish date and time is, as an ISO string with Sweden's offset then */
function swedishIso(y: number, mo: number, d: number, h: number, mi: number): string {
  // Guess UTC, then correct by the offset Sweden has at that moment (+1 or +2)
  let ms = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const s = swedish(ms);
    ms += Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(s.y, s.mo - 1, s.d, s.h, s.mi);
  }
  const offset = Math.round((Date.UTC(y, mo - 1, d, h, mi) - ms) / 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

/** Polisen's time ("2026-11-22 6:00:00 +01:00") or ISO, as a moment */
export function parseSummaryTime(value: string): number {
  const s = value.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([+-]\d{2}:\d{2})?$/, (_, d, h, m, sec, tz) => `${d}T${h.padStart(2, '0')}:${m}:${sec}${tz ?? ''}`);
  return Date.parse(s);
}

/**
 * The events in a summary. A block is an event when it names a kommun (or the summary is for
 * one) and a kind of event; its time is the one in the text, on the day before the summary
 * when it is later in the day than the summary was written ("23.40" in the morning's summary).
 */
export function summaryParts(summary: SummarySource, places: SummaryPlaces): SummaryPart[] {
  if (!summary.description) return [];
  const at = parseSummaryTime(summary.time);
  if (!Number.isFinite(at)) return [];
  const area = (summary.title.split(',').pop() ?? '').trim() || summary.area;
  const fromTitle = places.kommunerFor(area);
  const kommuner = fromTitle.length ? fromTitle : places.kommunerFor(summary.area);
  const own = places.kommunOfArea?.(area) ?? places.kommunOfArea?.(summary.area) ?? null;
  const written = swedish(at);
  const parts: SummaryPart[] = [];
  for (const { heading, body } of summaryBlocks(summary.description)) {
    const text = [heading, body].filter(Boolean).join(heading && !/[.:!?–-]$/.test(heading) ? ' – ' : ' ');
    const kommun = kommunIn(heading, kommuner, places, area) ?? kommunIn(body, kommuner, places, area) ?? own;
    const type = (heading && kindOf(heading)) || kindOf(body);
    if (!kommun || !type) continue;
    const clock = timeIn(heading, true) ?? timeIn(body);
    let time = summary.time;
    if (clock) {
      // Later in the day than the summary was written: the evening before
      const later = clock.h * 60 + clock.m > written.h * 60 + written.mi + 15;
      const day = new Date(Date.UTC(written.y, written.mo - 1, written.d - (later ? 1 : 0)));
      time = swedishIso(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), clock.h, clock.m);
    }
    parts.push({ id: `${summary.id}-s${parts.length + 1}`, kommun, type, time, text });
  }
  return parts;
}

/** Polisen's kind of title for a part: "22 november 02.10, Stöld, Nacka" */
export function partTitle(part: SummaryPart): string {
  const s = swedish(parseSummaryTime(part.time));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${s.d} ${MONTHS[s.mo - 1]} ${pad(s.h)}.${pad(s.mi)}, ${part.type}, ${part.kommun}`;
}

/** An event Polisen published on its own that may also be in a summary */
export interface OwnEvent { id: string; area: string; title?: string | null; time: string; originalType?: string | null }

const kommunOfEvent = (e: OwnEvent) => norm((e.title ?? '').split(',').pop()?.trim() || e.area);
const sameKind = (a: string, b: string) => {
  const ka = kindOf(a) ?? a.toLowerCase();
  const kb = kindOf(b) ?? b.toLowerCase();
  return ka === kb;
};

/**
 * The parts that are not already events of their own: Polisen sometimes publishes an event and
 * also lists it in the summary. The same kommun and kind within 75 minutes is the same event.
 */
export function newParts(parts: SummaryPart[], own: OwnEvent[]): SummaryPart[] {
  const others = own.filter((e) => !isSummaryPart(e.id) && !isSummary(e.originalType, e.title));
  return parts.filter((p) => {
    const at = parseSummaryTime(p.time);
    return !others.some((e) =>
      kommunOfEvent(e) === norm(p.kommun) &&
      sameKind(e.originalType ?? '', p.type) &&
      Math.abs(parseSummaryTime(e.time) - at) <= 75 * 60 * 1000);
  });
}
