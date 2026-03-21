import { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';
import PopupEngagement from './PopupEngagement';
import { AuthProvider } from '@/hooks/useAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface MapViewProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelectIncident: (id: string) => void;
  isPremium?: boolean;
  flyToLocation?: { lat: number; lng: number; zoom: number } | null;
}

const TYPE_ICONS: Record<string, string> = {
  police: '🛡️',
  fire: '🔥',
  ambulance: '🚑',
  traffic: '🚗',
  other: '⚠️',
};

const COMMUNITY_REPORT_COLOR = '#f97316'; // orange

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const parseSwedishDate = (dateStr: string): Date | null => {
  try {
    if (!dateStr) return null;
    let s = dateStr.trim();
    s = s.replace(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*([+-]\s*\d{2}:\d{2})?$/,
      (_, d, h, m, sec, tz) => {
        const hh = h.padStart(2, '0');
        const tzClean = tz ? tz.replace(/\s/g, '') : '';
        return `${d}T${hh}:${m}:${sec}${tzClean}`;
      }
    );
    const date = new Date(s);
    return isNaN(date.getTime()) ? null : date;
  } catch { return null; }
};

const isWithinHours = (timeStr: string, hours: number) => {
  const d = parseSwedishDate(timeStr);
  if (!d) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
};

const isWithinDays = (timeStr: string, days: number) => {
  const d = parseSwedishDate(timeStr);
  if (!d) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const getStableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getJitteredPositions = (items: Incident[]) => {
  const positions = items.map((item) => ({ lat: item.lat, lng: item.lng }));
  const buckets = new Map<string, number[]>();

  items.forEach((item, index) => {
    const key = `${item.lat.toFixed(3)}:${item.lng.toFixed(3)}`;
    const existing = buckets.get(key) || [];
    existing.push(index);
    buckets.set(key, existing);
  });

  buckets.forEach((indices) => {
    if (indices.length < 2) return;

    const baseRotation = ((getStableHash(items[indices[0]].id) % 360) * Math.PI) / 180;

    indices.forEach((itemIndex, clusterIndex) => {
      const item = items[itemIndex];
      const seed = getStableHash(`${item.id}:${clusterIndex}`);
      const angle = baseRotation + (Math.PI * 2 * clusterIndex) / indices.length + (((seed % 60) - 30) * Math.PI) / 720;
      const ring = Math.floor(clusterIndex / 8);
      const radius = Math.min(0.009, 0.003 + ring * 0.002 + ((seed % 1000) / 1000) * 0.0025);

      positions[itemIndex] = {
        lat: item.lat + Math.cos(angle) * radius,
        lng: item.lng + Math.sin(angle) * radius,
      };
    });
  });

  return positions;
};

const isMissingPersonIncident = (incident: Incident) => {
  const haystack = `${incident.title} ${incident.description} ${incident.originalType || ''}`.toLowerCase();
  return /försvunnen|saknad|borttappad|efterlyst person|person försvunnen/.test(haystack);
};

const createMarkerIcon = (incident: Incident, touch: boolean) => {
  const isCommunityReport = incident.source === 'Medborgarrapport';
  const config = incidentTypeConfig[incident.type];
  const color = isCommunityReport ? COMMUNITY_REPORT_COLOR : config.color;
  const shouldPulse = shouldIncidentPulse(incident);
  const mobilePad = touch ? 10 : 0;

  if (isCommunityReport) {
    const size = touch ? 24 : 18;
    const pulseSize = shouldPulse ? size + 20 + mobilePad : size + mobilePad;
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">
          ${shouldPulse ? `<div class="marker-pulse-community" style="position:absolute;width:100%;height:100%;top:0;left:0;border-radius:4px;background:${COMMUNITY_REPORT_COLOR};transform:rotate(45deg);"></div>` : ''}
          <div style="width:${size}px;height:${size}px;border-radius:3px;background:${COMMUNITY_REPORT_COLOR};border:2.5px solid rgba(255,255,255,0.95);position:relative;z-index:2;box-shadow:0 2px 10px ${COMMUNITY_REPORT_COLOR}90;transform:rotate(45deg);"></div>
          <span style="position:absolute;z-index:3;font-size:${touch ? '13' : '10'}px;line-height:1;pointer-events:none;">👁️</span>
        </div>
      `,
      iconSize: [pulseSize, pulseSize],
      iconAnchor: [pulseSize / 2, pulseSize / 2],
    });
  }

  const size = touch ? (shouldPulse ? 20 : 16) : (shouldPulse ? 14 : 10);
  const pulseSize = shouldPulse ? size + 16 + mobilePad : size + mobilePad;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">
        ${shouldPulse ? `<div class="marker-pulse" style="position:absolute;width:100%;height:100%;top:0;left:0;border-radius:50%;background:${color};"></div>` : ''}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);position:relative;z-index:2;box-shadow:0 1px 6px ${color}80;"></div>
      </div>
    `,
    iconSize: [pulseSize, pulseSize],
    iconAnchor: [pulseSize / 2, pulseSize / 2],
  });
};

const formatTime = (time: string) => {
  const d = parseSwedishDate(time);
  if (!d) return time;
  return d.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getTimeAgo = (time: string): string => {
  const d = parseSwedishDate(time);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 0 || mins < 1) return 'Just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}min sedan`;
  return `${Math.floor(hours / 24)}d sedan`;
};

const getRiskDescription = (risk: string, type: string): string => {
  const riskTexts: Record<string, Record<string, string>> = {
    high: {
      police: 'Allvarlig polisinsats pågår. Undvik området om möjligt. Polisen rekommenderar att allmänheten håller avstånd. Flera patruller och eventuellt insatsstyrka kan vara på plats.',
      fire: 'Kraftig brand med risk för spridning. Räddningstjänsten arbetar på plats med flera enheter. Fara för rök, giftiga gaser och fallande delar. Evakuering kan pågå i närområdet.',
      ambulance: 'Allvarlig medicinsk händelse. Akutsjukvård har begärt förstärkning och eventuellt luftburen ambulans. Området kan vara avspärrat för att underlätta insatsen.',
      traffic: 'Allvarlig trafikolycka med personskador. Vägen kan vara helt avstängd under utredning. Räddningstjänst och ambulans finns på plats. Sök alternativ väg och räkna med längre restid.',
      other: 'Allvarlig händelse som kräver omedelbar uppmärksamhet från flera blåljusenheter. Läget bedöms som instabilt.',
    },
    medium: {
      police: 'Polisen utreder en pågående händelse. Viss avspärrning kan förekomma i närområdet. Patrull finns på plats för att säkra området.',
      fire: 'Räddningstjänsten hanterar en mindre brand eller brandlarm. Begränsad påverkan på omgivningen men rök kan förekomma.',
      ambulance: 'Sjukvårdspersonal finns på plats och situationen bedöms som under kontroll. Viss trafikpåverkan kan förekomma.',
      traffic: 'Trafikhändelse med begränsad påverkan på framkomligheten. Var uppmärksam vid passage genom området. En fil kan vara avstängd.',
      other: 'Händelse under utredning. Läget bedöms som stabilt men kan förändras. Blåljuspersonal finns på plats.',
    },
    low: {
      police: 'Rutinärende. Polisen har kontroll över situationen. Ingen fara för allmänheten. Kan gälla anmälningsupptagning eller planerad insats.',
      fire: 'Mindre brandrelaterad händelse. Släckning genomförd eller pågår utan risk för spridning. Kan gälla automatlarm utan konstaterad brand.',
      ambulance: 'Sjukvårdsärende utan behov av avspärrning. Ingen påverkan på omgivningen eller trafik.',
      traffic: 'Mindre trafikstörning. Trafiken kan flyta långsammare men är inte stoppad. Kan gälla punktering, motorstopp eller liknande.',
      other: 'Lågprioriterad händelse utan direkt risk för allmänheten. Bevakning sker men ingen aktiv insats pågår.',
    },
  };
  return riskTexts[risk]?.[type] || riskTexts[risk]?.other || '';
};

const getRecommendation = (risk: string, type: string): string => {
  const recs: Record<string, Record<string, string>> = {
    high: {
      police: 'Undvik området helt. Följ polisens anvisningar. Kontakta 112 vid akut fara.',
      fire: 'Håll avstånd. Stäng fönster om du bor i närheten p.g.a. rökutveckling. Var beredd på evakuering.',
      ambulance: 'Lämna fri passage för utryckningsfordon. Undvik att vistas i det avspärrade området.',
      traffic: 'Välj alternativ väg. Räkna med kraftiga förseningar. Kör försiktigt vid passage.',
      other: 'Håll dig uppdaterad via officiella kanaler. Undvik området tills läget klarnat.',
    },
    medium: {
      police: 'Var uppmärksam i området. Följ eventuella avspärrningar.',
      fire: 'Håll viss distans. Var uppmärksam på eventuell röklukt.',
      ambulance: 'Kör försiktigt och lämna plats för ambulans.',
      traffic: 'Sänk hastigheten och var beredd på köbildning.',
      other: 'Var uppmärksam men ingen omedelbar fara bedöms föreligga.',
    },
    low: {
      police: 'Ingen åtgärd krävs. Situationen är under kontroll.',
      fire: 'Ingen fara. Räddningstjänsten har kontroll.',
      ambulance: 'Ingen påverkan. Sjukvård hanterar ärendet.',
      traffic: 'Kör som vanligt men håll ögonen öppna.',
      other: 'Ingen åtgärd krävs från allmänheten.',
    },
  };
  return recs[risk]?.[type] || recs[risk]?.other || '';
};

// Extract structured details from police description
const extractDetails = (desc: string, title: string, originalType?: string): { label: string; value: string; icon: string }[] => {
  const details: { label: string; value: string; icon: string }[] = [];
  const text = `${title} ${desc}`.toLowerCase();

  // Original crime type from Polisen.se
  if (originalType && originalType.length > 0) {
    details.push({ label: 'Brottstyp', value: originalType, icon: '📋' });
  }

  // Persons mentioned
  const personPatterns = [
    { pattern: /(\d+)\s*(?:person|man|kvinna|misstänk|grip|skadad|omkommen)/i, label: 'Personer' },
    { pattern: /(?:en|1)\s+(?:gripen|anhållen|misstänkt)/i, label: 'Gripen' },
    { pattern: /(?:två|tre|fyra|fem|\d+)\s+(?:gripna|anhållna|misstänkta)/i, label: 'Gripna' },
  ];
  for (const { pattern, label } of personPatterns) {
    const match = desc.match(pattern);
    if (match) {
      details.push({ label, value: match[0].charAt(0).toUpperCase() + match[0].slice(1), icon: '👤' });
      break;
    }
  }

  // Vehicles
  const vehiclePatterns = /(?:personbil|lastbil|mc|motorcykel|moped|buss|cykel|fordon|bil|truck|husbil|fyrhjuling|elscooter|elsparkcykel)/i;
  const vehicleMatch = desc.match(vehiclePatterns);
  if (vehicleMatch) {
    details.push({ label: 'Fordon', value: vehicleMatch[0].charAt(0).toUpperCase() + vehicleMatch[0].slice(1), icon: '🚗' });
  }

  // Weapons/tools
  const weaponPatterns = /(?:kniv|skjutvapen|pistol|gevär|yxa|machete|tillhygge|vapen|skott|ammunition)/i;
  const weaponMatch = desc.match(weaponPatterns);
  if (weaponMatch) {
    details.push({ label: 'Vapen/verktyg', value: weaponMatch[0].charAt(0).toUpperCase() + weaponMatch[0].slice(1), icon: '⚔️' });
  }

  // Road/location from description
  const roadPatterns = /(?:E\d+|(?:riksväg|länsväg)\s*\d+|[A-ZÅÄÖ][a-zåäöé]+(?:gatan|vägen|torget|platsen|allén|bron|leden)(?:\s+\d+)?)/;
  const roadMatch = desc.match(roadPatterns);
  if (roadMatch) {
    details.push({ label: 'Plats', value: roadMatch[0], icon: '📍' });
  }

  // Alcohol/drugs
  if (/(?:rattfyller|alkohol|berus|narkotika|drog|påverkad|blåste)/i.test(text)) {
    details.push({ label: 'Påverkan', value: 'Misstänkt påverkan', icon: '🚫' });
  }

  // Animals (vilt)
  const animalPatterns = /(?:älg|rådjur|vildsvin|hjort|ren|varg|björn|lo|vilt)/i;
  const animalMatch = desc.match(animalPatterns);
  if (animalMatch) {
    details.push({ label: 'Djur', value: animalMatch[0].charAt(0).toUpperCase() + animalMatch[0].slice(1), icon: '🦌' });
  }

  return details;
};

const sanitizeHTML = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const createPopupContent = (inc: Incident, isPremium: boolean) => {
  const config = incidentTypeConfig[inc.type];
  const risk = riskConfig[inc.risk];
  const riskColor = inc.risk === 'high' ? '#ef4444' : inc.risk === 'medium' ? '#f97316' : '#22c55e';
  const riskBg = inc.risk === 'high' ? '#fef2f2' : inc.risk === 'medium' ? '#fff7ed' : '#f0fdf4';
  const statusLabel = inc.status === 'active' ? 'Pågående' : 'Avslutad';
  const statusColor = inc.status === 'active' ? '#ef4444' : '#22c55e';
  const statusBg = inc.status === 'active' ? '#fef2f2' : '#f0fdf4';
  const riskDesc = getRiskDescription(inc.risk, inc.type);
  const timeAgo = getTimeAgo(inc.time);
  const extractedDetails = extractDetails(inc.description, inc.title, inc.originalType);

  // Sanitize all dynamic incident data
  const safeTitle = sanitizeHTML(inc.title);
  const safeDescription = sanitizeHTML(inc.description);
  const safeArea = sanitizeHTML(inc.area);
  const safeSource = sanitizeHTML(inc.source || 'Okänd');
  const safeConfigLabel = sanitizeHTML(config.label);
  const safeRiskLabel = sanitizeHTML(risk.label);

  return `
    <div style="font-family:system-ui;min-width:260px;max-width:320px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:22px;">${TYPE_ICONS[inc.type] || '⚠️'}</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;line-height:1.3;">${safeTitle}</div>
          <div style="font-size:10px;color:#888;margin-top:2px;">${safeConfigLabel} • <span style="font-weight:600;color:#555;">🕐 ${timeAgo}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          ${isPremium
            ? `<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;background:${statusBg};color:${statusColor};">${statusLabel}</span>
               <span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;background:${riskBg};color:${riskColor};">Risk: ${safeRiskLabel}</span>`
            : `<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;background:#f3f4f6;color:#aaa;">🔒 Pro</span>`
          }
        </div>
      </div>

      ${(isPremium || (inc.originalType && inc.originalType.toLowerCase().includes('sammanfattning'))) && inc.description ? `<p style="font-size:11px;color:#444;margin:0 0 10px;line-height:1.6;border-left:3px solid ${config.color};padding-left:8px;">${safeDescription}</p>` : !isPremium && !(inc.originalType && inc.originalType.toLowerCase().includes('sammanfattning')) ? `<p style="font-size:10px;color:#aaa;margin:0 0 10px;font-style:italic;">🔒 Detaljerad beskrivning kräver Pro-medlemskap</p>` : ''}

      ${inc.image_url ? `
      <div style="margin-bottom:10px;">
        <img
          src="${sanitizeHTML(inc.image_url)}"
          alt="Rapportbild"
          style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;cursor:pointer;"
          onclick="window.__crimeAlertLightbox='${sanitizeHTML(inc.image_url)}';window.dispatchEvent(new CustomEvent('crimealert-lightbox'))"
        />
        <div style="font-size:9px;color:#aaa;margin-top:3px;text-align:center;">Klicka för att förstora</div>
      </div>
      ` : ''}

      ${isPremium && extractedDetails.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        ${extractedDetails.map(d => `
          <span style="font-size:9px;padding:3px 7px;border-radius:12px;background:#f1f5f9;color:#475569;display:inline-flex;align-items:center;gap:3px;border:1px solid #e2e8f0;">
            <span>${sanitizeHTML(d.icon)}</span>
            <span style="font-weight:600;">${sanitizeHTML(d.label)}:</span> ${sanitizeHTML(d.value)}
          </span>
        `).join('')}
      </div>
      ` : ''}

      ${isPremium ? `
      <div style="background:${riskBg};border:1px solid ${riskColor}20;border-radius:6px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:9px;font-weight:700;color:${riskColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚠ Riskbedömning</div>
        <p style="font-size:10px;color:#555;margin:0;line-height:1.6;">${riskDesc}</p>
      </div>
      ` : `
      <div style="background:#f8f8f8;border:1px solid #e5e5e5;border-radius:6px;padding:10px 12px;margin-bottom:10px;text-align:center;">
        <div style="font-size:10px;color:#888;">🔒 Riskbedömning & rekommendationer</div>
        <div style="font-size:9px;color:#aaa;margin-top:2px;">Tillgängligt med Pro-medlemskap</div>
      </div>
      `}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;margin-bottom:6px;">
        <div style="background:#f8f8f8;padding:6px 8px;border-radius:5px;">
          <span style="color:#aaa;font-size:9px;">📍 Område</span><br/>
          <span style="color:#333;font-weight:600;">${safeArea}</span>
        </div>
        <div style="background:#f8f8f8;padding:6px 8px;border-radius:5px;">
          <span style="color:#aaa;font-size:9px;">🕐 Tidpunkt</span><br/>
          <span style="color:#333;font-weight:500;">${formatTime(inc.time)}</span>
        </div>
        <div style="background:#f8f8f8;padding:6px 8px;border-radius:5px;">
          <span style="color:#aaa;font-size:9px;">📋 Typ</span><br/>
          <span style="color:#333;font-weight:500;">${safeConfigLabel}</span>
        </div>
        <div style="background:#f8f8f8;padding:6px 8px;border-radius:5px;">
          <span style="color:#aaa;font-size:9px;">📡 Status</span><br/>
          ${isPremium
            ? `<span style="color:${statusColor};font-weight:600;">${statusLabel}</span>`
            : `<span style="color:#aaa;font-weight:500;">🔒 Pro</span>`
          }
        </div>
      </div>

      ${''}

      ${inc.approximate ? `<div style="margin-top:6px;font-size:9px;color:#f97316;background:#fff7ed;padding:4px 8px;border-radius:4px;">⊙ Positionen är approximerad – exakt adress visas ej av integritetsskäl</div>` : ''}

      <div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee;font-size:9px;color:#bbb;display:flex;justify-content:space-between;">
        <span>Källa: ${safeSource}</span>
        <span>CrimeAlert</span>
      </div>

      <div id="popup-engagement-${inc.id.replace(/[^a-zA-Z0-9_-]/g, '_')}" data-incident-id="${inc.id}"></div>
    </div>
  `;
};

const MapView = ({ incidents, selectedId, onSelectIncident, isPremium = false, flyToLocation }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouch = useRef(isTouchDevice()).current;
  const onSelectIncidentRef = useRef(onSelectIncident);
  const popupQueryClient = useRef(new QueryClient()).current;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Listen for lightbox events from popup image clicks
  useEffect(() => {
    const handler = () => {
      const url = (window as any).__crimeAlertLightbox;
      if (url) {
        setLightboxUrl(url);
        (window as any).__crimeAlertLightbox = null;
      }
    };
    window.addEventListener('crimealert-lightbox', handler);
    return () => window.removeEventListener('crimealert-lightbox', handler);
  }, []);

  useEffect(() => {
    onSelectIncidentRef.current = onSelectIncident;
  }, [onSelectIncident]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [62.0, 16.0],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
      touchZoom: 'center',
      bounceAtZoomLimits: false,
      preferCanvas: true,
      inertia: true,
      inertiaDeceleration: 2800,
      zoomAnimation: !isTouch,
    } as L.MapOptions & { tap?: boolean });

    // Disable Leaflet's built-in tap handler to avoid 200ms delay & ghost clicks on mobile
    if ((map as any).tap) (map as any).tap.disable();

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OSM &copy; CARTO',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    // Update pulse size CSS variable based on zoom
    const updatePulseSize = () => {
      const zoom = map.getZoom();
      // Scale from 220% at zoom 5 to 500% at zoom 16
      const pulsePct = Math.round(220 + (zoom - 5) * (280 / 11));
      const clamped = Math.max(200, Math.min(550, pulsePct));
      const offset = Math.round((clamped - 100) / 2);
      containerRef.current?.style.setProperty('--pulse-size', `${clamped}%`);
      containerRef.current?.style.setProperty('--pulse-offset', `-${offset}%`);
    };

    updatePulseSize();
    map.on('zoomend', updatePulseSize);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [isTouch]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    markerMapRef.current.clear();

    // De-overlap: push markers apart so none visually overlap
    // Sort by time descending so newer incidents keep their position and older ones get pushed
    const sortedIndices = incidents
      .map((inc, idx) => ({ idx, time: parseSwedishDate(inc.time)?.getTime() || 0 }))
      .sort((a, b) => b.time - a.time)
      .map(e => e.idx);

    const minDist = isTouch ? 0.003 : 0.005;
    const maxIterations = isTouch ? 5 : 12;
    const shouldRunRepulsion = incidents.length <= (isTouch ? 180 : 450);
    const positions = incidents.map((inc) => ({ lat: inc.lat, lng: inc.lng }));

    if (shouldRunRepulsion) {
      for (let iter = 0; iter < maxIterations; iter++) {
        let moved = false;
        for (let si = 0; si < sortedIndices.length; si++) {
          const i = sortedIndices[si];
          for (let sj = si + 1; sj < sortedIndices.length; sj++) {
            const j = sortedIndices[sj];
            const dLat = positions[j].lat - positions[i].lat;
            const dLng = positions[j].lng - positions[i].lng;
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);
            if (dist < minDist && dist > 0) {
              // Push the older incident (j, since sorted newer-first) away more
              const push = (minDist - dist);
              const nLat = dLat / dist;
              const nLng = dLng / dist;
              positions[j].lat += nLat * push * 0.8;
              positions[j].lng += nLng * push * 0.8;
              positions[i].lat -= nLat * push * 0.2;
              positions[i].lng -= nLng * push * 0.2;
              moved = true;
            } else if (dist === 0) {
              // Exact same coords: deterministic spread based on index
              const angle = (sj / sortedIndices.length) * Math.PI * 2 + (sj * 2.399);
              positions[j].lat += Math.cos(angle) * minDist * 0.7;
              positions[j].lng += Math.sin(angle) * minDist * 0.7;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }

    incidents.forEach((inc, idx) => {
      const isCommunityReport = inc.source === 'Medborgarrapport';
      const config = incidentTypeConfig[inc.type];
      const color = isCommunityReport ? COMMUNITY_REPORT_COLOR : config.color;
      const adjustedLat = positions[idx].lat;
      const adjustedLng = positions[idx].lng;

      // Skip heavy radius effects on touch devices for smoother panning/tapping
      const parsedTime = parseSwedishDate(inc.time);
      const ageMs = parsedTime ? Date.now() - parsedTime.getTime() : Number.POSITIVE_INFINITY;
      if (!isTouch && (isCommunityReport || ageMs < 3 * 60 * 60 * 1000)) {
        const circleOptions = isCommunityReport
          ? { radius: 600, color: COMMUNITY_REPORT_COLOR, fillColor: COMMUNITY_REPORT_COLOR, fillOpacity: 0.12, weight: 2, opacity: 0.5, dashArray: '6 4', interactive: false }
          : { radius: 500, color, fillColor: color, fillOpacity: 0.08, weight: 1, opacity: 0.3, interactive: false };
        const circle = L.circle([adjustedLat, adjustedLng], circleOptions);
        markersRef.current!.addLayer(circle);
      }

      const marker = L.marker([adjustedLat, adjustedLng], {
        icon: createMarkerIcon(inc, isTouch),
        keyboard: false,
      });

      marker.bindPopup(createPopupContent(inc, isPremium), {
        className: 'incident-popup',
        maxWidth: 320,
        closeButton: true,
        autoPan: true,
        autoPanPadding: L.point(40, 40),
      });

      const handleSelect = () => onSelectIncidentRef.current(inc.id);
      marker.on('click', handleSelect);
      marker.on('touchend', handleSelect);
      marker.on('popupopen', () => {
        const safeId = inc.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const el = document.getElementById(`popup-engagement-${safeId}`);
        if (el && !el.dataset.mounted) {
          el.dataset.mounted = 'true';
          const root = createRoot(el);
          root.render(
            <AuthProvider>
              <QueryClientProvider client={popupQueryClient}>
                <PopupEngagement incidentId={inc.id} />
              </QueryClientProvider>
            </AuthProvider>
          );
          (el as any).__reactRoot = root;
        }
      });
      marker.on('popupclose', () => {
        const safeId = inc.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const el = document.getElementById(`popup-engagement-${safeId}`);
        if (el && (el as any).__reactRoot) {
          const root = (el as any).__reactRoot as Root;
          setTimeout(() => root.unmount(), 0);
          delete (el as any).__reactRoot;
        }
        prevSelectedRef.current = null;
        onSelectIncidentRef.current('');
      });

      markersRef.current!.addLayer(marker);
      markerMapRef.current.set(inc.id, marker);
    });
  }, [incidents, isPremium, isTouch]);

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapRef.current || !selectedId || selectedId === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedId;
    const inc = incidents.find((i) => i.id === selectedId);
    if (inc) {
      const map = mapRef.current;
      const targetZoom = 14;
      const targetPoint = map.project([inc.lat, inc.lng], targetZoom);
      targetPoint.y -= 120;
      const targetLatLng = map.unproject(targetPoint, targetZoom);
      map.flyTo(targetLatLng, targetZoom, { duration: 0.8 });
      
      setTimeout(() => {
        const marker = markerMapRef.current.get(inc.id);
        if (marker && !marker.isPopupOpen()) marker.openPopup();
      }, 850);
    }
  }, [selectedId, incidents]);

  // Fly to searched location
  useEffect(() => {
    if (!mapRef.current || !flyToLocation) return;
    mapRef.current.flyTo([flyToLocation.lat, flyToLocation.lng], flyToLocation.zoom, { duration: 1.2 });
  }, [flyToLocation]);

  return (
    <div ref={containerRef} className="w-full h-full bg-muted" style={{ touchAction: 'pan-x pan-y' }}>
      <style>{`
        .leaflet-container {
          touch-action: pan-x pan-y;
        }
        .custom-marker {
          overflow: visible !important;
          background: none !important;
          border: none !important;
          touch-action: manipulation;
        }
        .marker-pulse {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          -webkit-animation: marker-pulse-anim 2s ease-in-out infinite;
          animation: marker-pulse-anim 2s ease-in-out infinite;
          will-change: opacity, width, height, top, left;
        }
        @-webkit-keyframes marker-pulse-anim {
          0%, 100% { opacity: 0.4; width: 100%; height: 100%; top: 0; left: 0; }
          50% { opacity: 0; width: var(--pulse-size, 350%); height: var(--pulse-size, 350%); top: var(--pulse-offset, -125%); left: var(--pulse-offset, -125%); }
        }
        @keyframes marker-pulse-anim {
          0%, 100% { opacity: 0.4; width: 100%; height: 100%; top: 0; left: 0; }
          50% { opacity: 0; width: var(--pulse-size, 350%); height: var(--pulse-size, 350%); top: var(--pulse-offset, -125%); left: var(--pulse-offset, -125%); }
        }
        .marker-pulse-community {
          position: absolute;
          border-radius: 4px;
          pointer-events: none;
          -webkit-animation: marker-pulse-community-anim 2s ease-in-out infinite;
          animation: marker-pulse-community-anim 2s ease-in-out infinite;
          will-change: opacity, width, height, top, left;
        }
        @-webkit-keyframes marker-pulse-community-anim {
          0%, 100% { opacity: 0.3; width: 100%; height: 100%; top: 0; left: 0; -webkit-transform: rotate(45deg); transform: rotate(45deg); }
          50% { opacity: 0; width: 280%; height: 280%; top: -90%; left: -90%; -webkit-transform: rotate(45deg); transform: rotate(45deg); }
        }
        @keyframes marker-pulse-community-anim {
          0%, 100% { opacity: 0.3; width: 100%; height: 100%; top: 0; left: 0; transform: rotate(45deg); }
          50% { opacity: 0; width: 280%; height: 280%; top: -90%; left: -90%; transform: rotate(45deg); }
        }
        .leaflet-control-zoom a {
          background: hsl(0, 0%, 100%) !important;
          color: hsl(222, 20%, 20%) !important;
          border-color: hsl(220, 10%, 85%) !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(220, 10%, 95%) !important;
        }
        .incident-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          max-width: 340px;
        }
        .incident-popup .leaflet-popup-content {
          margin: 8px;
        }
        .incident-popup .leaflet-popup-tip {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .custom-cluster-icon {
          background: transparent !important;
        }
      `}</style>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
          style={{ cursor: 'pointer' }}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition z-10"
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Rapportbild"
            className="max-w-full max-h-[85vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default MapView;
