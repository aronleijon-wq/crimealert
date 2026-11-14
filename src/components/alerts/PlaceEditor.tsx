// Adding or changing one of Mina platser: what kind of place and its name, where it is (your
// position, an address, or a tap on the map), and how far around it to hear about. Used on Notiser
// in the app (NativeAlerts) and on the website (MoreNotificationSettings).
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, LocateFixed, Search, Trash2 } from 'lucide-react';
import { searchPlaces, type PlaceResult } from '@/lib/communityReports';
import type { PlaceDraft } from '@/hooks/useWatchPlaces';
import { PLACE_ICONS } from '@/lib/placeIcons';
import { PLACE_KINDS, PLACE_RADII_KM, placeKind, radiusLabel, type PlaceKind, type WatchPlace } from '../../../supabase/functions/_shared/notifications';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };
const RED = '#ff453a';
const MUTED = 'text-[rgba(235,235,245,0.6)]';

/** The distance a new place of this kind starts with: near home, wider for work and family */
const START_RADIUS: Record<PlaceKind, number> = { home: 1, work: 1, school: 1, family: 2, other: 2 };

interface Props {
  /** The place to change, or null for a new one */
  place: WatchPlace | null;
  /** Its kind, for a new place */
  kind?: PlaceKind;
  onSave: (draft: PlaceDraft) => Promise<string | null>;
  onRemove?: () => void;
  onClose: () => void;
}

const PlaceEditor = ({ place, kind: startKind = 'home', onSave, onRemove, onClose }: Props) => {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerRef = useRef<L.CircleMarker | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? startKind);
  const [label, setLabel] = useState(place?.label ?? placeKind(startKind).label);
  const [center, setCenter] = useState(place ? { lat: place.lat, lng: place.lng } : null);
  const [step, setStep] = useState(() => {
    const index = PLACE_RADII_KM.indexOf(place?.radiusKm ?? START_RADIUS[startKind]);
    return index >= 0 ? index : PLACE_RADII_KM.indexOf(1);
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radiusKm = PLACE_RADII_KM[step];

  // Choosing a kind names the place after it, unless it has a name of its own
  const pickKind = (next: PlaceKind) => {
    if (!label.trim() || PLACE_KINDS.some((k) => k.label === label.trim())) setLabel(placeKind(next).label);
    setKind(next);
  };

  const locate = () => {
    if (!navigator.geolocation) { setError('Din enhet kan inte ge din position. Sök en adress eller tryck på kartan.'); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setCenter({ lat: coords.latitude, lng: coords.longitude }); setLocating(false); },
      () => { setLocating(false); setError('Kunde inte hämta din position. Sök en adress eller tryck på kartan.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const search = (text: string) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 3) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setResults(await searchPlaces(text));
      setSearching(false);
    }, 400);
  };

  const pickResult = (r: PlaceResult) => {
    setCenter({ lat: r.lat, lng: r.lng });
    setQuery('');
    setResults([]);
  };

  const save = async () => {
    if (!center || saving) return;
    setSaving(true);
    const problem = await onSave({ label, kind, lat: center.lat, lng: center.lng, radiusKm });
    setSaving(false);
    if (problem) setError(problem);
  };

  // The map, once
  useEffect(() => {
    if (!mapEl.current) return;
    const start = place ?? STOCKHOLM;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView([start.lat, start.lng], place ? 13 : 10);
    L.tileLayer(TILES, { maxZoom: 18 }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    // A new home is most often added at home: start where you are
    if (!place && startKind === 'home') locate();
    return () => { map.remove(); mapRef.current = null; circleRef.current = null; centerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The circle follows the middle and the slider
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const at: L.LatLngExpression = [center.lat, center.lng];
    if (!circleRef.current) {
      circleRef.current = L.circle(at, { radius: radiusKm * 1000, color: RED, weight: 2, fillColor: RED, fillOpacity: 0.14 }).addTo(map);
      centerRef.current = L.circleMarker(at, { radius: 7, color: '#fff', weight: 2.5, fillColor: RED, fillOpacity: 1 }).addTo(map);
    } else {
      circleRef.current.setLatLng(at).setRadius(radiusKm * 1000);
      centerRef.current?.setLatLng(at);
    }
    map.flyToBounds(circleRef.current.getBounds(), { padding: [28, 28], duration: 0.5 });
  }, [center, radiusKm]);

  return (
    <div role="dialog" aria-modal="true" aria-label={place ? `Ändra ${place.label}` : 'Ny plats'} className="ca-dark fixed inset-0 z-[3000] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[94%] flex-col overflow-hidden rounded-t-[16px] bg-[#1c1c1e] text-white sm:mx-auto sm:mb-8 sm:w-[480px] sm:rounded-[16px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
          <button type="button" onClick={onClose} className="w-20 text-left text-[17px] text-[#ff453a]">Avbryt</button>
          <span className="text-[17px] font-semibold">{place ? 'Ändra plats' : 'Ny plats'}</span>
          <button type="button" disabled={!center || saving} onClick={save} className="w-20 text-right text-[17px] font-semibold text-[#ff453a] disabled:opacity-40">
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Sorts plats">
            {PLACE_KINDS.map((k) => {
              const Icon = PLACE_ICONS[k.id];
              return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => pickKind(k.id)}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] transition-colors ${kind === k.id ? 'bg-white font-semibold text-black' : 'bg-[#2c2c2e] text-white'}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />{k.label}
              </button>
              );
            })}
          </div>

          <div className="mx-4 mt-3 overflow-hidden rounded-[12px] bg-[#2c2c2e]">
            <label className="flex min-h-[46px] items-center gap-3 px-4">
              <span className={`w-12 shrink-0 text-[15px] ${MUTED}`}>Namn</span>
              <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder="T.ex. Mammas hus" aria-label="Namn på platsen"
                className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.3)]" />
            </label>
            <div className="ml-4 border-t border-white/[0.08]" />
            <label className="flex min-h-[46px] items-center gap-3 px-4">
              <Search className={`h-[18px] w-[18px] shrink-0 ${MUTED}`} aria-hidden />
              <input value={query} onChange={(e) => search(e.target.value.slice(0, 80))} placeholder="Sök adress" aria-label="Sök adress" enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.3)]" />
              {searching && <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${MUTED}`} aria-hidden />}
            </label>
            {results.map((r) => (
              <button key={`${r.lat},${r.lng}`} type="button" onClick={() => pickResult(r)} className="block w-full border-t border-white/[0.08] px-4 py-2.5 text-left text-[15px] text-white active:bg-white/[0.06]">
                <span className="line-clamp-2">{r.name}</span>
              </button>
            ))}
          </div>

          <div className="ca-radius-map relative mx-4 mt-3 h-[240px] overflow-hidden rounded-[12px] bg-[#0b0e13]">
            <div ref={mapEl} className="absolute inset-0" aria-label="Karta. Tryck där platsen är." />
            <button type="button" onClick={locate} aria-label="Använd min position"
              className="absolute right-2 top-2 z-[500] flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(28,28,30,0.85)] backdrop-blur">
              {locating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LocateFixed className="h-5 w-5 text-[#ff453a]" aria-hidden />}
            </button>
            {!center && !locating && (
              <p className="pointer-events-none absolute inset-x-6 top-1/2 z-[500] -translate-y-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[14px]">
                Sök en adress, använd din position eller tryck på kartan
              </p>
            )}
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="flex items-baseline justify-between">
              <span className={`text-[15px] ${MUTED}`}>Notiser inom</span>
              <span className="text-[22px] font-bold tabular-nums">{radiusLabel(radiusKm)}</span>
            </div>
            <input
              type="range" min={0} max={PLACE_RADII_KM.length - 1} step={1} value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              aria-label="Avstånd" aria-valuetext={radiusLabel(radiusKm)}
              className="ca-radius-slider mt-3 w-full"
              style={{ ['--fill' as string]: `${(step / (PLACE_RADII_KM.length - 1)) * 100}%` }}
            />
            <div className="mt-1 flex justify-between text-[12px] text-[rgba(235,235,245,0.45)]">
              <span>{radiusLabel(PLACE_RADII_KM[0])}</span>
              <span>{radiusLabel(PLACE_RADII_KM[PLACE_RADII_KM.length - 1])}</span>
            </div>
            <p className={`mt-3 text-[13px] leading-snug ${MUTED}`}>
              Notisen säger vilken plats det gäller. Polisen anger ofta bara orten, så ibland står det "nära" i stället för ett exakt avstånd. Platsen sparas ungefärligt och används bara till notiserna.
            </p>
            {error && <p role="alert" className="mt-2 text-[13px] text-[#ff6961]">{error}</p>}
            {place && onRemove && (
              <button type="button" onClick={onRemove} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[rgba(255,69,58,0.12)] text-[15px] font-semibold text-[#ff453a]">
                <Trash2 className="h-4 w-4" aria-hidden /> Ta bort {place.label}
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .ca-radius-map .leaflet-container { background: #0b0e13; }
        .ca-radius-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px;
          background: linear-gradient(to right, ${RED} var(--fill), rgba(120,120,128,0.32) var(--fill)); outline: none; }
        .ca-radius-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 50%;
          background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); cursor: pointer; }
        .ca-radius-slider::-moz-range-thumb { width: 28px; height: 28px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); cursor: pointer; }
      `}</style>
    </div>
  );
};

export default PlaceEditor;
