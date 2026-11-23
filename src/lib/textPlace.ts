// An event is shown in the area its text names: "Bedrägeri … på Östermalm" on Östermalm, not at
// Stockholm's centre in Gamla stan where the server may have left it. Done in the website and app
// when the events arrive (usePoliceEvents), from src/data/districts.json (built by
// scripts/build-districts.cjs: districts, squares, towns and villages per kommun, OpenStreetMap).
import {
  distanceKm, gazetteerIndex, nationalIndex, namedPlace, nearestNamed, placeCandidates, placesInLowerCase,
  type GazetteerPlace, type NamedPlace,
} from '../../supabase/functions/_shared/geoPlace';

export type Districts = Record<string, GazetteerPlace[]>;

let loading: Promise<Districts> | null = null;
/** The districts, loaded once, on their own (they are not in the page's main bundle) */
export const loadDistricts = (): Promise<Districts> => {
  loading ??= import('@/data/districts.json').then((m) => m.default as unknown as Districts).catch((e) => { loading = null; throw e; });
  return loading;
};

interface Placed { id: string; title: string; area: string; description: string; lat: number; lng: number; originalType?: string }

// How near the named place an event may already be and stay where it is (a street in the
// district, the server's own spread around it): by the kind of place
const NEAR_KM: Record<string, number> = { q: 0.4, s: 1.2, v: 1.5, c: 2.5 };

const indexes = new WeakMap<Districts, { kommuner: Map<string, string>; byKommun: Map<string, Map<string, GazetteerPlace>>; national: Map<string, GazetteerPlace[]> | null }>();
function lookups(data: Districts) {
  let l = indexes.get(data);
  if (!l) {
    l = { kommuner: new Map(Object.keys(data).map((k) => [k.toLowerCase(), k])), byKommun: new Map(), national: null };
    indexes.set(data, l);
  }
  return l;
}

/** The place an event's text (or Polisen's place for it, when that is a district) names, or null */
export function namedPlaceOf(inc: Placed, data: Districts): NamedPlace | null {
  const l = lookups(data);
  const label = (inc.title.split(',').pop() ?? '').trim() || inc.area;
  const kommun = l.kommuner.get(label.toLowerCase()) ?? l.kommuner.get(inc.area.toLowerCase()) ?? null;
  if (kommun) {
    let index = l.byKommun.get(kommun);
    if (!index) { index = gazetteerIndex(data[kommun]); l.byKommun.set(kommun, index); }
    const found = namedPlace(inc.description, kommun, index);
    if (found) return found;
  }
  // Polisen's place is a district ("…, Bedrägeri, Östermalm"), or the text names a place in the
  // next kommun: the nearest place of that name to where the event is now
  const isLan = /\slän$/i.test(label);
  const names = [
    ...(kommun || isLan ? [] : [label]),
    ...placeCandidates(inc.description, kommun).filter((c) => c.kind === 'area' || (c.kind === 'street' && !/\d/.test(c.name))).map((c) => c.name),
    ...placesInLowerCase(inc.description),
  ];
  if (!names.length) return null;
  l.national ??= nationalIndex(Object.values(data));
  return nearestNamed(names, inc.lat, inc.lng, l.national);
}

/** Where an event goes when its text names a place it isn't in, else null (it stays) */
export function placeFromText(inc: Placed, data: Districts): { lat: number; lng: number } | null {
  if (/sammanfattning/i.test(`${inc.originalType ?? ''} ${inc.title}`)) return null;
  const place = namedPlaceOf(inc, data);
  if (!place) return null;
  if (Number.isFinite(inc.lat) && Number.isFinite(inc.lng) && distanceKm(inc.lat, inc.lng, place.lat, place.lng) <= (NEAR_KM[place.kind] ?? 1)) return null;
  return { lat: place.lat, lng: place.lng };
}
