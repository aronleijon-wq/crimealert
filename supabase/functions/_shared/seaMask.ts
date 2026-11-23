// Where the sea is around Sweden (data/sea.ts, from OpenStreetMap's coastline), so a marker is
// never put in it: a place that lies in the sea (an island's middle, a kommun's centre in the
// archipelago) moves to the nearest land, and a marker spread from its place only lands on land.
// Lakes and rivers are not in the data; the spread is small enough that they are seldom reached.
import { SEA } from './data/sea.ts';
import { spreadPoint } from './geoPlace.ts';

/**
 * The payload is every row's crossings — a count, then the crossings as deltas of each other —
 * as varints, deflated and base64 (scripts/build-sea.cjs). It is read once, when the module is
 * loaded, because the whole mask rides inside every edge function's upload.
 */
const varint = (bytes: Uint8Array, at: { i: number }): number => {
  let z = 0, shift = 0;
  for (;;) {
    const c = bytes[at.i++];
    z |= (c & 127) << shift;
    if (!(c & 128)) break;
    shift += 7;
  }
  return z;
};

async function decode(): Promise<{ offsets: Uint32Array; cells: Uint16Array }> {
  const bin = atob(SEA.payload);
  const packed = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) packed[i] = bin.charCodeAt(i);
  const bytes = new Uint8Array(
    await new Response(
      new ReadableStream({ start(c) { c.enqueue(packed); c.close(); } })
        .pipeThrough(new DecompressionStream('deflate')),
    ).arrayBuffer(),
  );
  const at = { i: 0 };
  const offsets = new Uint32Array(SEA.rows + 1);
  const cells: number[] = [];
  for (let r = 0; r < SEA.rows; r++) {
    const n = varint(bytes, at);
    offsets[r + 1] = offsets[r] + n;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      prev += varint(bytes, at);
      cells.push(prev);
    }
  }
  return { offsets, cells: Uint16Array.from(cells) };
}

const decoded = await decode();

const mask = () => decoded;

/** Whether a point lies in the sea (within 50 m or so) */
export function inSea(lat: number, lng: number): boolean {
  if (!(lat >= SEA.south && lat < SEA.north && lng >= SEA.west && lng < SEA.east)) return false;
  const { offsets, cells } = mask();
  const r = Math.floor((lat - SEA.south) / SEA.dLat);
  const c = (lng - SEA.west) / SEA.dLng;
  let n = 0;
  for (let i = offsets[r]; i < offsets[r + 1] && cells[i] <= c; i++) n++;
  return n % 2 === 1;
}

const move = (lat: number, lng: number, m: number, angle: number) => ({
  lat: lat + (m * Math.cos(angle)) / 111_320,
  lng: lng + (m * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180)),
});

/** The point itself on land; in the sea, the nearest land within 3 km (else the point as it is) */
export function landPoint(lat: number, lng: number): { lat: number; lng: number } {
  if (!inSea(lat, lng)) return { lat, lng };
  for (let m = 50; m <= 3000; m += 50) {
    for (let k = 0; k < 16; k++) {
      const p = move(lat, lng, m, (k / 16) * 2 * Math.PI);
      if (!inSea(p.lat, p.lng)) return p;
    }
  }
  return { lat, lng };
}

/**
 * Where an event's marker goes. With named places nearby (`nearby`, from the gazetteer: districts,
 * squares and villages, all on land), one of them in the event's own choice, 15–50 m from its
 * point: lakes and rivers are not in the sea data, but the gazetteer's places are never in them.
 * Without, its place on land moved 60–300 m in its own direction (geoPlace.spreadPoint); when
 * that lies in the sea, other directions and then shorter moves are tried, else the place itself.
 */
export function markerPoint(id: string, lat: number, lng: number, nearby: [number, number][] = []): { lat: number; lng: number } {
  const base = landPoint(lat, lng);
  if (nearby.length) {
    // The place itself is one of the choices, so events also stay at their own place
    const choices: [number, number][] = [[base.lat, base.lng], ...nearby];
    const [pLat, pLng] = choices[pick(id, choices.length)];
    for (const k of [0, 2, -2, 4]) {
      const p = spreadPoint(id, pLat, pLng, 15, 50, (k * Math.PI) / 4);
      if (!inSea(p.lat, p.lng)) return p;
    }
    return { lat: pLat, lng: pLng };
  }
  for (const scale of [1, 0.5]) {
    for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const p = spreadPoint(id, base.lat, base.lng, undefined, undefined, (k * Math.PI) / 4, scale);
      if (!inSea(p.lat, p.lng)) return p;
    }
  }
  return base;
}

/** A number below n that is the same for an id every time */
function pick(id: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}

/**
 * The places within 60–350 m of a point, from a kommun's gazetteer, for markerPoint: close
 * enough to be the same place, far enough apart that events there don't sit on each other.
 */
export function placesNear(lat: number, lng: number, places: [string, number, number, string][]): [number, number][] {
  const out: [number, number][] = [];
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (const [, pLat, pLng] of places) {
    const dy = (pLat - lat) * 111.32;
    if (Math.abs(dy) > 0.35) continue;
    const km = Math.hypot(dy, (pLng - lng) * kx);
    if (km >= 0.06 && km <= 0.35 && !inSea(pLat, pLng)) out.push([pLat, pLng]);
  }
  return out;
}
