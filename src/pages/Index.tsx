import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';
import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';

import AdBanner from '@/components/AdBanner';
import PopupAd from '@/components/PopupAd';
import { mockIncidents, IncidentType } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Wifi, WifiOff, Maximize2, Minimize2, Clock, Zap, List, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const FREE_FILTERS: IncidentType[] = ['police', 'traffic'];
const LOGGED_IN_FILTERS: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic'];

const Index = () => {
  const { isPremium } = useIsPremium();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isLoggedIn = !!user;
  const [mobileListOpen, setMobileListOpen] = useState(true);

  const getDefaultFilters = (): IncidentType[] => {
    if (isPremium) return ['police', 'fire', 'ambulance', 'traffic', 'other'];
    if (isLoggedIn) return [...LOGGED_IN_FILTERS];
    return [...FREE_FILTERS];
  };

  const [activeFilters, setActiveFilters] = useState<IncidentType[]>(getDefaultFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { incidents: liveIncidents, loading, error, refetch } = usePoliceEvents();

  // Update filters when premium/login status changes — activate all allowed filters
  useEffect(() => {
    setActiveFilters(getDefaultFilters());
  }, [isPremium, isLoggedIn]);

  const toggleFilter = useCallback((type: IncidentType) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const allIncidents = liveIncidents.length > 0 ? liveIncidents : mockIncidents;
  const isLive = liveIncidents.length > 0;

  // Free users: only show last 24h + 15 min delay on new incidents
  const timeFiltered = useMemo(() => {
    const now = Date.now();
    if (isPremium) return allIncidents;
    const cutoff3d = now - 3 * 24 * 60 * 60 * 1000;
    const delayCutoff = now - 15 * 60 * 1000; // 15 minutes ago
    return allIncidents.filter((i) => {
      // Handle "2026-02-18 22:03:10 +01:00" format by replacing space before timezone with T
      const normalizedTime = i.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T');
      const t = new Date(normalizedTime).getTime();
      if (isNaN(t)) return true; // If we can't parse, show the incident
      return t >= cutoff3d && t <= delayCutoff;
    });
  }, [allIncidents, isPremium]);

  const filtered = useMemo(
    () =>
      timeFiltered
        .filter((i) => activeFilters.includes(i.type))
        .sort((a, b) => {
          const tA = new Date(a.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T')).getTime();
          const tB = new Date(b.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T')).getTime();
          return tB - tA;
        }),
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
          <StatsBar incidents={filtered} onSelectIncident={(id) => setSelectedId(id)} />
          <FilterBar
            activeFilters={activeFilters}
            onToggleFilter={toggleFilter}
            incidentCount={filtered.length}
            activeCount={activeCount}
          />
        </>
      )}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Incident sidebar */}
        {!isFullscreen && (!isMobile || mobileListOpen) && (
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto flex-shrink-0 max-h-[40vh] md:max-h-none relative">
            {isMobile && (
              <button
                onClick={() => setMobileListOpen(false)}
                className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-muted text-muted-foreground"
                title="Stäng listan"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
            isPremium={isPremium}
          />

          {/* Mobile: show list button */}
          {isMobile && !mobileListOpen && !isFullscreen && (
            <button
              onClick={() => setMobileListOpen(true)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-card/90 backdrop-blur border border-border rounded-full px-4 py-2 flex items-center gap-2 hover:bg-muted transition text-foreground shadow-lg"
            >
              <List className="w-4 h-4" />
              <span className="text-xs font-medium">{filtered.length} händelser</span>
            </button>
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
      {!isPremium && <PopupAd />}
    </div>
  );
};

export default Index;
