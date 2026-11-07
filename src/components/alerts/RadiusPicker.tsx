// Choosing "near me" for notifications: a map with a circle around a place, and a slider that
// makes the circle bigger or smaller. Your position, or a tap on the map, sets the middle.
// Used on Notiser in the app (NativeAlerts) and on the website (Alerts).
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, LocateFixed, X } from 'lucide-react';
import { NEAR_RADII_KM, radiusLabel, type NearArea } from '../../../supabase/functions/_shared/notifications';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };
const RED = '#ff453a';


interface Props {
  value: NearArea | null;
  onSave: (next: NearArea | null) => void;
  onClose: () => void;
}

const RadiusPicker = ({ value, onSave, onClose }: Props) => {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerRef = useRef<L.CircleMarker | null>(null);
  const [center, setCenter] = useState(value ? { lat: value.lat, lng: value.lng } : null);
  const [step, setStep] = useState(() => {
    const index = NEAR_RADII_KM.indexOf(value?.radiusKm ?? 5);
    return index >= 0 ? index : NEAR_RADII_KM.indexOf(5);
  });
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radiusKm = NEAR_RADII_KM[step];

  const locate = () => {
    if (!navigator.geolocation) { setError('Din enhet kan inte ge din position. Tryck på kartan i stället.'); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setCenter({ lat: coords.latitude, lng: coords.longitude }); setLocating(false); },
      () => { setLocating(false); setError('Kunde inte hämta din position. Tillåt plats, eller tryck på kartan där cirkeln ska vara.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  // The map, once
  useEffect(() => {
    if (!mapEl.current) return;
    const start = value ?? STOCKHOLM;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: false }).setView([start.lat, start.lng], 10);
    L.tileLayer(TILES, { maxZoom: 18 }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    // Without a place yet, start where you are
    if (!value) locate();
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
    // The whole circle in view, with some map around it
    map.flyToBounds(circleRef.current.getBounds(), { padding: [28, 28], duration: 0.5 });
  }, [center, radiusKm]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Notiser nära dig" className="ca-dark fixed inset-0 z-[3000] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[92%] flex-col overflow-hidden rounded-t-[16px] bg-[#1c1c1e] text-white sm:mx-auto sm:mb-8 sm:w-[480px] sm:rounded-[16px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <button type="button" onClick={onClose} className="w-20 text-left text-[17px] text-[#ff453a]">Avbryt</button>
          <span className="text-[17px] font-semibold">Nära dig</span>
          <button
            type="button"
            disabled={!center}
            onClick={() => center && onSave({ lat: center.lat, lng: center.lng, radiusKm })}
            className="w-20 text-right text-[17px] font-semibold text-[#ff453a] disabled:opacity-40"
          >
            Spara
          </button>
        </div>

        <div className="ca-radius-map relative mx-4 h-[300px] overflow-hidden rounded-[12px] bg-[#0b0e13]">
          <div ref={mapEl} className="absolute inset-0" aria-label="Karta. Tryck där cirkeln ska vara." />
          <button
            type="button"
            onClick={locate}
            aria-label="Använd min position"
            className="absolute right-2 top-2 z-[500] flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(28,28,30,0.85)] backdrop-blur"
          >
            {locating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LocateFixed className="h-5 w-5 text-[#0a84ff]" aria-hidden />}
          </button>
          {!center && !locating && (
            <p className="pointer-events-none absolute inset-x-6 top-1/2 z-[500] -translate-y-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[14px]">
              Tryck på kartan där cirkeln ska vara
            </p>
          )}
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] text-[rgba(235,235,245,0.6)]">Avstånd</span>
            <span className="text-[22px] font-bold tabular-nums">{radiusLabel(radiusKm)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={NEAR_RADII_KM.length - 1}
            step={1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            aria-label="Avstånd"
            aria-valuetext={radiusLabel(radiusKm)}
            className="ca-radius-slider mt-3 w-full"
            style={{ ['--fill' as string]: `${(step / (NEAR_RADII_KM.length - 1)) * 100}%` }}
          />
          <div className="mt-1 flex justify-between text-[12px] text-[rgba(235,235,245,0.45)]">
            <span>{radiusLabel(NEAR_RADII_KM[0])}</span>
            <span>{radiusLabel(NEAR_RADII_KM[NEAR_RADII_KM.length - 1])}</span>
          </div>
          <p className="mt-3 text-[13px] leading-snug text-[rgba(235,235,245,0.6)]">
            Du får notiser om det som händer i cirkeln, utöver dina kommuner. Platsen sparas ungefärligt och används bara till det här.
          </p>
          {error && <p role="alert" className="mt-2 text-[13px] text-[#ff6961]">{error}</p>}
          {value && (
            <button type="button" onClick={() => onSave(null)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[rgba(255,69,58,0.12)] text-[15px] font-semibold text-[#ff453a]">
              <X className="h-4 w-4" aria-hidden /> Ta bort Nära dig
            </button>
          )}
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

export default RadiusPicker;
