// A picture for each police event: one of CrimeAlert's own illustrations (src/assets/illustrationer),
// chosen by the kind of event and words in its text. It shows what kind of thing happened, not the
// place itself, so it always carries the label "Illustration".
//
// Adding a picture is only adding the file: the name says what it shows (brand-lagenhet.jpg).
// A missing picture falls back to a broader one (brand-bil → brand), then to any picture of the
// same family (brand-*), and finally to "polisinsats", "misshandel" or "ovrigt"; with none, no picture.
// Pictures in daylight are named with -dag (trafik-stad-dag.jpg) and used for events in daylight;
// at other times, or without one, the night picture is used.

import { parseIncidentTime } from './incidentTime';

const files = import.meta.glob('../assets/illustrationer/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** The pictures there are, by name without the extension */
export const ILLUSTRATIONS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.[a-z]+$/i, ''), url]),
);

export interface IllustrationEvent {
  type?: string | null;
  originalType?: string | null;
  title?: string | null;
  description?: string | null;
  /** When it happened, as the police give it, for a daylight picture in daylight */
  time?: string | null;
}

// The hours of daylight in Stockholm by month, roughly, from January: short in winter, long in summer
const DAYLIGHT: [number, number][] = [[9, 15], [8, 16], [7, 18], [6, 20], [5, 21], [4, 22], [4, 22], [6, 20], [7, 19], [8, 17], [8, 15], [9, 15]];

/** Whether an event happened in daylight in Sweden; false when its time is unknown */
export function inDaylight(time: string | null | undefined): boolean {
  const ms = parseIncidentTime(time)?.getTime() ?? NaN;
  if (!Number.isFinite(ms)) return false;
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', month: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const month = Number(parts.find((p) => p.type === 'month')?.value) - 1;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const [from, to] = DAYLIGHT[month] ?? [8, 16];
  return hour >= from && hour < to;
}

const has = (text: string, rx: RegExp) => rx.test(text);

const BUILDING_FLAT = /lägenhet|flerfamiljshus|trapphus|balkong|hyreshus|bostadsrätt|\blgh\b/;
const BUILDING_HOUSE = /villa|radhus|enfamiljshus|fritidshus|parhus|\bhus\b|egnahem/;

/** The picture's name for an event, the most specific first; the caller falls back from there */
export function illustrationKeys(event: IllustrationEvent): string[] {
  const kind = (event.originalType ?? '').toLowerCase();
  const text = `${event.title ?? ''} ${event.description ?? ''}`.toLowerCase();
  const type = event.type ?? '';

  if (/sammanfattning/.test(kind)) return ['natt', 'polisinsats'];
  if (type === 'crisis') return ['vma'];
  if (type === 'ambulance') return ['ambulans'];

  if (/brand/.test(kind) || type === 'fire') {
    if (has(text, BUILDING_FLAT)) return ['brand-lagenhet', 'brand'];
    if (has(text, /bilbrand|personbil|\bbil\b|bilen|fordon|lastbil|buss/)) return ['brand-bil', 'brand'];
    if (has(text, /container|sopkärl|soprum|papperskorg|återvinning|sopor/)) return ['brand-container', 'brand'];
    if (has(text, /skog|gräs|terräng|vass|markbrand|åker/)) return ['brand-skog', 'brand'];
    if (has(text, /industri|lager|fabrik|verkstad|lokal|företag|skola/)) return ['brand-industri', 'brand'];
    if (has(text, BUILDING_HOUSE)) return ['brand-villa', 'brand'];
    return ['brand'];
  }
  if (/trafikolycka|viltolycka/.test(kind) || (type === 'traffic' && /olycka|krock|kollision/.test(text))) {
    if (/vilt/.test(kind) || has(text, /\bälg|rådjur|vildsvin|\bvilt|\bhjort|\bren\b/)) return ['trafik-vilt', 'trafikolycka'];
    if (/singel/.test(kind) || has(text, /\bdike|singelolycka|av vägen/)) return ['trafik-singel', 'trafikolycka'];
    if (has(text, /lastbil|långtradare|\bbuss/)) return ['trafik-lastbil', 'trafikolycka'];
    if (has(text, /\be\s?\d{1,2}\b|motorväg|riksväg|länsväg|väg \d+/)) return ['trafik-motorvag', 'trafikolycka'];
    if (has(text, /korsning|rondell|cykel|cyklist|gående|övergångsställe|centrum|gatan|vägen/)) return ['trafik-stad', 'trafikolycka'];
    return ['trafikolycka'];
  }
  if (/trafikkontroll|rattfylleri|trafikbrott|olovlig körning|^kontroll/.test(kind)) return ['trafikkontroll', 'polisinsats'];
  if (/trafikhinder/.test(kind) || type === 'trafikverket') return ['trafikhinder', 'vagarbete'];
  if (/inbrott/.test(kind)) {
    if (has(text, BUILDING_HOUSE)) return ['inbrott-villa', 'inbrott'];
    if (has(text, /lägenhet|källar|förråd|trapphus|vind/)) return ['inbrott-lagenhet', 'inbrott'];
    if (has(text, /butik|affär|kiosk|restaurang|skola|lokal|företag|bensinstation|tobak/)) return ['inbrott-butik', 'inbrott'];
    return ['inbrott'];
  }
  if (/motorfordon/.test(kind) || (/stöld/.test(kind) && has(text, /\bbil\b|bilen|fordon|cykel|moped|båt/))) return ['stold-fordon', 'stold'];
  if (/stöld|häleri/.test(kind)) return ['stold'];
  if (/rån/.test(kind)) return has(text, /butik|affär|kiosk|bensinstation|tobak|restaurang|bank|växlingskontor|apotek/) ? ['ran', 'inbrott-butik', 'polisinsats'] : ['ran', 'polisinsats'];
  if (/skottlossning|mord|dråp/.test(kind) || has(text, /skottlossning|skott avlossats/)) return ['skottlossning', 'polisinsats'];
  if (/explosion|sprängning|detonation/.test(kind)) return ['sprangning', 'skottlossning', 'polisinsats'];
  if (/farligt föremål/.test(kind)) return ['farligt-foremal', 'polisinsats'];
  if (/misshandel|bråk|knivlagen/.test(kind)) return ['misshandel', 'polisinsats'];
  if (/olaga hot|ofredande|våld\/hot|tjänsteman|sexualbrott|olaga intrång/.test(kind)) return ['hot', 'polisinsats'];
  if (/narkotika/.test(kind)) return ['narkotika', 'polisinsats'];
  if (/fylleri/.test(kind)) return ['fylleri', 'polisinsats'];
  if (/bedrägeri/.test(kind)) return ['bedrageri'];
  if (/skadegörelse/.test(kind)) return ['skadegorelse', 'polisinsats'];
  if (/försvunnen/.test(kind)) return ['forsvunnen', 'polisinsats'];
  if (/arbetsplatsolycka/.test(kind)) return ['arbetsplatsolycka', 'ambulans'];
  if (/drunkning|sjöräddning/.test(kind) || has(text, /drunkn|genom isen|sjönk|båt/)) return ['vatten'];
  if (/djur/.test(kind)) return ['djur', 'polisinsats'];
  return ['polisinsats'];
}

/** The family of a picture's name, for the last fallback: brand-lagenhet → brand, trafik-stad → trafikolycka */
const familyOf = (key: string) => (key.startsWith('trafik-') ? 'trafikolycka' : key.split('-')[0]);

// Which picture of a family stands in for the others first: the most general-looking one
const FAMILY_ORDER: Record<string, string[]> = {
  brand: ['brand-lagenhet', 'brand-villa', 'brand-industri', 'brand-bil', 'brand-container', 'brand-skog'],
  trafikolycka: ['trafik-stad', 'trafik-motorvag', 'trafik-singel', 'trafik-vilt', 'trafik-lastbil'],
  inbrott: ['inbrott-villa', 'inbrott-lagenhet', 'inbrott-butik'],
};

// Where the action is in a picture, for the wide banners that show only a band of it
// (CSS object-position); the rest have it a little below the middle
const FOCUS: Record<string, string> = { 'brand-lagenhet': '50% 28%', 'trafik-motorvag': '50% 45%', 'inbrott-lagenhet': '50% 50%', natt: '50% 50%', trafikkontroll: '50% 52%', 'trafik-vilt': '50% 66%' };
const DEFAULT_FOCUS = '50% 62%';

/** The part of a picture to keep in view when it is cropped, by its URL */
export function illustrationFocus(url: string, available: Record<string, string> = ILLUSTRATIONS): string {
  const key = Object.keys(available).find((k) => available[k] === url);
  return (key && FOCUS[key]) || DEFAULT_FOCUS;
}

/** The picture for an event, or null when there is none to show */
export function illustrationFor(event: IllustrationEvent, available: Record<string, string> = ILLUSTRATIONS): string | null {
  const day = inDaylight(event.time);
  // The daylight picture of a name in daylight, else the night one
  const pick = (key: string) => (day && available[`${key}-dag`]) || available[key] || null;
  const keys = illustrationKeys(event);
  for (const key of keys) { const url = pick(key); if (url) return url; }
  // Any picture of the same kind: a car fire may show a fire in a flat until there is one of a car
  const family = familyOf(keys[0]);
  const order = FAMILY_ORDER[family] ?? [];
  const related = Object.keys(available).filter((k) => !k.endsWith('-dag') && familyOf(k) === family)
    .sort((a, b) => ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99) || a.localeCompare(b));
  if (related.length) return pick(related[0]);
  // Police cars on a street stand in for any police event without a picture of its own
  for (const key of ['polisinsats', 'misshandel', 'ovrigt']) { const url = pick(key); if (url) return url; }
  return null;
}
