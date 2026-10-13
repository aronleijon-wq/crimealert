import { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';
import { sanitizeHTML, safeImageUrl } from '@/lib/sanitize';
import PopupEngagement from './PopupEngagement';
import { isPoliceEvent } from '@/lib/share';
import { HeatLayer, type HeatPoint } from '@/lib/heatLayer';
import { AuthValueProvider, useAuth } from '@/hooks/useAuth';
import { svgIcon, TYPE_ICON } from '@/lib/svgIcons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

declare global {
  interface Window {
    // Set by the onclick attribute on popup images (see createPopupContent)
    __crimeAlertLightbox?: string | null;
  }
}

// Popup containers keep a handle to the React root mounted inside them
type PopupRootElement = HTMLElement & { __reactRoot?: Root };

interface MapViewProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelectIncident: (id: string) => void;
  isPremium?: boolean;
  flyToLocation?: { lat: number; lng: number; zoom: number } | null;
  /** Shown as a heatmap (the timeline's heat view); null for none */
  heatPoints?: HeatPoint[] | null;
}

const COMMUNITY_REPORT_COLOR = '#f97316'; // orange

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const isWithinHours = (timeStr: string, hours: number) => {
  const d = parseIncidentTime(timeStr);
  if (!d) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
};

const isWithinDays = (timeStr: string, days: number) => {
  const d = parseIncidentTime(timeStr);
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

const shouldIncidentPulse = (incident: Incident) => {
  if (incident.source === 'Medborgarrapport') return isWithinHours(incident.time, 24);
  if (isMissingPersonIncident(incident)) return isWithinHours(incident.time, 24);
  return isWithinHours(incident.time, 3);
};

// On phones: at most this many pulsing markers, the newest from the last hour
const TOUCH_MAX_PULSING = 8;
const TOUCH_PULSE_HOURS = 1;

/** The events that pulse on a phone: the newest few within the hour, citizen reports included. */
function touchPulseIds(incidents: Incident[], now = Date.now()): Set<string> {
  return new Set(
    incidents
      .map((incident) => ({ incident, at: parseIncidentTime(incident.time)?.getTime() ?? NaN }))
      .filter(({ incident, at }) => shouldIncidentPulse(incident) && now - at <= TOUCH_PULSE_HOURS * 3600e3)
      .sort((a, b) => b.at - a.at)
      .slice(0, TOUCH_MAX_PULSING)
      .map(({ incident }) => incident.id),
  );
}

const createMarkerIcon = (incident: Incident, touch: boolean, pulse = shouldIncidentPulse(incident)) => {
  const isCommunityReport = incident.source === 'Medborgarrapport';
  const config = incidentTypeConfig[incident.type];
  const color = isCommunityReport ? COMMUNITY_REPORT_COLOR : config.color;
  const shouldPulse = pulse;
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
          <span style="position:absolute;z-index:3;display:flex;pointer-events:none;">${svgIcon('eye', touch ? 13 : 10, '#fff', 2.5)}</span>
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
  const d = parseIncidentTime(time);
  if (!d) return time;
  return d.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getTimeAgo = (time: string): string => {
  const d = parseIncidentTime(time);
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
const extractDetails = (desc: string, title: string, originalType?: string): { label: string; value: string }[] => {
  const details: { label: string; value: string }[] = [];
  const text = `${title} ${desc}`.toLowerCase();

  // Original crime type from Polisen.se
  if (originalType && originalType.length > 0) {
    details.push({ label: 'Brottstyp', value: originalType });
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
      details.push({ label, value: match[0].charAt(0).toUpperCase() + match[0].slice(1) });
      break;
    }
  }

  // Vehicles
  const vehiclePatterns = /(?:personbil|lastbil|mc|motorcykel|moped|buss|cykel|fordon|bil|truck|husbil|fyrhjuling|elscooter|elsparkcykel)/i;
  const vehicleMatch = desc.match(vehiclePatterns);
  if (vehicleMatch) {
    details.push({ label: 'Fordon', value: vehicleMatch[0].charAt(0).toUpperCase() + vehicleMatch[0].slice(1) });
  }

  // Weapons/tools
  const weaponPatterns = /(?:kniv|skjutvapen|pistol|gevär|yxa|machete|tillhygge|vapen|skott|ammunition)/i;
  const weaponMatch = desc.match(weaponPatterns);
  if (weaponMatch) {
    details.push({ label: 'Vapen/verktyg', value: weaponMatch[0].charAt(0).toUpperCase() + weaponMatch[0].slice(1) });
  }

  // Road/location from description
  const roadPatterns = /(?:E\d+|(?:riksväg|länsväg)\s*\d+|[A-ZÅÄÖ][a-zåäöé]+(?:gatan|vägen|torget|platsen|allén|bron|leden)(?:\s+\d+)?)/;
  const roadMatch = desc.match(roadPatterns);
  if (roadMatch) {
    details.push({ label: 'Plats', value: roadMatch[0] });
  }

  // Alcohol/drugs
  if (/(?:rattfyller|alkohol|berus|narkotika|drog|påverkad|blåste)/i.test(text)) {
    details.push({ label: 'Påverkan', value: 'Misstänkt påverkan' });
  }

  // Animals (vilt)
  const animalPatterns = /(?:älg|rådjur|vildsvin|hjort|ren|varg|björn|lo|vilt)/i;
  const animalMatch = desc.match(animalPatterns);
  if (animalMatch) {
    details.push({ label: 'Djur', value: animalMatch[0].charAt(0).toUpperCase() + animalMatch[0].slice(1) });
  }

  return details;
};


const P_DARK = {
  text: '#eef1f5',
  dim: '#8b96a3',
  faint: '#5d6874',
  line: 'rgba(255,255,255,0.08)',
  lineSoft: 'rgba(255,255,255,0.05)',
  panel: 'rgba(255,255,255,0.035)',
  cell: 'hsl(213,27%,6%)',
  red: '#e04a4a',
  amber: '#e08a3c',
  green: '#3fbf7f',
};

const P_LIGHT = {
  text: '#111827',
  dim: '#4b5563',
  faint: '#6b7280',
  line: 'rgba(17,24,39,0.12)',
  lineSoft: 'rgba(17,24,39,0.07)',
  panel: 'rgba(17,24,39,0.035)',
  cell: '#ffffff',
  red: '#c92a2a',
  amber: '#b45309',
  green: '#177245',
};

const isLightMode = () =>
  typeof document !== 'undefined' && !document.documentElement.classList.contains('dark');

const createPopupContent = (inc: Incident, isPremium: boolean, compact = false) => {
  const P = isLightMode() ? P_LIGHT : P_DARK;

  const config = incidentTypeConfig[inc.type];
  const risk = riskConfig[inc.risk];
  const riskColor = inc.risk === 'high' ? P.red : inc.risk === 'medium' ? P.amber : P.green;
  const statusLabel = inc.status === 'active' ? 'Pågående' : 'Avslutad';
  const statusColor = inc.status === 'active' ? P.red : P.green;
  const riskDesc = getRiskDescription(inc.risk, inc.type);
  const timeAgo = getTimeAgo(inc.time);
  const extractedDetails = extractDetails(inc.description, inc.title, inc.originalType);
  // Official warnings (VMA, Krisinformation) and police summaries are shown in full to everyone
  const descriptionIsFree = inc.type === 'crisis' || !!inc.originalType?.toLowerCase().includes('sammanfattning');
  const sourceUrl = inc.type === 'crisis' && inc.url && /^https:\/\//.test(inc.url) ? sanitizeHTML(inc.url) : null;

  // Sanitize all dynamic incident data
  const safeTitle = sanitizeHTML(inc.title);
  const safeDescription = sanitizeHTML(inc.description);
  const safeArea = sanitizeHTML(inc.area);
  const safeSource = sanitizeHTML(inc.source || 'Okänd');
  const safeConfigLabel = sanitizeHTML(config.label);
  const safeRiskLabel = sanitizeHTML(risk.label);

  const mono = "'JetBrains Mono', ui-monospace, monospace";
  const label = (t: string) =>
    `<span style="font-family:${mono};font-size:${compact ? 7 : 8.5}px;letter-spacing:0.16em;text-transform:uppercase;color:${P.faint};">${t}</span>`;

  // compact = tighter shell, ALL content preserved
  const sz = (normal: number, small: number) => compact ? small : normal;

  return `
    <div class="ca-pop" style="font-family:Inter,system-ui,sans-serif;color:${P.text};min-width:${sz(268,200)}px;max-width:${sz(324,250)}px;${compact ? 'max-height:55vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-right:2px;' : ''}">
      <div class="ca-pop-scan"></div>

      <div style="display:flex;align-items:flex-start;gap:${sz(9,6)}px;padding-bottom:${sz(9,6)}px;border-bottom:1px solid ${P.line};margin-bottom:${sz(10,6)}px;">
        <span style="display:inline-flex;margin-top:1px;color:${config.color};">${svgIcon(TYPE_ICON[inc.type] ?? 'triangle-alert', sz(18, 14))}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-family:Archivo,Inter,sans-serif;font-weight:800;letter-spacing:-0.02em;font-size:${sz(14,11.5)}px;line-height:1.2;color:${P.text};">${safeTitle}</div>
          <div style="font-family:${mono};font-size:${sz(9,7.5)}px;letter-spacing:0.12em;text-transform:uppercase;color:${P.dim};margin-top:5px;">${safeConfigLabel} · ${timeAgo}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
          ${isPremium
            ? `<span style="font-family:${mono};font-size:${sz(8.5,7)}px;letter-spacing:0.1em;text-transform:uppercase;padding:2px ${sz(6,4)}px;border-radius:3px;border:1px solid ${statusColor}55;background:${statusColor}1a;color:${statusColor};">${statusLabel}</span>
               <span style="font-family:${mono};font-size:${sz(8.5,7)}px;letter-spacing:0.1em;text-transform:uppercase;padding:2px ${sz(6,4)}px;border-radius:3px;border:1px solid ${riskColor}55;background:${riskColor}1a;color:${riskColor};">${safeRiskLabel}</span>`
            : `<span style="font-family:${mono};font-size:${sz(8.5,7)}px;letter-spacing:0.1em;padding:2px ${sz(6,4)}px;border-radius:3px;border:1px solid ${P.line};background:${P.panel};color:${P.faint};display:inline-flex;align-items:center;gap:3px;">${svgIcon('lock', sz(10, 8))} PRO</span>`
          }
        </div>
      </div>

      ${(isPremium || descriptionIsFree) && inc.description
        ? `<p style="font-size:${sz(11.5,9.5)}px;color:${P.dim};margin:0 0 ${sz(11,6)}px;line-height:1.6;border-left:2px solid ${config.color};padding-left:${sz(9,6)}px;">${safeDescription}</p>`
        : !isPremium && !descriptionIsFree
          ? `<p style="font-family:${mono};font-size:${sz(9.5,8)}px;color:${P.faint};margin:0 0 ${sz(11,6)}px;display:flex;align-items:center;gap:5px;">${svgIcon('lock', sz(11, 9))} Detaljerad beskrivning kräver Pro</p>`
          : ''}

      ${(() => {
        const imgUrl = safeImageUrl(inc.image_url);
        if (!imgUrl) return '';
        const attrUrl = sanitizeHTML(imgUrl);
        const jsUrl = sanitizeHTML(encodeURIComponent(imgUrl));
        return `
      <div style="margin-bottom:${sz(10,6)}px;">
        <img src="${attrUrl}" alt="Rapportbild"
          style="width:100%;max-height:${sz(120,80)}px;object-fit:cover;border-radius:4px;border:1px solid ${P.line};cursor:pointer;"
          onclick="window.__crimeAlertLightbox=decodeURIComponent('${jsUrl}');window.dispatchEvent(new CustomEvent('crimealert-lightbox'))" />
        <div style="font-family:${mono};font-size:${sz(8.5,7)}px;color:${P.faint};margin-top:4px;text-align:center;letter-spacing:0.1em;">KLICKA FÖR ATT FÖRSTORA</div>
      </div>
      `;
      })()}

      ${isPremium && extractedDetails.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:${sz(4,3)}px;margin-bottom:${sz(11,6)}px;">
        ${extractedDetails.map(d => `
          <span style="font-family:${mono};font-size:${sz(8.5,7)}px;padding:${sz(3,2)}px ${sz(7,5)}px;border-radius:3px;background:${P.panel};color:${P.dim};display:inline-flex;align-items:center;gap:4px;border:1px solid ${P.lineSoft};">
            <span style="color:${P.faint};">${sanitizeHTML(d.label)}</span> ${sanitizeHTML(d.value)}
          </span>
        `).join('')}
      </div>
      ` : ''}

      ${isPremium ? `
      <div style="background:${riskColor}12;border:1px solid ${riskColor}33;border-radius:4px;padding:${sz(10,6)}px ${sz(11,7)}px;margin-bottom:${sz(11,6)}px;">
        <div style="font-family:${mono};font-size:${sz(8.5,7)}px;font-weight:600;color:${riskColor};text-transform:uppercase;letter-spacing:0.18em;margin-bottom:5px;">Riskbedömning</div>
        <p style="font-size:${sz(10.5,8.5)}px;color:${P.dim};margin:0;line-height:1.6;">${riskDesc}</p>
      </div>
      ` : `
      <div style="background:${P.panel};border:1px solid ${P.line};border-radius:4px;padding:${sz(10,6)}px ${sz(11,7)}px;margin-bottom:${sz(11,6)}px;text-align:center;">
        <div style="font-family:${mono};font-size:${sz(9,7.5)}px;color:${P.dim};letter-spacing:0.12em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:5px;">${svgIcon('lock', sz(11, 9))} Riskbedömning</div>
        <div style="font-family:${mono};font-size:${sz(8.5,7)}px;color:${P.faint};margin-top:3px;">Tillgängligt med Pro</div>
      </div>
      `}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:${P.line};border:1px solid ${P.line};border-radius:4px;overflow:hidden;margin-bottom:${sz(8,5)}px;">
        <div style="background:${P.cell};padding:${sz(7,4)}px ${sz(9,6)}px;">
          ${label('Område')}<br/>
          <span style="font-size:${sz(11,9)}px;font-weight:600;color:${P.text};">${safeArea}</span>
        </div>
        <div style="background:${P.cell};padding:${sz(7,4)}px ${sz(9,6)}px;">
          ${label('Tidpunkt')}<br/>
          <span style="font-family:${mono};font-size:${sz(10.5,8.5)}px;color:${P.text};">${formatTime(inc.time)}</span>
        </div>
        <div style="background:${P.cell};padding:${sz(7,4)}px ${sz(9,6)}px;">
          ${label('Typ')}<br/>
          <span style="font-size:${sz(11,9)}px;color:${P.text};">${safeConfigLabel}</span>
        </div>
        <div style="background:${P.cell};padding:${sz(7,4)}px ${sz(9,6)}px;">
          ${label('Status')}<br/>
          ${isPremium
            ? `<span style="font-size:${sz(11,9)}px;font-weight:600;color:${statusColor};">${statusLabel}</span>`
            : `<span style="font-size:${sz(11,9)}px;color:${P.faint};display:inline-flex;align-items:center;gap:4px;">${svgIcon('lock', sz(11, 9))} Pro</span>`
          }
        </div>
      </div>

      ${inc.approximate ? `<div style="font-family:${mono};font-size:${sz(8.5,7)}px;color:${P.amber};background:${P.amber}12;border:1px solid ${P.amber}33;padding:${sz(5,3)}px ${sz(8,5)}px;border-radius:3px;">⊙ Positionen är approximerad</div>` : ''}

      <div style="margin-top:${sz(8,5)}px;padding-top:${sz(7,4)}px;border-top:1px solid ${P.line};font-family:${mono};font-size:${sz(8.5,7)}px;letter-spacing:0.12em;text-transform:uppercase;color:${P.faint};display:flex;justify-content:space-between;">
        <span>${sourceUrl
          ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">${safeSource} ↗</a>`
          : safeSource.toLowerCase().includes('polisen') ? `<a href="https://polisen.se/aktuellt/polisens-nyheter/" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${safeSource}</a>` : safeSource}</span>
        <span>CrimeAlert</span>
      </div>

      <div id="popup-engagement-${inc.id.replace(/[^a-zA-Z0-9_-]/g, '_')}" data-incident-id="${inc.id}"></div>
    </div>
  `;
};


const MapView = ({ incidents, selectedId, onSelectIncident, isPremium = false, flyToLocation, heatPoints = null }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker | L.CircleMarker>>(new Map());
  // Quiet (non-pulsing) events are drawn on one canvas instead of one element each, which
  // keeps panning smooth on phones with hundreds of events. Taps get a wider hit area.
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouch = useRef(isTouchDevice()).current;
  const onSelectIncidentRef = useRef(onSelectIncident);
  const popupQueryClient = useRef(new QueryClient()).current;
  // Popups are separate React roots; give them the app's auth state instead of their own
  // AuthProvider, which would call check-subscription again for every opened popup
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Listen for lightbox events from popup image clicks
  useEffect(() => {
    const handler = () => {
      const url = window.__crimeAlertLightbox;
      if (url) {
        setLightboxUrl(url);
        window.__crimeAlertLightbox = null;
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
    (map as L.Map & { tap?: L.Handler }).tap?.disable();

    const ESRI_DARK =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    const ESRI_LIGHT =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

    const tiles = L.tileLayer(isLightMode() ? ESRI_LIGHT : ESRI_DARK, {
      maxZoom: 16,
      maxNativeZoom: 16,
      attribution: '&copy; Esri &copy; OpenStreetMap contributors',
      className: 'ca-tiles',
    }).addTo(map);

    // Byt basemap när användaren växlar mellan ljust och mörkt läge
    const themeObserver = new MutationObserver(() => {
      tiles.setUrl(isLightMode() ? ESRI_LIGHT : ESRI_DARK);
    });

    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });



    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    canvasRendererRef.current = L.canvas({ padding: 0.5, tolerance: isTouch ? 10 : 3 });

    // Update pulse size CSS variable based on zoom
    const updatePulseSize = () => {
      const zoom = map.getZoom();
      // Scale from 220% at zoom 5 to 500% at zoom 16
      const pulsePct = Math.round(220 + (zoom - 5) * (280 / 11));
      const clamped = Math.max(200, Math.min(550, pulsePct));
      containerRef.current?.style.setProperty('--pulse-scale', String(clamped / 100));
    };

    updatePulseSize();
    map.on('zoomend', updatePulseSize);

    return () => {
      themeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      canvasRendererRef.current = null;
    };

  }, [isTouch]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    markerMapRef.current.clear();

    const recentIncidents = incidents.filter((inc) => isWithinDays(inc.time, 7));
    const positions = getJitteredPositions(recentIncidents);
    // Phones animate only the newest few events: every pulsing marker is an element of its own
    // that the phone redraws each frame while panning. The rest are dots on the shared canvas.
    const pulsing = isTouch ? touchPulseIds(recentIncidents) : null;

    const addMarker = (inc: Incident, idx: number) => {
      const isCommunityReport = inc.source === 'Medborgarrapport';
      const config = incidentTypeConfig[inc.type];
      const color = isCommunityReport ? COMMUNITY_REPORT_COLOR : config.color;
      const adjustedLat = positions[idx].lat;
      const adjustedLng = positions[idx].lng;

      // Skip heavy radius effects on touch devices for smoother panning/tapping
      const parsedTime = parseIncidentTime(inc.time);
      const ageMs = parsedTime ? Date.now() - parsedTime.getTime() : Number.POSITIVE_INFINITY;
      if (!isTouch && (isCommunityReport || ageMs < 3 * 60 * 60 * 1000)) {
        const circleOptions = isCommunityReport
          ? { radius: 600, color: COMMUNITY_REPORT_COLOR, fillColor: COMMUNITY_REPORT_COLOR, fillOpacity: 0.12, weight: 2, opacity: 0.5, dashArray: '6 4', interactive: false }
          : { radius: 500, color, fillColor: color, fillOpacity: 0.08, weight: 1, opacity: 0.3, interactive: false };
        const circle = L.circle([adjustedLat, adjustedLng], circleOptions);
        markersRef.current!.addLayer(circle);
      }

      // Pulsing (recent) events and citizen reports keep their animated markers; the rest
      // are plain dots on the shared canvas, drawn the same: colour, white rim
      const quiet = pulsing ? !pulsing.has(inc.id) : !isCommunityReport && !shouldIncidentPulse(inc);
      const marker: L.Marker | L.CircleMarker = quiet
        ? L.circleMarker([adjustedLat, adjustedLng], {
          renderer: canvasRendererRef.current ?? undefined,
          radius: isTouch ? 8 : 5,
          color: 'rgba(255,255,255,0.9)',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        })
        : L.marker([adjustedLat, adjustedLng], {
          icon: createMarkerIcon(inc, isTouch, pulsing ? pulsing.has(inc.id) : undefined),
          keyboard: false,
        });

      // Built when the popup opens rather than for every marker up front
      marker.bindPopup(() => createPopupContent(inc, isPremium, isTouch), {
        className: 'incident-popup',
        maxWidth: isTouch ? 250 : 320,
        closeButton: true,
        autoPan: true,
        autoPanPadding: L.point(isTouch ? 15 : 40, isTouch ? 15 : 40),
      });

      const handleSelect = () => onSelectIncidentRef.current(inc.id);
      marker.on('click', handleSelect);
      if (!quiet) marker.on('touchend', handleSelect);
      marker.on('popupopen', () => {
        const safeId = inc.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const el = document.getElementById(`popup-engagement-${safeId}`) as PopupRootElement | null;
        if (el && !el.dataset.mounted) {
          el.dataset.mounted = 'true';
          const root = createRoot(el);
          root.render(
            <AuthValueProvider value={authRef.current}>
              <QueryClientProvider client={popupQueryClient}>
                <PopupEngagement incidentId={inc.id} share={isPoliceEvent(inc) ? { title: inc.title, area: inc.area } : undefined} />
              </QueryClientProvider>
            </AuthValueProvider>
          );
          el.__reactRoot = root;
        }
      });
      marker.on('popupclose', () => {
        const safeId = inc.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const el = document.getElementById(`popup-engagement-${safeId}`) as PopupRootElement | null;
        if (el?.__reactRoot) {
          const root = el.__reactRoot;
          setTimeout(() => root.unmount(), 0);
          delete el.__reactRoot;
        }
        prevSelectedRef.current = null;
        onSelectIncidentRef.current('');
      });

      markersRef.current!.addLayer(marker);
      markerMapRef.current.set(inc.id, marker);
    };

    recentIncidents.forEach(addMarker);
  }, [incidents, isPremium, isTouch, popupQueryClient]);

  const prevSelectedRef = useRef<string | null>(null);
  const focusRingRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    if (focusRingRef.current) {
      mapRef.current.removeLayer(focusRingRef.current);
      focusRingRef.current = null;
    }
    if (!selectedId || selectedId === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedId;
    const inc = incidents.find((i) => i.id === selectedId);
    if (inc) {
      const map = mapRef.current;
      const targetZoom = 14;
      const targetPoint = map.project([inc.lat, inc.lng], targetZoom);
      targetPoint.y -= 120;
      const targetLatLng = map.unproject(targetPoint, targetZoom);
      map.flyTo(targetLatLng, targetZoom, { duration: 0.8 });

      // Palantir-artad sikte-ring på vald händelse
      const ring = L.marker([inc.lat, inc.lng], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -500,
        icon: L.divIcon({
          className: 'ca-focus-icon',
          html: '<div class="ca-focus"><span class="ca-focus-ring"></span><span class="ca-focus-ring ca-focus-ring-2"></span><span class="ca-focus-cross"></span></div>',
          iconSize: [96, 96],
          iconAnchor: [48, 48],
        }),
      });
      ring.addTo(map);
      focusRingRef.current = ring;

      setTimeout(() => {
        const marker = markerMapRef.current.get(inc.id);
        if (marker && !marker.isPopupOpen()) marker.openPopup();
      }, 850);
    }
  }, [selectedId, incidents]);


  // Fly to searched location
  // The timeline's heat view: one layer, given new points as the window moves
  const heatLayerRef = useRef<HeatLayer | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!heatPoints) {
      heatLayerRef.current?.remove();
      heatLayerRef.current = null;
      return;
    }
    if (!heatLayerRef.current) heatLayerRef.current = new HeatLayer().addTo(map);
    heatLayerRef.current.setPoints(heatPoints);
  }, [heatPoints]);

  useEffect(() => {
    if (!mapRef.current || !flyToLocation) return;
    mapRef.current.flyTo([flyToLocation.lat, flyToLocation.lng], flyToLocation.zoom, { duration: 1.2 });
  }, [flyToLocation]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ touchAction: 'pan-x pan-y', backgroundColor: 'hsl(212 26% 2%)' }}>
      <style>{`
        .ca-tiles {
          filter: saturate(0.75) contrast(1.06) brightness(0.92);
        }
        .ca-focus-icon { background: none !important; border: none !important; }
        .ca-focus {
          position: relative;
          width: 96px; height: 96px;
          animation: ca-focus-in .6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ca-focus-in {
          from { opacity: 0; transform: scale(1.6) rotate(-12deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .ca-focus-ring {
          position: absolute; inset: 22px;
          border: 1px solid rgba(224,74,74,0.75);
          border-radius: 50%;
          animation: ca-focus-pulse 2.6s ease-out infinite;
        }
        .ca-focus-ring-2 { inset: 6px; opacity: .35; animation-delay: .5s; border-style: dashed; }
        .ca-focus-cross {
          position: absolute; inset: 0;
          background:
            linear-gradient(rgba(224,74,74,0.5), rgba(224,74,74,0.5)) no-repeat center / 1px 20px,
            linear-gradient(rgba(224,74,74,0.5), rgba(224,74,74,0.5)) no-repeat center / 20px 1px;
          opacity: .8;
        }
        @keyframes ca-focus-pulse {
          0% { transform: scale(0.86); opacity: .9; }
          70% { transform: scale(1.18); opacity: 0; }
          100% { transform: scale(1.18); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ca-focus, .ca-focus-ring { animation: none !important; }
        }

        .leaflet-container {
          background: hsl(212, 26%, 2%);
        }
        .leaflet-container {

          touch-action: pan-x pan-y;
        }
        .custom-marker {
          overflow: visible !important;
          background: none !important;
          border: none !important;
          touch-action: manipulation;
        }
        /* Pulses scale rather than resize, so they run on the GPU without layout or repaint */
        .marker-pulse {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          -webkit-animation: marker-pulse-anim 2s ease-in-out infinite;
          animation: marker-pulse-anim 2s ease-in-out infinite;
          will-change: transform, opacity;
        }
        @-webkit-keyframes marker-pulse-anim {
          0%, 100% { opacity: 0.4; -webkit-transform: scale(1); transform: scale(1); }
          50% { opacity: 0; -webkit-transform: scale(var(--pulse-scale, 3.5)); transform: scale(var(--pulse-scale, 3.5)); }
        }
        @keyframes marker-pulse-anim {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0; transform: scale(var(--pulse-scale, 3.5)); }
        }
        .marker-pulse-community {
          position: absolute;
          border-radius: 4px;
          pointer-events: none;
          -webkit-animation: marker-pulse-community-anim 2s ease-in-out infinite;
          animation: marker-pulse-community-anim 2s ease-in-out infinite;
          will-change: transform, opacity;
        }
        @-webkit-keyframes marker-pulse-community-anim {
          0%, 100% { opacity: 0.3; -webkit-transform: rotate(45deg) scale(1); transform: rotate(45deg) scale(1); }
          50% { opacity: 0; -webkit-transform: rotate(45deg) scale(2.8); transform: rotate(45deg) scale(2.8); }
        }
        @keyframes marker-pulse-community-anim {
          0%, 100% { opacity: 0.3; transform: rotate(45deg) scale(1); }
          50% { opacity: 0; transform: rotate(45deg) scale(2.8); }
        }
        .leaflet-control-zoom a {
          background: hsla(213, 27%, 7%, 0.85) !important;
          color: hsl(209, 12%, 72%) !important;
          border-color: rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: color .25s ease, background-color .25s ease;
        }
        .leaflet-control-zoom a:hover {
          background: hsla(210, 30%, 11%, 0.92) !important;
          color: #fff !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }

        /* Palantir-artad, mörk händelsepanel */
        .incident-popup .leaflet-popup-content-wrapper {
          border-radius: 6px;
          padding: 4px;
          background: linear-gradient(180deg, hsla(215,27%,9%,0.96) 0%, hsla(212,26%,3%,0.97) 100%);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(224,74,74,0.08),
            inset 0 1px 0 rgba(255,255,255,0.05);
          backdrop-filter: blur(16px) saturate(120%);
          -webkit-backdrop-filter: blur(16px) saturate(120%);
          max-width: 344px;
          overflow: hidden;
        }
        .incident-popup .leaflet-popup-content {
          margin: 10px 11px;
        }
        .incident-popup .leaflet-popup-tip {
          background: hsla(212,26%,3%,0.97);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: none;
        }
        .incident-popup .leaflet-popup-close-button {
          color: #6b7683 !important;
          font-weight: 400 !important;
          transition: color .2s ease;
        }
        .incident-popup .leaflet-popup-close-button:hover {
          color: #fff !important;
        }
        .incident-popup a.leaflet-popup-close-button { top: 6px; right: 6px; }

        /* Ljust läge: vita ytor på kartkontroller och händelsepanel */
        html:not(.dark) .leaflet-control-zoom a {
          background: rgba(255,255,255,0.92) !important;
          color: #4b5563 !important;
          border-color: rgba(17,24,39,0.1) !important;
        }
        html:not(.dark) .leaflet-control-zoom a:hover {
          background: #ffffff !important;
          color: #111827 !important;
        }
        html:not(.dark) .leaflet-control-zoom {
          box-shadow: 0 8px 24px rgba(17,24,39,0.14) !important;
        }
        html:not(.dark) .incident-popup .leaflet-popup-content-wrapper {
          background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
          border: 1px solid rgba(17,24,39,0.1);
          box-shadow: 0 24px 60px rgba(17,24,39,0.18), 0 0 0 1px rgba(201,42,42,0.06);
        }
        html:not(.dark) .incident-popup .leaflet-popup-tip {
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(17,24,39,0.1);
        }
        html:not(.dark) .incident-popup .leaflet-popup-close-button { color: #9ca3af !important; }
        html:not(.dark) .incident-popup .leaflet-popup-close-button:hover { color: #111827 !important; }
        html:not(.dark) .ca-pop-scan { display: none; }
        html:not(.dark) .ca-focus-ring { border-color: rgba(201,42,42,0.8); }
        html:not(.dark) .ca-focus-cross {
          background:
            linear-gradient(rgba(201,42,42,0.6), rgba(201,42,42,0.6)) no-repeat center / 1px 20px,
            linear-gradient(rgba(201,42,42,0.6), rgba(201,42,42,0.6)) no-repeat center / 20px 1px;
        }


        /* Inzoomad "dossier"-entré */
        .ca-pop {
          position: relative;
          animation: ca-pop-in .5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ca-pop-in {
          from { opacity: 0; transform: translateY(8px) scale(0.985); filter: blur(6px); }
          to { opacity: 1; transform: none; filter: blur(0); }
        }
        .ca-pop-scan {
          position: absolute;
          top: 0; left: -12px; right: -12px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(224,74,74,0.55), transparent);
          animation: ca-pop-scan 1.5s cubic-bezier(0.4, 0, 0.2, 1) 1 forwards;
          pointer-events: none;
        }
        @keyframes ca-pop-scan {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(220px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ca-pop, .ca-pop-scan { animation: none !important; }
          .ca-pop-scan { display: none; }
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
