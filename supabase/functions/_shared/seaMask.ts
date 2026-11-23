// Where the sea is around Sweden (data/sea.ts, from OpenStreetMap's coastline), so a marker is
// never put in it: a place that lies in the sea (an island's middle, a kommun's centre in the
// archipelago) moves to the nearest land, and a marker spread from its place only lands on land.
// Lakes and rivers are not in the data; the spread is small enough that they are seldom reached.
import { SEA } from './data/sea.ts';
import { spreadPoint } from './geoPlace.ts';

let decoded: { offsets: Uint32Array; cells: Uint16Array } | null = null;

const uint16s = (b64: string): Uint16Array => {
  const bin = atob(b64);
  const out = new Uint16Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
  return out;
};

function mask() {
  if (!decoded) {
    const counts = uint16s(SEA.counts);
    const offsets = new Uint32Array(SEA.rows + 1);
    for (let r = 0; r < SEA.rows; r++) offsets[r + 1] = offsets[r] + counts[r];
    decoded = { offsets, cells: uint16s(SEA.cells) };
  }
  return decoded;
}

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
 * Where an event's marker goes: its place on land, moved 60–300 m in its own direction
 * (geoPlace.spreadPoint). When that lies in the sea, other directions and then shorter moves are
 * tried; with no land around, the place itself.
 */
export function markerPoint(id: string, lat: number, lng: number): { lat: number; lng: number } {
  const base = landPoint(lat, lng);
  for (const scale of [1, 0.5]) {
    for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const p = spreadPoint(id, base.lat, base.lng, undefined, undefined, (k * Math.PI) / 4, scale);
      if (!inSea(p.lat, p.lng)) return p;
    }
  }
  return base;
}
