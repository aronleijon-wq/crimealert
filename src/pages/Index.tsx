import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';
import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';
import IncidentDetail from '@/components/IncidentDetail';
import { mockIncidents, IncidentType } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

const Index = () => {
  const [activeFilters, setActiveFilters] = useState<IncidentType[]>([
    'police', 'fire', 'ambulance', 'traffic', 'other',
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { incidents: liveIncidents, loading, error, refetch } = usePoliceEvents();

  const toggleFilter = useCallback((type: IncidentType) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  // Use live data if available, otherwise fallback to mock
  const allIncidents = liveIncidents.length > 0 ? liveIncidents : mockIncidents;
  const isLive = liveIncidents.length > 0;

  const filtered = useMemo(
    () => allIncidents.filter((i) => activeFilters.includes(i.type)),
    [activeFilters, allIncidents]
  );

  const activeCount = filtered.filter((i) => i.status === 'active').length;
  const selectedIncident = filtered.find((i) => i.id === selectedId) || null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <StatsBar incidents={filtered} />
      <FilterBar
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        incidentCount={filtered.length}
        activeCount={activeCount}
      />
      <div className="flex-1 flex overflow-hidden relative">
        {/* Incident sidebar */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto flex-shrink-0 hidden md:block">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLive ? (
                <Wifi className="w-3 h-3 text-cr-green" />
              ) : (
                <WifiOff className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {isLive ? 'Live — Polisen.se' : 'Demo-data'}
              </span>
            </div>
            <button
              onClick={refetch}
              disabled={loading}
              className="p-1 rounded hover:bg-muted text-muted-foreground transition disabled:opacity-50"
              title="Uppdatera"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loading && liveIncidents.length === 0 ? (
            <div className="p-4 text-center">
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mx-auto mb-2" />
              <span className="text-[10px] font-mono text-muted-foreground">Hämtar data från Polisen.se...</span>
            </div>
          ) : (
            filtered.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                selected={selectedId === inc.id}
                onClick={() => setSelectedId(selectedId === inc.id ? null : inc.id)}
              />
            ))
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            incidents={filtered}
            selectedId={selectedId}
            onSelectIncident={(id) => setSelectedId(id)}
          />

          {selectedIncident && (
            <div className="absolute bottom-4 left-4 z-[1000]">
              <IncidentDetail incident={selectedIncident} onClose={() => setSelectedId(null)} />
            </div>
          )}

          <div className="absolute top-3 left-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 flex items-center gap-2">
            {isLive ? (
              <div className="w-1.5 h-1.5 rounded-full bg-cr-green animate-pulse-dot" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            )}
            <span className="text-[10px] font-mono text-muted-foreground">
              {isLive ? 'LIVE' : 'DEMO'} • {filtered.length} HÄNDELSER • <span className="text-cr-red">{activeCount} AKTIVA</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
