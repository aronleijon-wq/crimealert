import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, incidentTypeConfig, riskConfig } from '@/data/mockIncidents';

interface MapViewProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelectIncident: (id: string) => void;
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
  const isActive = incident.status === 'active';
  const size = isActive ? 14 : 10;
  const pulseSize = size + 16;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;width:${pulseSize}px;height:${pulseSize}px;display:flex;align-items:center;justify-content:center;">
        ${isActive ? `<div style="position:absolute;width:${pulseSize}px;height:${pulseSize}px;border-radius:50%;background:${config.color};opacity:0.2;animation:pulse 2s ease-in-out infinite;"></div>` : ''}
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

const createPopupContent = (inc: Incident) => {
  const config = incidentTypeConfig[inc.type];
  const risk = riskConfig[inc.risk];
  const riskColor = inc.risk === 'high' ? '#ef4444' : inc.risk === 'medium' ? '#f97316' : '#22c55e';
  const statusLabel = inc.status === 'active' ? 'Aktiv' : 'Avslutad';
  const statusColor = inc.status === 'active' ? '#ef4444' : '#6b7280';

  return `
    <div style="font-family:system-ui;min-width:200px;max-width:260px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="font-size:16px;">${TYPE_ICONS[inc.type] || '⚠️'}</span>
        <span style="font-size:12px;font-weight:700;color:#1a1a1a;">${config.label}</span>
      </div>
      <p style="font-size:12px;font-weight:600;color:#333;margin:0 0 6px;">${inc.title}</p>
      ${inc.description ? `<p style="font-size:11px;color:#666;margin:0 0 8px;line-height:1.4;">${inc.description}</p>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
        <div style="background:#f5f5f5;padding:4px 6px;border-radius:4px;">
          <span style="color:#999;">Tid</span><br/>
          <span style="color:#333;font-weight:500;">${formatTime(inc.time)}</span>
        </div>
        <div style="background:#f5f5f5;padding:4px 6px;border-radius:4px;">
          <span style="color:#999;">Område</span><br/>
          <span style="color:#333;font-weight:500;">${inc.area}</span>
        </div>
        <div style="background:#f5f5f5;padding:4px 6px;border-radius:4px;">
          <span style="color:#999;">Status</span><br/>
          <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
        </div>
        <div style="background:#f5f5f5;padding:4px 6px;border-radius:4px;">
          <span style="color:#999;">Risknivå</span><br/>
          <span style="color:${riskColor};font-weight:600;">${risk.label}</span>
        </div>
      </div>
      <div style="margin-top:6px;font-size:9px;color:#aaa;">
        ${inc.approximate ? '⊙ Approximerad position • ' : ''}Källa: ${inc.source || 'Okänd'} • Ingen exakt adress visas
      </div>
    </div>
  `;
};

const MapView = ({ incidents, selectedId, onSelectIncident }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
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

    incidents.forEach((inc) => {
      const marker = L.marker([inc.lat, inc.lng], { icon: createMarkerIcon(inc) });
      marker.bindPopup(createPopupContent(inc), {
        className: 'incident-popup',
        maxWidth: 280,
        closeButton: true,
      });
      marker.on('click', () => onSelectIncident(inc.id));
      markersRef.current!.addLayer(marker);
    });
  }, [incidents, onSelectIncident]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const inc = incidents.find((i) => i.id === selectedId);
    if (inc) {
      mapRef.current.flyTo([inc.lat, inc.lng], 14, { duration: 0.8 });
      markersRef.current?.getLayers().forEach((layer: any) => {
        if (layer.getLatLng) {
          const ll = layer.getLatLng();
          if (Math.abs(ll.lat - inc.lat) < 0.0001 && Math.abs(ll.lng - inc.lng) < 0.0001) {
            layer.openPopup();
          }
        }
      });
    }
  }, [selectedId, incidents]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: '#f0f0f0' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(2); opacity: 0; }
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
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
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
