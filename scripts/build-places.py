#!/usr/bin/env python3
"""Build supabase/functions/_shared/data/places.ts, a Swedish place gazetteer, from OpenStreetMap.

Data: OpenStreetMap via the Overpass API, (c) OpenStreetMap contributors, ODbL.

Usage:
    python3 scripts/build-places.py [--cache DIR]

One Overpass query per län. Within it, Overpass itself finds each kommun's places
(foreach kommun -> map_to_area -> places in that area), so no boundary geometry is downloaded.
Answers are cached as JSON in --cache (default .overpass-cache, not committed), so a rerun only
fetches what is missing. Delete the cache to refresh the data. Several Overpass servers are tried.

The 290 kommun names are read from src/data/kommuner.ts (SWEDISH_KOMMUNER), as the app writes them.
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KOMMUN_LIST = os.path.join(ROOT, 'src/data/kommuner.ts')
OUT = os.path.join(ROOT, 'supabase/functions/_shared/data/places.ts')
SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

PLACE_RE = '^(city|town|village|hamlet|suburb|quarter|neighbourhood|square|borough|city_block|island|islet)$'
LAN_QUERY = '''[out:json][timeout:600];
area["ISO3166-1"="SE"][admin_level=2]->.se;
rel(area.se)[boundary=administrative][admin_level=4];
out tags;'''
KOMMUNER_IN_LAN = '''[out:json][timeout:900];
rel({lan});map_to_area->.l;
rel(area.l)[boundary=administrative][admin_level=7];
foreach->.k(
  .k out body;
  node(r.k:"admin_centre");out;
  .k map_to_area->.a;
  (
    nwr(area.a)[place~"''' + PLACE_RE + '''"][name];
    nwr(area.a)[landuse~"^(industrial|retail)$"][name];
  );
  out center tags;
);'''

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


def log(*args):
    print(*args, flush=True)


def fetch(name, query, cache):
    path = os.path.join(cache, name + '.json')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    body = urllib.parse.urlencode({'data': query}).encode()
    for attempt in range(9):
        server = SERVERS[attempt % len(SERVERS)]
        started = time.time()
        try:
            req = urllib.request.Request(server, data=body, headers={'User-Agent': 'crimealert-gazetteer/1.1'})
            with urllib.request.urlopen(req, timeout=960) as r:
                data = json.load(r)
            remark = data.get('remark', '')
            if 'runtime error' in remark or 'timed out' in remark or 'out of memory' in remark:
                raise RuntimeError(remark)
            os.makedirs(cache, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f)
            log(f'  {name}: {len(data.get("elements", []))} elements from {server} in {time.time() - started:.0f}s')
            return data
        except (urllib.error.HTTPError, urllib.error.URLError, ConnectionError, TimeoutError, RuntimeError, json.JSONDecodeError) as e:
            log(f'  {name}: {server} failed after {time.time() - started:.0f}s: {e}')
        time.sleep(min(30 * (attempt + 1), 180))
    raise SystemExit(f'Overpass query {name} failed on every server')


def read_kommun_names():
    src = open(KOMMUN_LIST, encoding='utf-8').read()
    block = re.search(r'SWEDISH_KOMMUNER: string\[\] = \[(.*?)\];', src, re.S).group(1)
    names = re.findall(r"'([^']+)'", block)
    assert len(names) == 290 and len(set(names)) == 290, len(names)
    return names


def osm_to_app_name(osm_name, wanted):
    """'Sundsvalls kommun' -> 'Sundsvall', 'Region Gotland' -> 'Gotland', 'Göteborgs Stad' -> 'Göteborg'."""
    base = osm_name
    if base.startswith('Region '):
        base = base[len('Region '):]
    elif base.endswith(' kommun'):
        base = base[:-len(' kommun')]
    elif base.lower().endswith(' stad'):  # 'Göteborgs Stad'
        base = base[:-len(' stad')]
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


def split_by_kommun(elements, wanted):
    """The foreach answer: each kommun relation, then its admin_centre node, then its places.

    Returns ({kommun: [(name, lat, lon, kind, population)]}, {kommun: (centralort, lat, lon)}).
    """
    per, centres = {}, {}
    current, centre_ref = None, None
    for e in elements:
        tags = e.get('tags', {})
        if e['type'] == 'relation' and tags.get('admin_level') == '7' and tags.get('boundary') == 'administrative':
            current = osm_to_app_name(tags.get('name', ''), wanted)
            if current is None:
                log(f'  skipping unknown kommun {tags.get("name")!r}')
            else:
                per.setdefault(current, [])
            centre_ref = next((m['ref'] for m in e.get('members', []) if m.get('role') == 'admin_centre' and m['type'] == 'node'), None)
            continue
        if current is None:
            continue
        if e['type'] == 'node' and e['id'] == centre_ref and current not in centres:
            centres[current] = (tags.get('name', current), e['lat'], e['lon'])
        lat, lon = (e.get('lat'), e.get('lon')) if 'lat' in e else (e.get('center', {}).get('lat'), e.get('center', {}).get('lon'))
        name = tags.get('name', '').strip()
        kind = tags.get('place') if tags.get('place') in ABBR else tags.get('landuse')
        if lat is None or not name or kind not in ABBR:
            continue
        per[current].append((name, lat, lon, kind, population(tags)))
    return per, centres


def build(per, centres, names):
    """Fallback centres, dedupe; returns (centres, places, fallbacks)."""
    fallbacks = {}
    for k in names:
        if k in centres:
            continue
        towns = [r for r in per.get(k, []) if r[3] in ('city', 'town')]
        pool = towns or per.get(k, [])
        if not pool:
            raise SystemExit(f'No places inside {k}')
        best = max(pool, key=lambda r: (r[4], -RANK[r[3]])) if towns else min(pool, key=lambda r: (RANK[r[3]], -r[4]))
        centres[k] = (best[0], best[1], best[2])
        fallbacks[k] = f'{best[0]} ({best[3]}{", pop " + str(best[4]) if best[4] else ""})'
    places = {}
    for k in names:
        kept = []
        for r in sorted(per.get(k, []), key=lambda r: (RANK[r[3]], -r[4], r[0])):
            if any(o[0] == r[0] and km((o[1], o[2]), (r[1], r[2])) <= DUP_KM for o in kept):
                continue
            kept.append(r)
        places[k] = kept
    return centres, places, fallbacks


def write(centres, places, names):
    lines = [
        '// GENERATED FILE - do not edit by hand.',
        f'// Generated {datetime.date.today().isoformat()} by scripts/build-places.py from OpenStreetMap data,',
        '// (c) OpenStreetMap contributors, available under the Open Database License (ODbL).',
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
    lines += ['};', '', 'export const PLACES: Record<string, [string, number, number, string][]> = {']
    for k in names:
        items = ','.join(f'[{js(r[0])},{round(r[1], 5)},{round(r[2], 5)},"{ABBR[r[3]]}"]' for r in places[k])
        lines.append(f'{js(k)}:[{items}],')
    lines += ['};', '']
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(ROOT, '.overpass-cache'))
    args = ap.parse_args()

    names = read_kommun_names()
    wanted = set(names)

    log('Fetching län ...')
    lans = [e for e in fetch('lan', LAN_QUERY, args.cache)['elements'] if e['type'] == 'relation']
    log(f'{len(lans)} län')
    per, centres = {}, {}
    for i, lan in enumerate(sorted(lans, key=lambda e: e['id']), 1):
        log(f'[{i}/{len(lans)}] {lan.get("tags", {}).get("name", lan["id"])}')
        data = fetch(f'lan-{lan["id"]}', KOMMUNER_IN_LAN.replace('{lan}', str(lan['id'])), args.cache)
        p, c = split_by_kommun(data['elements'], wanted)
        for k, rows in p.items():
            per.setdefault(k, []).extend(rows)
        for k, v in c.items():
            centres.setdefault(k, v)

    missing = sorted(wanted - set(per))
    if missing:
        raise SystemExit(f'{len(missing)} kommuner not found in OSM: {missing}')
    centres, places, fallbacks = build(per, centres, names)
    write(centres, places, names)

    totals = {}
    for rows in places.values():
        for r in rows:
            totals[ABBR[r[3]]] = totals.get(ABBR[r[3]], 0) + 1
    log('Totals per type:', ', '.join(f'{t}={totals.get(t, 0)}' for t in 'cvhsqia'), f'(all {sum(totals.values())})')
    log(f'Kommuner without admin_centre ({len(fallbacks)}):')
    for k, v in sorted(fallbacks.items()):
        log(f'  {k}: {v}')
    log(f'Wrote {os.path.relpath(OUT, ROOT)}: {os.path.getsize(OUT):,} bytes')


if __name__ == '__main__':
    main()
