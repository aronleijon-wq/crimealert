// The map's markers, as the website's map (components/MapView) has always drawn them and Apple
// Maps in the app (native/AppleMap) draws them too: a dot in the kind's colour with a white rim,
// pulsing while it's new, and an orange diamond with an eye for a citizen report.
import { incidentTypeConfig, type Incident } from '@/data/mockIncidents';
import { parseIncidentTime } from '@/lib/incidentTime';
import { svgIcon } from '@/lib/svgIcons';
import { spreadPoint } from '../../supabase/functions/_shared/geoPlace';

export const COMMUNITY_REPORT_COLOR = '#f97316'; // orange


export const isWithinHours = (timeStr: string, hours: number) => {
  const d = parseIncidentTime(timeStr);
  if (!d) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= hours * 60 * 60 * 1000;
};

export const isWithinDays = (timeStr: string, days: number) => {
  const d = parseIncidentTime(timeStr);
  if (!d) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

/**
 * Where each marker is drawn: 100–600 m from the event's place, in a direction of its own that
 * is the same every time (supabase/functions/_shared/geoPlace). Events at one place spread out
 * instead of hiding each other, and an address is never shown to the metre. Citizen reports,
 * placed by the person who sent them, stay where they are.
 */
export const getJitteredPositions = (items: Incident[]) =>
  items.map((item) => (item.source === 'Medborgarrapport' ? { lat: item.lat, lng: item.lng } : spreadPoint(item.id, item.lat, item.lng)));

/** The largest hit area, as a radius in pixels: 44 px across on a phone (Apple's minimum), 28 on a computer */
export const MAX_HIT_RADIUS = { touch: 22, mouse: 14 } as const;

/**
 * How far out each marker can be tapped, in pixels: as large as there is room for, up to
 * maxRadius, never smaller than the dot itself, and never more than half the way to the nearest
 * other marker, so two markers never claim the same tap. Points are the markers' positions on
 * screen; neighbours are found on a grid, so a map with thousands of markers stays quick.
 */
export function hitRadii(points: { x: number; y: number }[], dotRadii: number[], maxRadius: number): number[] {
  const cell = maxRadius * 2;
  const grid = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  return points.map((p, i) => {
    let nearest = Infinity;
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (j === i) continue;
          const d = Math.hypot(points[j].x - p.x, points[j].y - p.y);
          if (d < nearest) nearest = d;
        }
      }
    }
    return Math.max(dotRadii[i], Math.min(maxRadius, nearest / 2));
  });
}

/** Sets a marker's tap area (the .marker-hit ring markerHtml draws) to a radius in pixels */
export function setHitArea(el: HTMLElement | null | undefined, radius: number) {
  const hit = el?.querySelector<HTMLElement>('.marker-hit');
  if (!hit) return;
  const d = `${Math.round(radius * 2)}px`;
  hit.style.width = d;
  hit.style.height = d;
}

const isMissingPersonIncident = (incident: Incident) => {
  const haystack = `${incident.title} ${incident.description} ${incident.originalType || ''}`.toLowerCase();
  return /försvunnen|saknad|borttappad|efterlyst person|person försvunnen/.test(haystack);
};

export const shouldIncidentPulse = (incident: Incident) => {
  if (incident.source === 'Medborgarrapport') return isWithinHours(incident.time, 24);
  if (isMissingPersonIncident(incident)) return isWithinHours(incident.time, 24);
  return isWithinHours(incident.time, 3);
};

// On phones: at most this many pulsing markers, the newest from the last hour
const TOUCH_MAX_PULSING = 8;
const TOUCH_PULSE_HOURS = 1;

/** The events that pulse on a phone: the newest few within the hour, citizen reports included. */
export function touchPulseIds(incidents: Incident[], now = Date.now()): Set<string> {
  return new Set(
    incidents
      .map((incident) => ({ incident, at: parseIncidentTime(incident.time)?.getTime() ?? NaN }))
      .filter(({ incident, at }) => shouldIncidentPulse(incident) && now - at <= TOUCH_PULSE_HOURS * 3600e3)
      .sort((a, b) => b.at - a.at)
      .slice(0, TOUCH_MAX_PULSING)
      .map(({ incident }) => incident.id),
  );
}

/** A marker as HTML, and the square it takes, in pixels: a dot, pulsing when it's new; a diamond for a citizen report */
export function markerHtml(incident: Incident, touch: boolean, pulse = shouldIncidentPulse(incident)): { html: string; size: number } {
  const isCommunityReport = incident.source === 'Medborgarrapport';
  const config = incidentTypeConfig[incident.type];
  const color = isCommunityReport ? COMMUNITY_REPORT_COLOR : config.color;
  const shouldPulse = pulse;
  const mobilePad = touch ? 10 : 0;

  if (isCommunityReport) {
    const size = touch ? 24 : 18;
    const pulseSize = shouldPulse ? size + 20 + mobilePad : size + mobilePad;
    return {
      html: `
        <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">
          <div class="marker-hit" style="position:absolute;left:50%;top:50%;width:100%;height:100%;transform:translate(-50%,-50%);border-radius:50%;"></div>
          ${shouldPulse ? `<div class="marker-pulse-community" style="position:absolute;width:100%;height:100%;top:0;left:0;border-radius:4px;background:${COMMUNITY_REPORT_COLOR};transform:rotate(45deg);"></div>` : ''}
          <div style="width:${size}px;height:${size}px;border-radius:3px;background:${COMMUNITY_REPORT_COLOR};border:2.5px solid rgba(255,255,255,0.95);position:relative;z-index:2;box-shadow:0 2px 10px ${COMMUNITY_REPORT_COLOR}90;transform:rotate(45deg);"></div>
          <span style="position:absolute;z-index:3;display:flex;pointer-events:none;">${svgIcon('eye', touch ? 13 : 10, '#fff', 2.5)}</span>
        </div>
      `,
      size: pulseSize,
    };
  }

  const size = touch ? (shouldPulse ? 20 : 16) : (shouldPulse ? 14 : 10);
  const pulseSize = shouldPulse ? size + 16 + mobilePad : size + mobilePad;

  return {
    html: `
      <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">
        <div class="marker-hit" style="position:absolute;left:50%;top:50%;width:100%;height:100%;transform:translate(-50%,-50%);border-radius:50%;"></div>
        ${shouldPulse ? `<div class="marker-pulse" style="position:absolute;width:100%;height:100%;top:0;left:0;border-radius:50%;background:${color};"></div>` : ''}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);position:relative;z-index:2;box-shadow:0 1px 6px ${color}80;"></div>
      </div>
    `,
    size: pulseSize,
  };
}

/** The pulse, for maps outside MapView (which has the same in its own styles) */
export const MARKER_PULSE_CSS = `
.marker-pulse { position: absolute; border-radius: 50%; pointer-events: none; animation: marker-pulse-anim 2s ease-in-out infinite; will-change: transform, opacity; }
@keyframes marker-pulse-anim { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0; transform: scale(var(--pulse-scale, 3.5)); } }
.marker-pulse-community { position: absolute; border-radius: 4px; pointer-events: none; animation: marker-pulse-community-anim 2s ease-in-out infinite; will-change: transform, opacity; }
@keyframes marker-pulse-community-anim { 0%, 100% { opacity: 0.3; transform: rotate(45deg) scale(1); } 50% { opacity: 0; transform: rotate(45deg) scale(2.8); } }
@media (prefers-reduced-motion: reduce) { .marker-pulse, .marker-pulse-community { animation: none; opacity: 0; } }
`;
