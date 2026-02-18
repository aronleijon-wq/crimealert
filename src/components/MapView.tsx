import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, incidentTypeConfig } from '@/data/mockIncidents';

interface MapViewProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelectIncident: (id: string) => void;
}

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
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${config.color};border:2px solid rgba(0,0,0,0.5);position:relative;z-index:2;box-shadow:0 0 ${isActive ? 10 : 4}px ${config.color};"></div>
      </div>
    `,
    iconSize: [pulseSize, pulseSize],
    iconAnchor: [pulseSize / 2, pulseSize / 2],
  });
};

const MapView = ({ incidents, selectedId, onSelectIncident }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [59.334, 18.063],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    incidents.forEach((inc) => {
      const marker = L.marker([inc.lat, inc.lng], { icon: createMarkerIcon(inc) });
      marker.on('click', () => onSelectIncident(inc.id));
      markersRef.current!.addLayer(marker);
    });
  }, [incidents, onSelectIncident]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const inc = incidents.find((i) => i.id === selectedId);
    if (inc) {
      mapRef.current.flyTo([inc.lat, inc.lng], 14, { duration: 0.8 });
    }
  }, [selectedId, incidents]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: 'hsl(222, 47%, 6%)' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(2); opacity: 0; }
        }
        .leaflet-control-zoom a {
          background: hsl(222, 40%, 8%) !important;
          color: hsl(210, 20%, 90%) !important;
          border-color: hsl(222, 20%, 16%) !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(222, 30%, 14%) !important;
        }
      `}</style>
    </div>
  );
};

export default MapView;
