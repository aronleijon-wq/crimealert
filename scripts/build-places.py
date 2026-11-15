#!/usr/bin/env python3
"""Build supabase/functions/_shared/data/places.ts, a Swedish place gazetteer, from OpenStreetMap.

Data: OpenStreetMap via the Overpass API (https://overpass-api.de), © OpenStreetMap contributors, ODbL.

Usage:
    pip install shapely
    python3 scripts/build-places.py [--cache DIR]

Overpass responses are cached as JSON in --cache (default: .overpass-cache, not committed), so a
rerun does not hit the API again. Delete the cache to refresh the data.

The 290 kommun names are read from src/data/kommuner.ts (SWEDISH_KOMMUNER), which is the full list
as the app writes them; supabase/functions/_shared/data/municipalities.ts only holds a subset.
"""
import argparse
import datetime
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from shapely import STRtree, points
from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, polygonize, unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KOMMUN_LIST = os.path.join(ROOT, 'src/data/kommuner.ts')
OUT = os.path.join(ROOT, 'supabase/functions/_shared/data/places.ts')
OVERPASS = 'https://overpass-api.de/api/interpreter'

SE = 'area["ISO3166-1"="SE"][admin_level=2]->.se;'
QUERIES = {
    'kommuner': '[out:json][timeout:300];' + SE + '''
rel(area.se)[boundary=administrative][admin_level=7]->.k;
.k out geom;
node(r.k:"admin_centre");
out;''',
    'places': '[out:json][timeout:300];' + SE + '''
nwr(area.se)[place~"^(city|town|village|hamlet|suburb|quarter|neighbourhood|square|borough|city_block|island|islet)$"][name];
out center tags;''',
    'areas': '[out:json][timeout:300];' + SE + '''
nwr(area.se)[landuse~"^(industrial|retail)$"][name];
out center tags;''',
}

# OSM tag value -> abbreviation used in places.ts
ABBR = {
    'city': 'c', 'town': 'c', 'village': 'v', 'hamlet': 'h',
    'suburb': 's', 'borough': 's', 'quarter': 's', 'neighbourhood': 's', 'city_block': 's',
    'square': 'q', 'island': 'i', 'islet': 'i', 'industrial': 'a', 'retail': 'a',
}
# "Bigger" types first; used for ordering and for choosing which duplicate wins.
RANK = {t: i for i, t in enumerate([
    'city', 'town', 'borough', 'suburb', 'village', 'quarter', 'island', 'hamlet',
    'neighbourhood', 'industrial', 'retail', 'islet', 'city_block', 'square'])}
DUP_KM = 3.0


def fetch(name, query, cache):
    path = os.path.join(cache, name + '.json')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    body = urllib.parse.urlencode({'data': query}).encode()
    wait = 60
    for attempt in range(8):
        try:
            req = urllib.request.Request(OVERPASS, data=body, headers={'User-Agent': 'crimealert-gazetteer/1.0'})
            with urllib.request.urlopen(req, timeout=400) as r:
                data = json.load(r)
            if 'remark' in data and not data.get('elements'):
                raise RuntimeError('Overpass remark: ' + data['remark'])
            os.makedirs(cache, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f)
            return data
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504):
                raise
            print(f'  {name}: HTTP {e.code}, waiting {wait}s', file=sys.stderr)
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            print(f'  {name}: {e}, waiting {wait}s', file=sys.stderr)
        time.sleep(wait)
        wait = min(wait * 2, 600)
    raise SystemExit(f'Overpass query {name} failed')


def read_kommun_names():
    src = open(KOMMUN_LIST, encoding='utf-8').read()
    block = re.search(r'SWEDISH_KOMMUNER: string\[\] = \[(.*?)\];', src, re.S).group(1)
    names = re.findall(r"'([^']+)'", block)
    assert len(names) == 290 and len(set(names)) == 290, len(names)
    return names


def osm_to_app_name(osm_name, wanted):
    """'Sundsvalls kommun' -> 'Sundsvall', 'Region Gotland' -> 'Gotland', 'Falu kommun' -> 'Falun'."""
    base = osm_name
    if base.startswith('Region '):
        base = base[len('Region '):]
    elif base.endswith(' kommun'):
        base = base[:-len(' kommun')]
    else:
        return None
    for cand in (base, base[:-1] if base.endswith('s') else None, base + 'n'):
        if cand and cand in wanted:
            return cand
    lowered = {w.lower().replace('-', ' '): w for w in wanted}
    for cand in (base, base[:-1] if base.endswith('s') else base):
        hit = lowered.get(cand.lower().replace('-', ' '))
        if hit:
            return hit
    return None


def ring_polys(ways):
    lines = [LineString([(p['lon'], p['lat']) for p in w]) for w in ways if len(w) >= 2]
    if not lines:
        return []
    return list(polygonize(linemerge(lines)))


def relation_polygon(rel):
    outer = [m['geometry'] for m in rel.get('members', []) if m['type'] == 'way' and m.get('role') in ('outer', '') and 'geometry' in m]
    inner = [m['geometry'] for m in rel.get('members', []) if m['type'] == 'way' and m.get('role') == 'inner' and 'geometry' in m]
    shape = unary_union(ring_polys(outer))
    holes = ring_polys(inner)
    if holes:
        shape = shape.difference(unary_union(holes))
    return shape.buffer(0)


def km(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def population(tags):
    try:
        return int(re.sub(r'[  ,.]', '', tags.get('population', '')) or 0)
    except ValueError:
        return 0


def js(s):
    return json.dumps(s, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(ROOT, '.overpass-cache'))
    args = ap.parse_args()

    names = read_kommun_names()
    wanted = set(names)

    print('Fetching kommuner ...')
    kdata = fetch('kommuner', QUERIES['kommuner'], args.cache)
    nodes = {e['id']: e for e in kdata['elements'] if e['type'] == 'node'}
    shapes, centres, seen = {}, {}, {}
    for rel in (e for e in kdata['elements'] if e['type'] == 'relation'):
        tags = rel.get('tags', {})
        app = osm_to_app_name(tags.get('name', ''), wanted)
        if not app:
            continue
        if app in seen:
            raise SystemExit(f'Two relations match {app}: {seen[app]} and {tags.get("name")}')
        seen[app] = tags.get('name')
        shapes[app] = relation_polygon(rel)
        for m in rel.get('members', []):
            if m.get('role') == 'admin_centre' and m['type'] == 'node' and m['ref'] in nodes:
                n = nodes[m['ref']]
                centres[app] = (n.get('tags', {}).get('name', app), n['lat'], n['lon'])
                break
    missing = sorted(wanted - set(shapes))
    if missing:
        raise SystemExit(f'{len(missing)} kommuner not matched in OSM: {missing}')
    empty = [k for k, s in shapes.items() if s.is_empty]
    if empty:
        raise SystemExit(f'Empty polygons: {empty}')

    print('Fetching places ...')
    elements = fetch('places', QUERIES['places'], args.cache)['elements']
    print('Fetching industrial/retail areas ...')
    elements += fetch('areas', QUERIES['areas'], args.cache)['elements']

    raw = []
    for e in elements:
        tags = e.get('tags', {})
        lat, lon = (e['lat'], e['lon']) if 'lat' in e else (e.get('center', {}).get('lat'), e.get('center', {}).get('lon'))
        name = tags.get('name', '').strip()
        kind = tags.get('place') if tags.get('place') in ABBR else tags.get('landuse')
        if lat is None or not name or kind not in ABBR:
            continue
        raw.append((name, lat, lon, kind, population(tags), e['type']))

    order = sorted(shapes)
    tree = STRtree([shapes[k] for k in order])
    pt_idx, poly_idx = tree.query(points([(r[2], r[1]) for r in raw]), predicate='intersects')
    owner = {}
    for p, g in zip(pt_idx.tolist(), poly_idx.tolist()):
        owner.setdefault(p, order[g])  # on a shared border, first match wins
    dropped = len(raw) - len(owner)

    per = {k: [] for k in names}
    for i, kommun in owner.items():
        per[kommun].append(raw[i])

    # Kommuner without an admin_centre: most populous city/town inside, else the biggest place.
    fallbacks = {}
    for k in names:
        if k in centres:
            continue
        towns = [r for r in per[k] if r[3] in ('city', 'town')]
        pool = towns or per[k]
        if not pool:
            raise SystemExit(f'No places inside {k}')
        best = max(pool, key=lambda r: (r[4], -RANK[r[3]])) if towns else min(pool, key=lambda r: (RANK[r[3]], -r[4]))
        centres[k] = (best[0], best[1], best[2])
        fallbacks[k] = f'{best[0]} ({best[3]}{", pop " + str(best[4]) if best[4] else ""})'

    totals = {}
    out_places = {}
    for k in names:
        kept = []
        for r in sorted(per[k], key=lambda r: (RANK[r[3]], -r[4], r[0])):
            if any(o[0] == r[0] and km((o[1], o[2]), (r[1], r[2])) <= DUP_KM for o in kept):
                continue
            kept.append(r)
        out_places[k] = kept
        for r in kept:
            totals[ABBR[r[3]]] = totals.get(ABBR[r[3]], 0) + 1

    today = datetime.date.today().isoformat()
    lines = [
        '// GENERATED FILE - do not edit by hand.',
        f'// Generated {today} by scripts/build-places.py from OpenStreetMap data,',
        '// © OpenStreetMap contributors, available under the Open Database License (ODbL).',
        '//',
        '// KOMMUN_CENTRES: kommun -> [centralort, lat, lng].',
        '// PLACES: kommun -> [name, lat, lng, type]; type: c city/town, v village, h hamlet,',
        '// s suburb/borough/quarter/neighbourhood/city_block, q square, i island/islet, a industrial/retail area.',
        '',
        'export const KOMMUN_CENTRES: Record<string, [string, number, number]> = {',
    ]
    for k in names:
        n, lat, lon = centres[k]
        lines.append(f'{js(k)}:[{js(n)},{round(lat, 5)},{round(lon, 5)}],')
    lines.append('};')
    lines.append('')
    lines.append('export const PLACES: Record<string, [string, number, number, string][]> = {')
    for k in names:
        items = ','.join(f'[{js(r[0])},{round(r[1], 5)},{round(r[2], 5)},"{ABBR[r[3]]}"]' for r in out_places[k])
        lines.append(f'{js(k)}:[{items}],')
    lines.append('};')
    lines.append('')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'Elements: {len(raw)}, outside all kommuner: {dropped}')
    print('Totals per type:', ', '.join(f'{t}={totals.get(t, 0)}' for t in 'cvhsqia'), f'(all {sum(totals.values())})')
    print(f'Kommuner without admin_centre ({len(fallbacks)}):')
    for k, v in sorted(fallbacks.items()):
        print(f'  {k}: {v}')
    print(f'Wrote {os.path.relpath(OUT, ROOT)}: {os.path.getsize(OUT):,} bytes')


if __name__ == '__main__':
    main()
