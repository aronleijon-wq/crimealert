import { SWEDISH_MUNICIPALITIES } from '../data/municipalities.ts';
import { SWEDISH_COUNTIES } from '../data/counties.ts';

export interface Place {
  name: string;
  kind: 'kommun' | 'län' | 'land';
  lat: number | null;
  lng: number | null;
}

// Municipality names that are also ordinary words or first names. They only count as a place
// in phrases like "i Vara", "från Boden" or "Mark kommun".
const AMBIGUOUS = new Set(['Vara', 'Mark', 'Ale', 'Kil', 'Boden', 'Nora', 'Habo', 'Bjuv', 'Ydre']);
const PLACE_PREPOSITIONS = '(?:i|I|från|Från|utanför|Utanför|vid|Vid|norr om|söder om|öster om|väster om)\\s+';

const COUNTRY_NAMES = ['hela landet', 'hela sverige', 'sverige', 'nationell', 'nationellt'];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Matcher {
  place: Place;
  pattern: RegExp;
}

// Longest names first so "Lilla Edet" or "Upplands Väsby" win over shorter names inside them
const kommunMatchers: Matcher[] = [...SWEDISH_MUNICIPALITIES]
  .sort((a, b) => b.name.length - a.name.length)
  .map((m) => {
    const name = escapeRegex(m.name);
    // Allow the genitive ("Göteborgs hamn") unless the name already ends in s
    const genitive = m.name.endsWith('s') ? '' : 's?';
    const source = AMBIGUOUS.has(m.name)
      ? `(?:(?<=${PLACE_PREPOSITIONS})${name}|${name}(?=\\s+kommun))(?![\\p{L}\\p{N}])`
      : `(?<![\\p{L}\\p{N}])${name}${genitive}(?![\\p{L}\\p{N}])`;
    return {
      place: { name: m.name, kind: 'kommun', lat: m.lat, lng: m.lng },
      pattern: new RegExp(source, 'u'),
    };
  });

const countyMatchers: Matcher[] = SWEDISH_COUNTIES.map((c) => ({
  place: { name: c.name, kind: 'län', lat: c.lat, lng: c.lng },
  pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(c.name)}(?![\\p{L}\\p{N}])`, 'iu'),
}));

/**
 * The place a free text (headline, summary) is about: the municipality mentioned first,
 * else a county, else null.
 */
export function findPlace(text: string): Place | null {
  // County names contain municipality names ("Stockholms län"), so blank them out first
  let county: Place | null = null;
  let rest = text;
  for (const { place, pattern } of countyMatchers) {
    const match = pattern.exec(rest);
    if (!match) continue;
    county ??= place;
    rest = rest.replace(new RegExp(pattern.source, 'giu'), (m) => ' '.repeat(m.length));
  }

  let best: { place: Place; index: number } | null = null;
  for (const { place, pattern } of kommunMatchers) {
    const match = pattern.exec(rest);
    if (match && (!best || match.index < best.index)) best = { place, index: match.index };
  }
  return best?.place ?? county;
}

/**
 * A place from an area label such as "Stockholms län", "Västerås kommun", "Gotland" or
 * "Hela landet". National labels return a place without coordinates.
 */
export function placeFromAreaName(areaName: string | null | undefined): Place | null {
  const label = String(areaName ?? '').trim();
  if (!label) return null;
  const lower = label.toLowerCase();
  if (COUNTRY_NAMES.includes(lower)) return { name: 'Hela landet', kind: 'land', lat: null, lng: null };

  const county = SWEDISH_COUNTIES.find((c) => c.name.toLowerCase() === lower || c.name.toLowerCase() === `${lower} län`);
  if (county) return { name: county.name, kind: 'län', lat: county.lat, lng: county.lng };

  const kommunName = lower.replace(/\s+(kommun|stad)$/, '');
  const kommun = SWEDISH_MUNICIPALITIES.find((m) => m.name.toLowerCase() === kommunName);
  if (kommun) return { name: kommun.name, kind: 'kommun', lat: kommun.lat, lng: kommun.lng };

  return findPlace(label);
}

export function countyByCode(code: number): Place | null {
  const county = SWEDISH_COUNTIES.find((c) => c.code === code);
  return county ? { name: county.name, kind: 'län', lat: county.lat, lng: county.lng } : null;
}
