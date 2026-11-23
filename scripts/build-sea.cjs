#!/usr/bin/env node
// Builds supabase/functions/_shared/data/sea.ts: where the sea is around Sweden, so map markers
// are never put in it (_shared/seaMask.ts).
//
// Data: OpenStreetMap's coastline via geo-maps (earth-seas-10m), (c) OpenStreetMap contributors, ODbL.
//
// Usage:
//   npm pack @geo-maps/earth-seas-10m && tar xzf geo-maps-earth-seas-10m-*.tgz
//   node --max-old-space-size=6000 scripts/build-sea.cjs package/map.geo.json
//
// The sea becomes rows of CELL_M m: for each row of latitude, the cells where the sea starts and
// ends (an odd number of crossings west of a point means sea). The rows' crossings are stored as
// one deflated, base64'd stream of zigzag varints: a count, then the crossings as deltas.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const input = process.argv[2];
if (!input) throw new Error('Give the path to earth-seas-10m map.geo.json');
// The sea is stored as rows of this height. 50 m is finer than the coastline data itself is
// drawn (Natural Earth 10m), and the whole mask rides inside every edge function's upload, so
// the row height is a knob: SEA_CELL_M=100 node scripts/build-sea.cjs ...
const CELL_M = Number(process.env.SEA_CELL_M ?? 50);
// Strips of sea narrower than this many cells are left out of the mask: they cost crossings
// (and therefore bytes) but are too narrow to hide a marker. 1 keeps every strip.
const MIN_STRIP = Number(process.env.SEA_MIN_STRIP_CELLS ?? 1);
// Strips of sea lying entirely in foreign water are left out: dropping a whole strip keeps the
// parity, so the answer is unchanged everywhere else, and the crossings of Norway's coast are not
// worth the bytes. The west edge sits just outside the outermost Swedish place in the water, so
// every marker the gazetteer can produce still gets corrected; the east edge is the box itself.
const KEEP_W = Number(process.env.SEA_KEEP_W ?? 10.98);
const KEEP_E = Number(process.env.SEA_KEEP_E ?? 24.3);
// The box the mask covers. Markers only ever come from Swedish places, so the box is Sweden plus
// the water around it: what falls outside it is read as land, so the edges keep a margin.
const S = Number(process.env.SEA_S ?? 55.0), N = Number(process.env.SEA_N ?? 69.2);
const W = Number(process.env.SEA_W ?? 10.5), E = Number(process.env.SEA_E ?? 24.3);
const dLat = CELL_M / 111320;
// One longitude step for every row (about 50 m at 62°N, finer further north, coarser south)
const dLng = CELL_M / (111320 * Math.cos((62 * Math.PI) / 180));
const rows = Math.ceil((N - S) / dLat);
const cols = Math.ceil((E - W) / dLng);

const geo = JSON.parse(fs.readFileSync(input, 'utf8'));
const geoms = (geo.geometries ?? geo.features ?? [geo]).flatMap((g) => (g.type === 'GeometryCollection' ? g.geometries : [g.geometry ?? g]));
const cross = Array.from({ length: rows }, () => []);
for (const g of geoms) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const poly of polys) {
    if (!poly[0].some(([x, y]) => x >= W && x <= E && y >= S && y <= N)) continue;
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j], [x2, y2] = ring[i];
        if (y1 === y2) continue;
        const r0 = Math.max(0, Math.ceil((Math.min(y1, y2) - S) / dLat - 0.5));
        const r1 = Math.min(rows - 1, Math.ceil((Math.max(y1, y2) - S) / dLat - 0.5) - 1);
        for (let r = r0; r <= r1; r++) {
          const y = S + (r + 0.5) * dLat;
          cross[r].push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
    }
  }
}

const counts = new Uint16Array(rows);
const cells = [];
cross.forEach((xs, r) => {
  xs.sort((a, b) => a - b);
  const c = xs.map((x) => Math.max(0, Math.min(cols, Math.round((x - W) / dLng))));
  // A sliver of sea narrower than MIN_STRIP cells is left out, and so is a whole strip of foreign
  // water: dropping the pair keeps the parity for every point outside it
  const dropW = Math.round((KEEP_W - W) / dLng), dropE = Math.round((KEEP_E - W) / dLng);
  for (let i = 0; i + 1 < c.length; i += 2) {
    if (c[i + 1] - c[i] < MIN_STRIP) continue;
    if (c[i + 1] <= dropW || c[i] >= dropE) continue;
    cells.push(c[i], c[i + 1]); counts[r] += 2;
  }
});

// The payload: for every row, its number of crossings and then the crossings as deltas of each
// other (they are sorted, so the deltas are small and never negative), written as varints and
// deflated - the edge runtime's DecompressionStream reads 'deflate' but not 'brotli'.
const varint = (out, v) => { while (v > 127) { out.push((v & 127) | 128); v >>>= 7; } out.push(v); };
const body = [];
let off = 0;
for (let r = 0; r < rows; r++) {
  varint(body, counts[r]);
  let prev = 0;
  for (let i = 0; i < counts[r]; i++) { const v = cells[off + i]; varint(body, v - prev); prev = v; }
  off += counts[r];
}
const payload = zlib.deflateSync(Buffer.from(body), { level: 9 }).toString('base64');
const out = `// GENERATED FILE - do not edit by hand. Built by scripts/build-sea.cjs from OpenStreetMap's
// coastline (geo-maps earth-seas-10m), (c) OpenStreetMap contributors, ODbL.
// The sea around Sweden in rows of ${CELL_M} m; read by _shared/seaMask.ts.
// The payload is every row's crossings (a count, then the crossings as deltas of each other) as
// zigzag varints, deflated and base64.

export const SEA = {
  south: ${S}, north: ${N}, west: ${W}, east: ${E},
  dLat: ${dLat}, dLng: ${dLng}, rows: ${rows},
  /** The crossings, in cells east of \`west\`: see the note above */
  payload: '${payload}',
};
`;
const target = path.join(__dirname, '../supabase/functions/_shared/data/sea.ts');
fs.writeFileSync(target, out);
console.log(`${rows} rows, ${cells.length} crossings, ${(out.length / 1e6).toFixed(2)} MB -> ${target}`);
