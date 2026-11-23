// Where on the map a police event goes. Polisen's API gives the kommun (often only its centre);
// the place itself is in the text: a street, a crossing, a road or the name of an area. This
// finds the names in the text, in order of how precise they are, checks a geocoder's answer
// against the event's kommun, and spreads markers so events at one place don't sit on top of
// each other. Used by police-events (server) and lib/mapMarkers (the maps).

export type Precision = 'street' | 'district' | 'api' | 'area';
export type CandidateKind = 'crossing' | 'street' | 'road' | 'area';

export interface PlaceCandidate {
  /** What to look up, e.g. "Sätragatan/Årsundavägen", "Storgatan 12", "Rosengård" */
  name: string;
  kind: CandidateKind;
}

/** How precise each kind of position is: higher is better */
export const PRECISION_RANK: Record<string, number> = { street: 4, district: 3, api: 2, area: 1 };
export const rank = (p: string | null | undefined) => PRECISION_RANK[p ?? ''] ?? 0;

/** What a found name gives: a street or crossing is street precision, an area district */
export const precisionOf = (kind: CandidateKind): Precision => (kind === 'area' ? 'district' : 'street');

const SUFFIX =
  '(?:gatan|vägen|väg|gata|torget|torg|platsen|plan|allén|stigen|gränd|gränden|backen|leden|led|bron|kajen|esplanaden|promenaden|parken|ringen|slingan|strand|stranden)';
const WORD = '[A-ZÅÄÖÉ][a-zåäöéü]+';
const word = '[a-zåäöéü]+';
// Polisen's texts sometimes start Å, Ä and Ö in lower case ("öjungsvägen"); streets may too
const STREET_WORD = '[A-ZÅÄÖÉåäö][a-zåäöéü]+';
// Not inside a word: JavaScript's \b doesn't know å, ä and ö
const START = '(?<![A-Za-zÅÄÖÉåäöéü])';

// Capitalised words that are not places (sentence words, institutions, chains, times)
const NOT_PLACES = new Set(
  `polisen polis polisens räddningstjänsten ambulans ambulansen sjukhus sjukhuset trafikverket sos länsstyrelsen kommunen
  sverige sveriges norden europa
  ica coop willys lidl hemköp netto systembolaget circle preem okq8 st1 ingo max mcdonalds burger biltema jula clas ikea
  mannen kvinnan personen föraren en ett den det de han hon man kvinna person flera två tre
  måndag tisdag onsdag torsdag fredag lördag söndag måndagen tisdagen onsdagen torsdagen fredagen lördagen söndagen
  januari februari mars april maj juni juli augusti september oktober november december
  morgonen förmiddagen eftermiddagen kvällen natten helgen
  centrum centrala city staden stan området orten länet kommun norra södra östra västra uppdatering media
  trafikverket trafikverkets polisområde region sos-larm larm
  brottsplatsen olycksplatsen arbetsplatsen parkeringsplatsen hållplatsen busshållplatsen platsen
  skåne halland blekinge småland öland östergötland västergötland bohuslän dalsland värmland närke västmanland
  uppland södermanland dalarna gästrikland hälsingland härjedalen jämtland medelpad ångermanland västerbotten norrbotten lappland`
    .split(/\s+/)
    .filter(Boolean),
);

// Words that only describe, on their own (with a name after them, "Stora Forssa", they are kept)
const ADJECTIVES = new Set('stora lilla gamla nya norra södra östra västra övre nedre inre yttre'.split(' '));

/** The kommun's own name and the like are no help: they are where the event already is */
const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * The places named in an event's title and text, most precise first: crossings, streets with
 * a number, streets, roads, then areas ("i Rosengård", "nära Vikingstad", "Vallrun, …").
 * The kommun itself and län names are left out.
 */
export function placeCandidates(text: string, kommun?: string | null): PlaceCandidate[] {
  if (!text) return [];
  const own = new Set([kommun, kommun && `${kommun}s`].filter(Boolean).map((k) => norm(k as string)));
  const found: (PlaceCandidate & { order: number; at: number })[] = [];
  const add = (name: string, kind: CandidateKind, order: number, at: number) => {
    const clean = name.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
    const key = norm(clean);
    const first = key.split(' ')[0];
    if (clean.length < 3 || own.has(key) || NOT_PLACES.has(key) || NOT_PLACES.has(first) || /\blän$/.test(key)) return;
    // A word on its own that only describes ("på Stora gata" gave "Stora")
    if (kind === 'area' && ADJECTIVES.has(key)) return;
    // Nouns about people and things, not places ("Passageraren, en man …")
    if (kind === 'area' && /(aren|arna|erna|ingen|heten|andet|ationen)$/.test(first)) return;
    found.push({ name: clean, kind, order, at });
  };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let m: RegExpExecArray | null;

  // Crossings: "korsningen Sätragatan och årsundavägen", "hörnet Storgatan/Kungsgatan"
  const crossing = new RegExp(`(?:korsningen|hörnet|korsning)\\s+(?:av\\s+|mellan\\s+)?(${STREET_WORD}${SUFFIX})\\s*(?:/|och|-)\\s*(${STREET_WORD}${SUFFIX})|${START}(${STREET_WORD}${SUFFIX})\\s*/\\s*(${STREET_WORD}${SUFFIX})`, 'g');
  while ((m = crossing.exec(text))) add(`${cap(m[1] ?? m[3])}/${cap(m[2] ?? m[4])}`, 'crossing', 0, m.index);

  // Streets with a number, then streets: "Storgatan 15", "Tycho Hedéns väg", "Norra Järnvägsgatan"
  const street = new RegExp(
    `${START}((?:(?:Norra|Södra|Östra|Västra|Stora|Lilla|Gamla|Nya|S:t)\\s+)?${STREET_WORD}${SUFFIX}|(?:${WORD}\\s+){0,2}${WORD}s?\\s+(?:[Vv]äg|[Gg]ata|[Tt]org|[Pp]lan|[Gg]ränd|[Aa]llé|[Ss]trand|[Bb]acke))(?![a-zåäöéü])(\\s+\\d+[A-Za-z]?(?![A-Za-zÅÄÖåäö]))?`,
    'g',
  );
  while ((m = street.exec(text))) {
    const name = cap(m[1].trim());
    // Roads are found below, by their number
    if (/^(läns|riks)väg$/i.test(name) || /^(väg|gata|plan|torg|led)$/i.test(name)) continue;
    add(m[2] ? `${name} ${m[2].trim()}` : name, 'street', m[2] ? 1 : 2, m.index);
  }

  // Roads: "E4", "riksväg 50", "väg 632", "länsväg 691"
  const road = /\b(E\s?\d{1,2}|(?:riksväg|rv|länsväg|väg)\s+\d{2,4})\b/gi;
  while ((m = road.exec(text))) add(m[1].replace(/\s+/g, ' ').replace(/^e\s?/i, 'E').replace(/^rv /i, 'riksväg '), 'road', 4, m.index);

  // Areas after a preposition: "i Rosengård", "till Hageby", "nära Vikingstad", "söder om Åkersjön"
  const area = new RegExp(`(?:^|[\\s(])(i|på|vid|till|från|nära|utanför|i närheten av|i höjd med|strax (?:norr|söder|öster|väster) om|(?:norr|söder|öster|väster) om|mellan|i området|i stadsdelen|trafikplats|i korsningen vid)\\s+(${WORD}s\\s(?:kurva|industriområde|handelsområde|centrum|hamn|torg|park|strand)|(?:${WORD})(?:[-\\s](?:${WORD}))?)`, 'g');
  while ((m = area.exec(text))) {
    const name = m[2];
    if (new RegExp(`${SUFFIX}$`).test(name)) continue; // a street, found above
    // "en man från Rinkeby greps på Östermalm": where someone came from comes after where it happened
    add(name, 'area', m[1] === 'från' ? 5 : 3, m.index);
  }

  // A place first in the text, as Polisen often writes: "Vallrun, fyrhjulingsstöld …"
  const lead = new RegExp(`^\\s*(?:\\d{1,2}[:.]\\d{2},?\\s*)?((?:${WORD})(?:\\s(?:${WORD}))?),\\s`).exec(text);
  if (lead) add(lead[1], 'area', 3, lead.index);

  // Most precise first; within a kind, the first mentioned. An area that is only the start of a
  // street already found ("Hårds" from "Hårds väg") is dropped.
  const streets = found.filter((c) => c.kind !== 'area').map((c) => norm(c.name));
  const seen = new Set<string>();
  return found
    .filter((c) => c.kind !== 'area' || !streets.some((st) => st.startsWith(`${norm(c.name)} `)))
    .sort((a, b) => a.order - b.order || a.at - b.at)
    .filter((c) => {
      const key = norm(c.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ name, kind }) => ({ name, kind }));
}

/** Distance in kilometres */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const x = (lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return 6371 * Math.hypot(x, y);
}

/** "Sundsvalls kommun", "Region Gotland", "Stockholms stad" → "sundsvall", "gotland", "stockholm" */
export function kommunKey(name: string | null | undefined): string {
  return norm(name ?? '')
    .replace(/^region\s+/, '')
    .replace(/\s+(kommun|stad|municipality)$/, '')
    .trim();
}

/** Whether a geocoder's municipality is the event's kommun ("Sundsvalls kommun" is Sundsvall) */
export function sameKommun(found: string | null | undefined, kommun: string | null | undefined): boolean {
  const a = kommunKey(found);
  const b = kommunKey(kommun);
  if (!a || !b) return false;
  return a === b || a === `${b}s` || `${a}s` === b;
}

/** One answer from Nominatim (format=jsonv2, addressdetails=1), the fields used here */
export interface GeocodeHit {
  lat: string;
  lon: string;
  category?: string;
  class?: string;
  type?: string;
  address?: Record<string, string | undefined>;
}

/**
 * The first answer that lies in the event's kommun and is a real place (not the kommun's own
 * boundary). Without a municipality in the answer, it must be within maxKm of the kommun's centre.
 */
export function pickHit(
  hits: GeocodeHit[],
  kommun: string,
  centre: { lat: number; lng: number } | null,
  maxKm = 40,
): { lat: number; lng: number } | null {
  for (const h of hits) {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 55.3 || lat > 69.1 || lng < 10.9 || lng > 24.2) continue;
    const cls = h.category ?? h.class;
    if (cls === 'boundary' || h.type === 'administrative' || h.type === 'county' || h.type === 'state') continue;
    const municipality = h.address?.municipality ?? h.address?.city ?? h.address?.town;
    if (municipality && h.address?.municipality) {
      if (sameKommun(h.address.municipality, kommun)) return { lat, lng };
      continue;
    }
    if (centre && distanceKm(lat, lng, centre.lat, centre.lng) <= maxKm) return { lat, lng };
  }
  return null;
}

/** The query sent to the geocoder for a candidate in a kommun */
export function geocodeQuery(c: PlaceCandidate, kommun: string): string {
  const name = c.kind === 'crossing' ? c.name.split('/')[0] : c.name;
  return `${name}, ${kommun} kommun, Sverige`;
}

/** The key a learned place is stored under: kommun and name, lower case */
export const placeKey = (kommun: string, name: string) => `${kommunKey(kommun)}|${norm(name)}`;

/**
 * The position to keep: a fresh one, unless the archive already has a more precise one for the
 * event. A later fetch that couldn't look the place up must not move a placed event back to the
 * kommun's centre.
 */
export function keepBest<T extends { lat: number | null; lng: number | null; location_precision: string }>(
  fresh: T,
  archived: { lat: number | null; lng: number | null; location_precision: string } | undefined,
): T {
  if (!archived || archived.lat == null || archived.lng == null) return fresh;
  if (rank(archived.location_precision) > rank(fresh.location_precision)) {
    return { ...fresh, lat: archived.lat, lng: archived.lng, location_precision: archived.location_precision };
  }
  return fresh;
}

// ---- Spreading markers ----

/** FNV-1a with a final mix: the same number for the same id on every device */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mix the bits (MurmurHash3's finaliser), so ids that differ in one character land far apart
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const SPREAD_MIN_M = 60;
export const SPREAD_MAX_M = 300;

/**
 * A marker's position: the event's place moved 60–300 m in a direction of its own, the same
 * every time. Events at one place spread over the area instead of hiding each other, and a
 * street address is not shown to the metre. `turn` (radians) and `scale` give other positions
 * of the same kind, for when the first lies in the sea (seaMask.markerPoint).
 */
export function spreadPoint(id: string, lat: number, lng: number, minM = SPREAD_MIN_M, maxM = SPREAD_MAX_M, turn = 0, scale = 1): { lat: number; lng: number } {
  const h1 = hash(id);
  const h2 = hash(`${id}:r`);
  const angle = (h1 / 2 ** 32) * 2 * Math.PI + turn;
  // Even over the ring's area, not bunched at its inner edge
  const u = h2 / 2 ** 32;
  const d = Math.sqrt(minM * minM + u * (maxM * maxM - minM * minM)) * scale;
  const dLat = (d * Math.cos(angle)) / 111_320;
  const dLng = (d * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

// ---- The gazetteer: Sweden's named places per kommun (data/places.ts, from OpenStreetMap) ----

/** A place in the gazetteer: name, lat, lng and kind (c town, v village, h hamlet, s district, q square, i island, a industrial or retail area) */
export type GazetteerPlace = [string, number, number, string];

// Words after a name that only say what kind of place it is ("Lugnviks industriområde")
const GENERIC = /\s+(industriområde|handelsområde|centrum|hamn|park|strand|by|gård|torg|kurva)$/;

/** Names in a kommun's gazetteer, by their lower-case form */
export function gazetteerIndex(places: GazetteerPlace[] | undefined): Map<string, GazetteerPlace> {
  const index = new Map<string, GazetteerPlace>();
  for (const p of places ?? []) {
    const key = norm(p[0]);
    // The first of a name is the biggest kind (the data lists towns before hamlets)
    if (!index.has(key)) index.set(key, p);
  }
  return index;
}

/**
 * One index for all the kommuner of a län, for events Polisen only gives the län for. A name
 * found in more than one of them is left out, unless exactly one of them is a town ("Anderstorp"
 * the town, not a hamlet of the same name elsewhere in the län).
 */
export function lanGazetteerIndex(perKommun: (GazetteerPlace[] | undefined)[]): Map<string, GazetteerPlace> {
  const all = new Map<string, GazetteerPlace[]>();
  for (const places of perKommun) {
    for (const [key, p] of gazetteerIndex(places)) all.set(key, [...(all.get(key) ?? []), p]);
  }
  const index = new Map<string, GazetteerPlace>();
  for (const [key, list] of all) {
    const towns = list.filter((p) => p[3] === 'c');
    if (list.length === 1) index.set(key, list[0]);
    else if (towns.length === 1) index.set(key, towns[0]);
  }
  return index;
}

// How far from a named area a street in it can lie, by the area's kind in the gazetteer
const AREA_REACH_KM: Record<string, number> = { q: 2, a: 2, h: 2, s: 3, v: 4, c: 6, i: 10 };

export interface AreaAnchor { name: string; lat: number; lng: number; reachKm: number }

/**
 * The first area among an event's candidates that the gazetteer knows: the event happened there,
 * so a street it names must lie near it ("Kyrkvägen i Farsta" is not a Kyrkvägen in the city).
 */
export function areaAnchor(candidates: PlaceCandidate[], index: Map<string, GazetteerPlace>): AreaAnchor | null {
  for (const c of candidates) {
    if (c.kind !== 'area') continue;
    const p = gazetteerLookup(c.name, index);
    if (p) return { name: p[0], lat: p[1], lng: p[2], reachKm: AREA_REACH_KM[p[3]] ?? 3 };
  }
  return null;
}

/** Whether a position lies within the area an event names */
export const withinArea = (anchor: AreaAnchor, lat: number, lng: number) =>
  distanceKm(lat, lng, anchor.lat, anchor.lng) <= anchor.reachKm;

/** The gazetteer's place for a name in this kommun, also without a trailing kind word */
export function gazetteerLookup(name: string, index: Map<string, GazetteerPlace>): GazetteerPlace | null {
  const key = norm(name);
  return index.get(key) ?? index.get(key.replace(GENERIC, '').replace(/s$/, '')) ?? index.get(key.replace(GENERIC, '')) ?? null;
}

/**
 * Places from the kommun's gazetteer named anywhere in the text, also without "i" or "vid"
 * before them ("Polis åker till butiken, som ligger i Stenstan" and "Stenstan: bråk utomhus").
 * Only capitalised names of four letters or more, so ordinary words aren't taken for places.
 */
// Where a sentence starts: the text's start, after . ! ? or a line break, or after a time ("10:27 ")
const SENTENCE_START = /(?:^|[.!?]\s+|\n\s*|\b\d{1,2}[:.]\d{2}\s+)$/;

export function gazetteerInText(text: string, index: Map<string, GazetteerPlace>, kommun?: string | null): PlaceCandidate[] {
  if (!text || !index.size) return [];
  const own = kommun ? norm(kommun) : '';
  const out: PlaceCandidate[] = [];
  const seen = new Set<string>();
  const words = [...text.matchAll(/[A-ZÅÄÖÉ][a-zåäöéü]+(?:-[A-ZÅÄÖÉ]?[a-zåäöéü]+)?/g)];
  for (let i = 0; i < words.length; i++) {
    // The longest name first: "Västra Hamnen" before "Västra"
    for (let n = 3; n >= 1; n--) {
      const group = words.slice(i, i + n);
      if (group.length < n) continue;
      // Only words next to each other in the text
      const start = group[0].index ?? 0;
      const last = group[n - 1];
      const phrase = text.slice(start, (last.index ?? 0) + last[0].length);
      if (n > 1 && !/^[^\n.,;:]+$/.test(phrase)) continue;
      const key = norm(phrase);
      if (key.length < 4 || key === own || seen.has(key) || NOT_PLACES.has(key) || ADJECTIVES.has(key)) continue;
      // A word that starts a sentence and goes on into it is an ordinary word ("Bilen hade",
      // "Elden spred sig"), not a place; "Vinslöv." and "Kölsillre, resultat" are places
      const end = (last.index ?? 0) + last[0].length;
      if (SENTENCE_START.test(text.slice(0, start)) && /^\s+[a-zåäöéü]/.test(text.slice(end))) continue;
      if (index.has(key)) {
        seen.add(key);
        out.push({ name: index.get(key)![0], kind: 'area' });
        i += n - 1;
        break;
      }
    }
  }
  return out;
}

export interface NamedPlace { name: string; lat: number; lng: number; kind: string }

/**
 * The place an event's text says it happened, when the gazetteer knows it: the first area or
 * square named ("på Östermalm", "vid Stureplan"; "från Rinkeby" comes last), else null.
 */
export function namedPlace(text: string, kommun: string | null, index: Map<string, GazetteerPlace>): NamedPlace | null {
  if (!text || !index.size) return null;
  const named = placeCandidates(text, kommun);
  const seen = new Set(named.map((c) => norm(c.name)));
  const known = gazetteerInText(text, index, kommun).filter((c) => !seen.has(norm(c.name)));
  for (const c of [...named, ...known]) {
    if (c.kind === 'road' || c.kind === 'crossing' || (c.kind === 'street' && /\d/.test(c.name))) continue;
    const p = gazetteerLookup(c.name, index);
    if (p) return { name: p[0], lat: p[1], lng: p[2], kind: p[3] };
  }
  // Polisen sometimes writes a place in lower case ("hem till henne på östermalm")
  for (const name of placesInLowerCase(text)) {
    const p = gazetteerLookup(name, index);
    if (p && LOWER_CASE_KINDS.has(p[3])) return { name: p[0], lat: p[1], lng: p[2], kind: p[3] };
  }
  return null;
}

// A place written in lower case is only taken when it is a district, square, town or village:
// hamlets and islands have names that are ordinary words too often
const LOWER_CASE_KINDS = new Set(['s', 'q', 'c', 'v']);
// Ordinary words after "i" and "på" that some place is also called ("i hemmet", "på berget")
const LOWER_CASE_WORDS = new Set(
  `hemmet bostaden lägenheten lägenhet huset villan platsen gatan vägen stan staden skolan bilen
  bussen tåget tunnelbanan pendeltåget stationen området centrum krogen butiken affären parken
  torget kontoret jobbet arbetet sjukhuset hallen källaren trapphuset entrén porten gården
  innergården natten kvällen morgonen dagen helgen berget skogen ängen sjön stranden hamnen
  marken backen dalen holmen udden viken bron kyrkan kyrkogården fältet slätten åkern lunden
  hagen höjden sluttningen centralen city vinden taket balkongen garaget förrådet tvättstugan
  parkeringen parkeringshuset restaurangen nattklubben baren puben caféet gymmet badet simhallen
  bensinstationen macken tunneln perrongen hållplatsen spåret motorvägen rondellen korsningen`.split(/\s+/).filter(Boolean),
);

/**
 * Names after "i", "på", "vid" and the like in any case, two words before one ("hammarby
 * sjöstad", "östermalm"), those after "från" last: for places Polisen writes in lower case.
 */
export function placesInLowerCase(text: string): string[] {
  const rx = /(?:^|[\s(,])(i|på|vid|till|från|nära|utanför|mot)\s+([a-zåäöéü][a-zåäöéü-]{3,})(?:\s+([a-zåäöéü][a-zåäöéü-]{2,}))?/gi;
  const here: string[] = [];
  const from: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const list = m[1].toLowerCase() === 'från' ? from : here;
    const first = m[2].toLowerCase();
    if (NOT_PLACES.has(first) || LOWER_CASE_WORDS.has(first)) continue;
    if (m[3]) list.push(`${m[2]} ${m[3]}`);
    list.push(m[2]);
  }
  return [...here, ...from];
}

/**
 * Where an event goes when its text names a place: a street found in that place stays; anything
 * vaguer (the kommun's centre, Polisen's own point, another area) moves to the place named.
 * Null when it stays where it is.
 */
export function placeByText<T extends { lat: number | null; lng: number | null; location_precision: string }>(
  inc: T, place: NamedPlace | null,
): { lat: number; lng: number; location_precision: Precision } | null {
  if (!place) return null;
  const precise = rank(inc.location_precision) >= rank('street');
  const reachKm = place.kind === 'q' ? 0.6 : place.kind === 's' ? 1.5 : 3;
  if (precise && inc.lat != null && inc.lng != null && distanceKm(inc.lat, inc.lng, place.lat, place.lng) <= reachKm) return null;
  if (!precise && inc.lat === place.lat && inc.lng === place.lng) return null;
  return { lat: place.lat, lng: place.lng, location_precision: place.kind === 'q' ? 'street' : 'district' };
}

/** Every named place in Sweden by its lower-case name, for nearestNamed */
export function nationalIndex(perKommun: Iterable<GazetteerPlace[] | undefined>): Map<string, GazetteerPlace[]> {
  const index = new Map<string, GazetteerPlace[]>();
  for (const places of perKommun) {
    for (const p of places ?? []) {
      const key = norm(p[0]);
      if (key.length < 4) continue;
      const list = index.get(key);
      if (list) list.push(p); else index.set(key, [p]);
    }
  }
  return index;
}

/**
 * The first of `names` that is a place within `maxKm` of a point, the nearest of that name:
 * for an event Polisen places at a district ("Östermalm") rather than a kommun, or whose text
 * names a place in the next kommun. Islands and hamlets of the name only when nothing else is.
 */
export function nearestNamed(names: string[], lat: number | null, lng: number | null, index: Map<string, GazetteerPlace[]>, maxKm = 40): NamedPlace | null {
  if (lat == null || lng == null) return null;
  for (const name of names) {
    const list = index.get(norm(name)) ?? index.get(norm(name).replace(GENERIC, ''));
    if (!list) continue;
    const near = list
      .map((p) => ({ p, km: distanceKm(lat, lng, p[1], p[2]) }))
      .filter((x) => x.km <= maxKm)
      .sort((a, b) => Number(['i', 'h'].includes(a.p[3])) - Number(['i', 'h'].includes(b.p[3])) || a.km - b.km);
    if (near.length) { const [n, pLat, pLng, kind] = near[0].p; return { name: n, lat: pLat, lng: pLng, kind }; }
  }
  return null;
}
