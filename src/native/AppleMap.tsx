// Apple Maps on the map page, on the website and in the iPhone app from 1.3 (MapKit JS): the same
// map as the Maps app, with the events as CrimeAlert's own pulsing dots (lib/mapMarkers), and
// Apple's callout with the event when one is tapped. The token comes
// from mapkit-token and is kept for its day. If anything fails, onUnavailable tells the map page
// to fall back to its own map (MapView), so the map is never empty.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Incident } from '@/data/mockIncidents';
import { supabase } from '@/integrations/supabase/client';
import { cleanPoliceTitle } from '@/lib/feed';
import { eventPath } from '@/lib/share';
import { getJitteredPositions, isWithinDays, MARKER_PULSE_CSS, markerHtml, shouldIncidentPulse, touchPulseIds } from '@/lib/mapMarkers';
import { formatTimeAgo } from '@/lib/timeAgo';

export type AppleMapType = 'standard' | 'satellite' | 'hybrid';

const SCRIPT = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';
const TOKEN_KEY = 'ca-mapkit-token';
const SWEDEN = { lat: 62.4, lng: 16.4, latSpan: 15, lngSpan: 22 };

// MapKit JS has no types of its own on npm; this is the part of it used here
/* eslint-disable @typescript-eslint/no-explicit-any */
type MapKit = any;
declare global {
  interface Window { mapkit?: MapKit; __caMapkitLoaded?: () => void }
}

interface CachedToken { token: string; expiresAt: number }

function cachedToken(now = Date.now()): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as CachedToken | null;
    // Kept until an hour before it ends
    return saved && saved.expiresAt - 60 * 60 * 1000 > now ? saved.token : null;
  } catch {
    return null;
  }
}

async function freshToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<CachedToken>('mapkit-token', { method: 'GET' });
  if (error || !data?.token) throw new Error('Ingen kartnyckel');
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(data)); } catch { /* asked again next time */ }
  return data.token;
}

const forgetToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* nothing kept */ } };

let loading: Promise<MapKit> | null = null;

/** Loads MapKit JS once, with the map and its markers */
function loadMapKit(): Promise<MapKit> {
  if (window.mapkit?.Map) return Promise.resolve(window.mapkit);
  if (loading) return loading;
  loading = new Promise<MapKit>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MapKit laddades inte')), 12000);
    window.__caMapkitLoaded = () => {
      clearTimeout(timer);
      const mapkit = window.mapkit;
      mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          const token = cachedToken();
          if (token) done(token);
          else freshToken().then(done).catch(() => done(''));
        },
        language: 'sv',
      });
      resolve(mapkit);
    };
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.dataset.callback = '__caMapkitLoaded';
    script.dataset.libraries = 'map,annotations';
    script.onerror = () => { clearTimeout(timer); reject(new Error('MapKit laddades inte')); };
    document.head.appendChild(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}

/** The pulse's animation, once for the page */
function addPulseStyles() {
  if (document.getElementById('ca-marker-pulse')) return;
  const style = document.createElement('style');
  style.id = 'ca-marker-pulse';
  style.textContent = MARKER_PULSE_CSS;
  document.head.appendChild(style);
}

/** A region around a point, about as wide as the website map's zoom level shows */
const regionAt = (mapkit: MapKit, lat: number, lng: number, zoom: number) => {
  const span = (180 / 2 ** zoom) * 1.4;
  return new mapkit.CoordinateRegion(new mapkit.Coordinate(lat, lng), new mapkit.CoordinateSpan(span, span * 1.6));
};

interface AppleMapProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelectIncident: (id: string) => void;
  flyToLocation?: { lat: number; lng: number; zoom: number } | null;
  mapType: AppleMapType;
  onUnavailable: () => void;
  /** 'app': the iPhone app's full-screen map with its sheet; 'web': the website's map page, with Apple's zoom buttons */
  variant?: 'app' | 'web';
}

const AppleMap = ({ incidents, selectedId, onSelectIncident, flyToLocation, mapType, onUnavailable, variant = 'app' }: AppleMapProps) => {
  const navigate = useNavigate();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapKit>(null);
  const kitRef = useRef<MapKit>(null);
  const markers = useRef(new Map<string, MapKit>());
  const handlers = useRef({ onSelectIncident, onUnavailable, navigate });
  handlers.current = { onSelectIncident, onUnavailable, navigate };
  const typeRef = useRef(mapType);
  typeRef.current = mapType;
  const applyType = (map: MapKit, mapkit: MapKit) => {
    const t = typeRef.current;
    map.mapType = t === 'satellite' ? mapkit.Map.MapTypes.Satellite : t === 'hybrid' ? mapkit.Map.MapTypes.Hybrid : mapkit.Map.MapTypes.Standard;
  };

  // The map itself, once
  useEffect(() => {
    let cancelled = false;
    const shown = markers.current;
    let map: MapKit = null;
    let kit: MapKit = null;
    const onError = (event: { status?: string }) => {
      // A token Apple refuses: forget it, and use the site's own map this time
      if (event?.status === 'Unauthorized' || event?.status === 'Too Many Requests') forgetToken();
      handlers.current.onUnavailable();
    };
    loadMapKit().then((mapkit) => {
      if (cancelled || !el.current) return;
      kit = mapkit;
      kitRef.current = mapkit;
      mapkit.addEventListener('error', onError);
      addPulseStyles();
      map = new mapkit.Map(el.current, {
        colorScheme: mapkit.Map.ColorSchemes.Dark,
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsScale: mapkit.FeatureVisibility.Hidden,
        showsMapTypeControl: false,
        showsZoomControl: variant === 'web',
        showsUserLocationControl: false,
        isRotationEnabled: false,
        // App: room for the search field above and the sheet below (MapChrome). Web: room for the status chips
        padding: variant === 'web' ? new mapkit.Padding(80, 8, 8, 8) : new mapkit.Padding(70, 8, 130, 8),
        region: new mapkit.CoordinateRegion(new mapkit.Coordinate(SWEDEN.lat, SWEDEN.lng), new mapkit.CoordinateSpan(SWEDEN.latSpan, SWEDEN.lngSpan)),
      });
      mapRef.current = map;
      applyType(map, mapkit);
      map.addEventListener('select', (event: { annotation?: MapKit }) => {
        const id = event.annotation?.data?.id;
        if (id) handlers.current.onSelectIncident(id);
      });
    }).catch(() => { if (!cancelled) handlers.current.onUnavailable(); });
    return () => {
      cancelled = true;
      kit?.removeEventListener('error', onError);
      map?.destroy();
      mapRef.current = null;
      shown.clear();
    };
  // A page has one kind of map; only if that changed would it be made again
  }, [variant]);

  useEffect(() => {
    if (mapRef.current && kitRef.current) applyType(mapRef.current, kitRef.current);
  }, [mapType]);

  // The events as markers: only those that came or went are added or taken away
  useEffect(() => {
    const sync = () => {
      const map = mapRef.current;
      const mapkit = kitRef.current;
      if (!map || !mapkit) return false;
      // As on the website: the last seven days, crowded events spread a little apart, and on a
      // phone only the newest few pulse (every pulse is redrawn each frame while panning)
      const recent = incidents.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng) && isWithinDays(i.time, 7));
      const positions = getJitteredPositions(recent);
      // A computer has room for every new event to pulse, and the smaller dots, as on the website
      const touch = variant === 'app' || ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      const pulsing = touch ? touchPulseIds(recent) : null;
      const wanted = new Map(recent.map((incident, index) => [incident.id, { incident, position: positions[index], pulse: pulsing ? pulsing.has(incident.id) : shouldIncidentPulse(incident) }]));
      const gone: MapKit[] = [];
      for (const [id, marker] of markers.current) {
        // An event that has stopped (or started) pulsing is drawn again
        if (!wanted.has(id) || wanted.get(id)!.pulse !== marker.data.pulse) { gone.push(marker); markers.current.delete(id); }
      }
      if (gone.length) map.removeAnnotations(gone);
      const added: MapKit[] = [];
      for (const [id, { incident, position, pulse }] of wanted) {
        if (markers.current.has(id)) continue;
        const community = incident.source === 'Medborgarrapport';
        const { html, size } = markerHtml(incident, touch, pulse);
        const marker = new mapkit.Annotation(new mapkit.Coordinate(position.lat, position.lng), () => {
          const dot = document.createElement('div');
          dot.innerHTML = html;
          dot.style.cssText = `width:${size}px;height:${size}px;`;
          return dot;
        }, {
          // The dot's middle on the spot, not its bottom edge
          anchorOffset: new DOMPoint(0, size / 2),
          calloutOffset: new DOMPoint(0, -size / 2 + 6),
          displayPriority: mapkit.Annotation.DisplayPriority?.Required ?? 1000,
          title: cleanPoliceTitle(incident.title),
          subtitle: [incident.area, formatTimeAgo(incident.time)].filter(Boolean).join(' · '),
          data: { id, pulse },
          // An event opens on its own page; a citizen report has none
          callout: community ? undefined : {
            calloutRightAccessoryForAnnotation: () => {
              const button = document.createElement('button');
              button.type = 'button';
              button.setAttribute('aria-label', 'Öppna händelsen');
              button.textContent = '›';
              button.style.cssText = 'font: 600 26px -apple-system, system-ui; color: #ff453a; background: none; border: 0; padding: 0 4px 2px 10px; line-height: 1;';
              button.addEventListener('click', () => handlers.current.navigate(eventPath(id)));
              return button;
            },
          },
        });
        markers.current.set(id, marker);
        added.push(marker);
      }
      if (added.length) map.addAnnotations(added);
      return true;
    };
    if (sync()) return;
    // Until MapKit has loaded, try again shortly
    const timer = setInterval(() => { if (sync()) clearInterval(timer); }, 300);
    return () => clearInterval(timer);
  }, [incidents, variant]);

  // An event picked in the sheet: fly there and open its callout
  useEffect(() => {
    const map = mapRef.current;
    const mapkit = kitRef.current;
    if (!map || !mapkit || !selectedId) return;
    const marker = markers.current.get(selectedId);
    if (!marker) return;
    map.setRegionAnimated(regionAt(mapkit, marker.coordinate.latitude, marker.coordinate.longitude, 14), true);
    setTimeout(() => { if (mapRef.current === map) map.selectedAnnotation = marker; }, 450);
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const mapkit = kitRef.current;
    if (!map || !mapkit || !flyToLocation) return;
    map.setRegionAnimated(regionAt(mapkit, flyToLocation.lat, flyToLocation.lng, flyToLocation.zoom), true);
  }, [flyToLocation]);

  // --pulse-scale: how far the pulse reaches, as on the website's map at a town's zoom
  return <div ref={el} className="absolute inset-0 bg-[#1c1c1e]" style={{ ['--pulse-scale' as string]: '3' }} aria-label="Karta" role="application" />;
};

export default AppleMap;
