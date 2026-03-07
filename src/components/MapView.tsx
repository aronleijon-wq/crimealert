import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';

interface MapViewProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelectIncident: (id: string) => void;
  isPremium?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  police: '🛡️',
  fire: '🔥',
  ambulance: '🚑',
  traffic: '🚗',
  other: '⚠️',
};

const createMarkerIcon = (incident: Incident) => {
  const config = incidentTypeConfig[incident.type];
  const ageMs = Date.now() - new Date(incident.time).getTime();
  const isRecent = ageMs < 3 * 60 * 60 * 1000; // under 3 hours
  const size = isRecent ? 14 : 10;
  const pulseSize = size + 16;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;">
        ${isRecent ? `<div class="marker-pulse" style="position:absolute;inset:0;border-radius:50%;background:${config.color};"></div>` : ''}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${config.color};border:2px solid rgba(255,255,255,0.9);position:relative;z-index:2;box-shadow:0 1px 6px ${config.color}80;"></div>
      </div>
    `,
    iconSize: [pulseSize, pulseSize],
    iconAnchor: [pulseSize / 2, pulseSize / 2],
  });
};

const formatTime = (time: string) => {
  try {
    const d = new Date(time);
    return d.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return time;
  }
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

const getTimeAgo = (time: string): string => {
  try {
    const diff = Date.now() - new Date(time).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}min sedan`;
    return `${Math.floor(hours / 24)}d sedan`;
  } catch { return ''; }
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

  return `
    <div style="font-family:system-ui;min-width:260px;max-width:320px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:22px;">${TYPE_ICONS[inc.type] || '⚠️'}</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;line-height:1.3;">${inc.title}</div>
          <div style="font-size:10px;color:#888;margin-top:2px;">${config.label} • <span style="font-weight:600;color:#555;">🕐 ${timeAgo}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          ${isPremium
            ? `<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;background:${statusBg};color:${statusColor};">${statusLabel}</span>
               <span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;background:${riskBg};color:${riskColor};">Risk: ${risk.label}</span>`
            : `<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;background:#f3f4f6;color:#aaa;">🔒 Pro</span>`
          }
        </div>
      </div>

      ${isPremium && inc.description ? `<p style="font-size:11px;color:#444;margin:0 0 10px;line-height:1.6;border-left:3px solid ${config.color};padding-left:8px;">${inc.description}</p>` : !isPremium ? `<p style="font-size:10px;color:#aaa;margin:0 0 10px;font-style:italic;">🔒 Detaljerad beskrivning kräver Pro-medlemskap</p>` : ''}

      ${isPremium && extractedDetails.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        ${extractedDetails.map(d => `
          <span style="font-size:9px;padding:3px 7px;border-radius:12px;background:#f1f5f9;color:#475569;display:inline-flex;align-items:center;gap:3px;border:1px solid #e2e8f0;">
            <span>${d.icon}</span>
            <span style="font-weight:600;">${d.label}:</span> ${d.value}
          </span>
        `).join('')}
      </div>
      ` : ''}

      ${isPremium ? `
      <div style="background:${riskBg};border:1px solid ${riskColor}20;border-radius:6px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:9px;font-weight:700;color:${riskColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚠ Riskbedömning</div>
        <p style="font-size:10px;color:#555;margin:0;line-height:1.6;">${riskDesc}</p>
      </div>

      <div style="background:#f0f4ff;border:1px solid #dbeafe;border-radius:6px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:9px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">ℹ Rekommendation</div>
        <p style="font-size:10px;color:#555;margin:0;line-height:1.6;">${getRecommendation(inc.risk, inc.type)}</p>
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
          <span style="color:#333;font-weight:600;">${inc.area}</span>
        </div>
        <div style="background:#f8f8f8;padding:6px 8px;border-radius:5px;">
          <span style="color:#aaa;font-size:9px;">🕐 Tidpunkt</span><br/>
          <span style="color:#333;font-weight:500;">${formatTime(inc.time)}</span>
        </div>
        <div style="background:#f8f8f8;padding:6px 8px;border-radius:5px;">
          <span style="color:#aaa;font-size:9px;">📋 Typ</span><br/>
          <span style="color:#333;font-weight:500;">${config.label}</span>
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
        <span>Källa: ${inc.source || 'Okänd'}</span>
        <span>CrimeAlert</span>
      </div>
    </div>
  `;
};

const MapView = ({ incidents, selectedId, onSelectIncident, isPremium = false }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [62.0, 16.0],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OSM &copy; CARTO',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    markerMapRef.current.clear();

    // Group incidents by coordinates to detect overlaps
    const coordKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const coordGroups = new Map<string, number>();
    const coordIndex = new Map<string, number>();
    
    // Count incidents per location
    incidents.forEach((inc) => {
      const key = coordKey(inc.lat, inc.lng);
      coordGroups.set(key, (coordGroups.get(key) || 0) + 1);
    });

    incidents.forEach((inc) => {
      const config = incidentTypeConfig[inc.type];
      const key = coordKey(inc.lat, inc.lng);
      const totalAtLocation = coordGroups.get(key) || 1;
      const indexAtLocation = coordIndex.get(key) || 0;
      coordIndex.set(key, indexAtLocation + 1);

      // Spread out overlapping markers in a circle pattern (~0.01° ≈ 1km offset)
      let adjustedLat = inc.lat;
      let adjustedLng = inc.lng;
      if (totalAtLocation > 1) {
        const angle = (2 * Math.PI * indexAtLocation) / totalAtLocation;
        const radius = 0.008 + (totalAtLocation > 6 ? 0.004 : 0);
        adjustedLat += Math.cos(angle) * radius;
        adjustedLng += Math.sin(angle) * radius;
      }
      
      // Only show radius circle for recent incidents (under 2 hours)
      const ageMs = Date.now() - new Date(inc.time).getTime();
      if (ageMs < 2 * 60 * 60 * 1000) {
        const circle = L.circle([adjustedLat, adjustedLng], {
          radius: 500,
          color: config.color,
          fillColor: config.color,
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.3,
        });
        markersRef.current!.addLayer(circle);
      }

      const marker = L.marker([adjustedLat, adjustedLng], { icon: createMarkerIcon(inc) });
      marker.bindPopup(createPopupContent(inc, isPremium), {
        className: 'incident-popup',
        maxWidth: 320,
        closeButton: true,
        autoPan: true,
        autoPanPadding: L.point(40, 40),
      });
      marker.on('click', () => onSelectIncident(inc.id));
      markersRef.current!.addLayer(marker);
      markerMapRef.current.set(inc.id, marker);
    });
  }, [incidents, onSelectIncident, isPremium]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const inc = incidents.find((i) => i.id === selectedId);
    if (inc) {
      // Offset the flyTo slightly upward so the popup appears centered
      const map = mapRef.current;
      const targetZoom = 14;
      const targetPoint = map.project([inc.lat, inc.lng], targetZoom);
      // Shift down by ~120px so popup content appears more centered
      targetPoint.y -= 120;
      const targetLatLng = map.unproject(targetPoint, targetZoom);
      map.flyTo(targetLatLng, targetZoom, { duration: 0.8 });
      
      setTimeout(() => {
        const marker = markerMapRef.current.get(inc.id);
        if (marker) marker.openPopup();
      }, 850);
    }
  }, [selectedId, incidents]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: '#f0f0f0' }}>
      <style>{`
        .custom-marker {
          overflow: visible !important;
          background: none !important;
          border: none !important;
        }
        .marker-pulse {
          opacity: 0.3;
          -webkit-animation: marker-pulse-anim 2s ease-in-out infinite;
          animation: marker-pulse-anim 2s ease-in-out infinite;
        }
        @-webkit-keyframes marker-pulse-anim {
          0%, 100% { opacity: 0.3; -webkit-transform: scale(1); transform: scale(1); }
          50% { opacity: 0; -webkit-transform: scale(2.8); transform: scale(2.8); }
        }
        @keyframes marker-pulse-anim {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0; transform: scale(2.8); }
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
    </div>
  );
};

export default MapView;
