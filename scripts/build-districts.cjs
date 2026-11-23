#!/usr/bin/env node
// Builds src/data/districts.json: the named places the website and app use to put an event in
// the area its text names ("på Östermalm"), when the server has left it at the kommun's centre.
// From supabase/functions/_shared/data/places.ts (OpenStreetMap, ODbL) and data/landmarks.ts:
// districts and squares, towns and villages; not hamlets, islands or industrial areas, to keep
// it small (it is loaded with the events).
//
// Usage: node scripts/build-districts.cjs
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../supabase/functions/_shared/data');
/** The object literal after `export const NAME ... =`, read as JSON (the data files are JSON-shaped) */
function objectFrom(file, name) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const start = src.indexOf('{', src.indexOf(`export const ${name}`));
  let depth = 0, end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  const body = src.slice(start, end)
    .replace(/\/\/[^\n]*/g, '')                // comments
    .replace(/'/g, '"')                          // single quotes
    .replace(/([{,]\s*)([A-Za-zÅÄÖåäö][\wÅÄÖåäö-]*)\s*:/g, '$1"$2":') // bare keys
    .replace(/,(\s*[\]}])/g, '$1');              // trailing commas
  return JSON.parse(body);
}

const places = objectFrom('places.ts', 'PLACES');
const landmarks = objectFrom('landmarks.ts', 'LANDMARKS');
const KEEP = new Set(['s', 'q', 'c', 'v']);
const out = {};
for (const kommun of Object.keys(places).sort((a, b) => a.localeCompare(b, 'sv'))) {
  const list = [...(landmarks[kommun] ?? []), ...places[kommun]]
    .filter((p) => KEEP.has(p[3]))
    .map(([name, lat, lng, kind]) => [name, +lat.toFixed(4), +lng.toFixed(4), kind]);
  if (list.length) out[kommun] = list;
}
const target = path.join(__dirname, '../src/data/districts.json');
fs.writeFileSync(target, JSON.stringify(out));
console.log(`${Object.keys(out).length} kommuner, ${Object.values(out).reduce((n, l) => n + l.length, 0)} places, ${(fs.statSync(target).size / 1e3).toFixed(0)} kB -> ${target}`);
