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
// The sea becomes rows of 50 m: for each row of latitude, the cells where the sea starts and ends
// (an odd number of crossings west of a point means sea). Stored as two base64 Uint16 arrays: the
// number of crossings per row, and the crossings themselves.
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) throw new Error('Give the path to earth-seas-10m map.geo.json');
const CELL_M = 50;
const S = 55.0, N = 69.2, W = 10.5, E = 24.3;
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
  // A sliver of sea narrower than a cell is left out
  for (let i = 0; i + 1 < c.length; i += 2) if (c[i + 1] > c[i]) { cells.push(c[i], c[i + 1]); counts[r] += 2; }
});
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const out = `// GENERATED FILE - do not edit by hand. Built by scripts/build-sea.cjs from OpenStreetMap's
// coastline (geo-maps earth-seas-10m), (c) OpenStreetMap contributors, ODbL.
// The sea around Sweden in rows of ${CELL_M} m; read by _shared/seaMask.ts.

export const SEA = {
  south: ${S}, north: ${N}, west: ${W}, east: ${E},
  dLat: ${dLat}, dLng: ${dLng}, rows: ${rows},
  /** Crossings per row, Uint16 little-endian, base64 */
  counts: '${b64(counts)}',
  /** The crossings, in cells east of \`west\`, Uint16 little-endian, base64 */
  cells: '${b64(Uint16Array.from(cells))}',
};
`;
const target = path.join(__dirname, '../supabase/functions/_shared/data/sea.ts');
fs.writeFileSync(target, out);
console.log(`${rows} rows, ${cells.length} crossings, ${(out.length / 1e6).toFixed(2)} MB -> ${target}`);
