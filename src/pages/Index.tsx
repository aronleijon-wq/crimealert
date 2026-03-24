import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';
import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';


import { mockIncidents, IncidentType } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Wifi, WifiOff, Maximize2, Minimize2, Clock, Zap, List, X, ShieldCheck, MapPin, Bell as BellIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import Footer from '@/components/Footer';

const ALL_FILTERS: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other'];

const Index = () => {
  const { isPremium } = useIsPremium();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isLoggedIn = !!user;
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [showCommunityReports, setShowCommunityReports] = useState(true);

  const getDefaultFilters = (): IncidentType[] => {
    // Non-logged-in users can't see 'other' incidents
    return isLoggedIn ? [...ALL_FILTERS] : ALL_FILTERS.filter((f) => f !== 'other');
  };

  const [activeFilters, setActiveFilters] = useState<IncidentType[]>(getDefaultFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{lat: number;lng: number;zoom: number;_ts?: number;} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { incidents: liveIncidents, loading, error, refetch } = usePoliceEvents();
  const { reports: communityReports } = useCommunityReports();

  // Update filters when premium/login status changes — activate all allowed filters
  useEffect(() => {
    setActiveFilters(getDefaultFilters());
  }, [isPremium, isLoggedIn]);

  const toggleFilter = useCallback((type: IncidentType) => {
    setActiveFilters((prev) =>
    prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const policeIncidents = liveIncidents.length > 0 ? liveIncidents : mockIncidents;
  // Community reports only visible for Pro members on the map/list
  const allIncidents = useMemo(() => {
    const base = policeIncidents;
    if (isPremium && showCommunityReports) {
      return [...base, ...communityReports];
    }
    return [...base];
  }, [policeIncidents, communityReports, isPremium, showCommunityReports]);
  const isLive = liveIncidents.length > 0;

  // Grova brott som alltid visas på kartan oavsett ålder
  const SEVERE_CRIME_KEYWORDS = [
  'mord', 'dråp', 'skottlossning', 'skjutning', 'rån',
  'våldtäkt', 'mordförsök', 'knivdåd', 'grov misshandel',
  'sprängning', 'explosion', 'bombhot', 'kidnappning',
  'dödligt våld', 'vapenbrott', 'terror'];


  const isSevereCrime = (title: string) =>
  SEVERE_CRIME_KEYWORDS.some((kw) => title.toLowerCase().includes(kw));

  // Free users: 15 min delay on new incidents
  // Map: hide incidents older than 3 days UNLESS severe crime
  const timeFiltered = useMemo(() => {
    const now = Date.now();
    const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const delayCutoff = isPremium ? Infinity : now - 15 * 60 * 1000;
    return allIncidents.filter((i) => {
      const isCommunity = i.source === 'Medborgarrapport';
      const normalizedTime = i.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T');
      const t = new Date(normalizedTime).getTime();
      if (isNaN(t)) return true;
      // Community reports: visible for 24 hours
      if (isCommunity) return t >= cutoff24h;
      // Hard 7-day cutoff for ALL incidents including severe crimes
      if (t < cutoff7d) return false;
      // Non-premium delay
      return t <= delayCutoff;
    });
  }, [allIncidents, isPremium]);

  const filtered = useMemo(
    () =>
    timeFiltered.
    filter((i) => activeFilters.includes(i.type)).
    sort((a, b) => {
      const tA = new Date(a.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T')).getTime();
      const tB = new Date(b.time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T')).getTime();
      return tB - tA;
    }),
    [activeFilters, timeFiltered]
  );

  const activeCount = filtered.filter((i) => i.status === 'active').length;
  

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      {!isFullscreen &&
      <>
          <Header />


          <div className="hidden md:block">
            <StatsBar incidents={filtered} onSelectIncident={(id) => setSelectedId(id)} />
          </div>
          <FilterBar activeFilters={activeFilters} onToggleFilter={toggleFilter} incidentCount={filtered.length} activeCount={activeCount} showCommunityReports={showCommunityReports} onToggleCommunityReports={() => setShowCommunityReports(prev => !prev)} onSearchLocation={(lat, lng, zoom, name) => {setFlyToLocation({ lat, lng, zoom, _ts: Date.now() });
          }} />
        
        </>
      }
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Incident sidebar */}
        {!isFullscreen && (!isMobile || mobileListOpen) &&
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto flex-shrink-0 max-h-[30vh] md:max-h-none relative">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPremium ?
              <Wifi className="w-3 h-3 text-cr-green" /> :
              isLive ?
              <Clock className="w-3 h-3 text-cr-orange" /> :

              <WifiOff className="w-3 h-3 text-muted-foreground" />
              }
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {isPremium ?
                'Realtid — Polisen.se' :
                isLive ?
                '15 min fördröjning' :
                'Demo-data'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                onClick={refetch}
                disabled={loading}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition disabled:opacity-50"
                title="Uppdatera">
                
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {isMobile &&
              <button
                onClick={() => setMobileListOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
                title="Stäng listan">
                
                    <X className="w-4 h-4" />
                  </button>
              }
              </div>
            </div>
            {loading && liveIncidents.length === 0 ?
          <div className="p-4 text-center">
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mx-auto mb-2" />
                <span className="text-[10px] font-mono text-muted-foreground">Hämtar data från Polisen.se...</span>
              </div> :

          filtered.map((inc) =>
          <IncidentCard
            key={inc.id}
            incident={inc}
            selected={selectedId === inc.id}
            onClick={() => setSelectedId(selectedId === inc.id ? null : inc.id)} />

          )
          }
          </div>
        }

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            incidents={filtered}
            selectedId={selectedId}
            onSelectIncident={(id) => setSelectedId(id || null)}
            isPremium={isPremium}
            flyToLocation={flyToLocation} />
          

          {/* Mobile: show list button */}
          {isMobile && !mobileListOpen && !isFullscreen &&
          <button
            onClick={() => setMobileListOpen(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-card/90 backdrop-blur border border-border rounded-full px-4 py-2 flex items-center gap-2 hover:bg-muted transition text-foreground shadow-lg">
            
              <List className="w-4 h-4" />
              <span className="text-xs font-medium">{filtered.length} händelser</span>
            </button>
          }

          {/* Fullscreen toggle button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute top-3 right-14 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md p-1.5 hover:bg-muted transition text-muted-foreground"
            title={isFullscreen ? 'Avsluta fullskärm' : 'Fullskärm'}>
            
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="absolute top-3 left-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5 flex items-center gap-2">
            {isPremium ?
            <div className="w-1.5 h-1.5 rounded-full bg-cr-green animate-pulse-dot" /> :
            isLive ?
            <div className="w-1.5 h-1.5 rounded-full bg-cr-orange animate-pulse-dot" /> :

            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            }
            <span className="text-[10px] font-mono text-muted-foreground">
              {isPremium ? 'REALTID' : isLive ? '15 MIN DELAY' : 'DEMO'} • {filtered.length} HÄNDELSER • <span className="text-cr-red">{activeCount} AKTIVA</span>
            </span>
          </div>
        </div>
      </div>

      {!isFullscreen && <div className="hidden md:block"><Footer /></div>}

    </div>);

};

export default Index;