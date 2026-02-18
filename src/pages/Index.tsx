import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';
import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';
import IncidentDetail from '@/components/IncidentDetail';
import AdBanner from '@/components/AdBanner';
import { mockIncidents, IncidentType } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { RefreshCw, Wifi, WifiOff, Maximize2, Minimize2, Clock, Zap } from 'lucide-react';

const FREE_FILTERS: IncidentType[] = ['police', 'traffic'];

const Index = () => {
  const { isPremium } = useIsPremium();
  const [activeFilters, setActiveFilters] = useState<IncidentType[]>(
    isPremium ? ['police', 'fire', 'ambulance', 'traffic', 'other'] : [...FREE_FILTERS]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { incidents: liveIncidents, loading, error, refetch } = usePoliceEvents();

  // Update filters when premium status changes
  useEffect(() => {
    if (isPremium) {
      setActiveFilters(['police', 'fire', 'ambulance', 'traffic', 'other']);
    } else {
      setActiveFilters((prev) => prev.filter((f) => FREE_FILTERS.includes(f)));
    }
  }, [isPremium]);

  const toggleFilter = useCallback((type: IncidentType) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const allIncidents = liveIncidents.length > 0 ? liveIncidents : mockIncidents;
  const isLive = liveIncidents.length > 0;

  // Free users: only show last 24h
  const timeFiltered = useMemo(() => {
    if (isPremium) return allIncidents;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return allIncidents.filter((i) => new Date(i.time).getTime() >= cutoff);
  }, [allIncidents, isPremium]);

  const filtered = useMemo(
    () => timeFiltered.filter((i) => activeFilters.includes(i.type)),
    [activeFilters, timeFiltered]
  );

  const activeCount = filtered.filter((i) => i.status === 'active').length;
  const selectedIncident = filtered.find((i) => i.id === selectedId) || null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {!isFullscreen && (
        <>
          <Header />
          <AdBanner />
          <StatsBar incidents={filtered} />
          <FilterBar
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            incidentCount={filtered.length}
            activeCount={activeCount}
          />
        </>
      )}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Incident sidebar */}
        {!isFullscreen && (
          <div className="w-80 border-r border-border bg-card overflow-y-auto flex-shrink-0 hidden md:block">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPremium ? (
                  <Wifi className="w-3 h-3 text-cr-green" />
                ) : isLive ? (
                  <Clock className="w-3 h-3 text-cr-orange" />
                ) : (
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {isPremium
                    ? 'Realtid — Polisen.se'
                    : isLive
                    ? '15 min fördröjning'
                    : 'Demo-data'}
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
        )}

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

          {/* Fullscreen toggle button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-3 right-14 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md p-1.5 hover:bg-muted transition text-muted-foreground"
            title={isFullscreen ? 'Avsluta fullskärm' : 'Fullskärm'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="absolute top-3 left-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 flex items-center gap-2">
            {isPremium ? (
              <div className="w-1.5 h-1.5 rounded-full bg-cr-green animate-pulse-dot" />
            ) : isLive ? (
              <div className="w-1.5 h-1.5 rounded-full bg-cr-orange animate-pulse-dot" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            )}
            <span className="text-[10px] font-mono text-muted-foreground">
              {isPremium ? 'REALTID' : isLive ? '15 MIN DELAY' : 'DEMO'} • {filtered.length} HÄNDELSER • <span className="text-cr-red">{activeCount} AKTIVA</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
