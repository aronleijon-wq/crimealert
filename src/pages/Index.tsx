import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';

import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';
import MobileSignupBar from '@/components/MobileSignupBar';


import { KOMMUN_COORDINATES } from '@/data/kommuner';
import { mockIncidents, Incident, IncidentType } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useTrafikverketEvents } from '@/hooks/useTrafikverketEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Wifi, WifiOff, Maximize2, Minimize2, Clock, Zap, List, X, ShieldCheck, MapPin, Bell as BellIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { filterIncidentsForMap, linkTrafficDuplicates, sortNewestFirst } from '@/lib/mapFilters';
import { crisisToIncident } from '@/lib/externalEvents';
import { useExternalEvents } from '@/hooks/useExternalEvents';


const ALL_FILTERS: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other', 'trafikverket', 'crisis'];

const LIST_PAGE = 60;

const Index = () => {
  useSEO({
    title: 'Livekarta över polishändelser | CrimeAlert',
    description: 'Se polishändelser, brand, trafikolyckor och brott i realtid på kartan. Trygghetskarta för hela Sverige med live-uppdateringar.',
    canonical: 'https://crimealert.se/karta',
  });
  const { isPremium } = useIsPremium();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isLoggedIn = !!user;
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [heroDismissed, setHeroDismissed] = useState(false);
  const [showCommunityReports, setShowCommunityReports] = useState(true);

  const getDefaultFilters = (): IncidentType[] => {
    // Alla användare, även utloggade, ser 'other'
    return [...ALL_FILTERS];
  };

  const [activeFilters, setActiveFilters] = useState<IncidentType[]>(getDefaultFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{lat: number;lng: number;zoom: number;_ts?: number;} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { incidents: liveIncidents, loading, error, refetch } = usePoliceEvents();
  const { reports: communityReports } = useCommunityReports(isPremium);
  const { incidents: trafikverketIncidents } = useTrafikverketEvents();
  const { events: externalEvents } = useExternalEvents();

  // Update filters when premium/login status changes — activate all allowed filters
  useEffect(() => {
    setActiveFilters(getDefaultFilters());
  }, [isPremium, isLoggedIn]);

  // ?kommun=Malmö from a kommun page: start over that kommun
  useEffect(() => {
    const url = new URL(window.location.href);
    const name = url.searchParams.get('kommun');
    if (!name) return;
    const seat = KOMMUN_COORDINATES.find((k) => k.name === name);
    if (seat) setFlyToLocation({ lat: seat.lat, lng: seat.lng, zoom: 11, _ts: Date.now() });
    url.searchParams.delete('kommun');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Handle ?incident=ID from push notifications — focus and zoom to that event
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incidentId = params.get('incident');
    if (!incidentId || liveIncidents.length === 0) return;
    const target = liveIncidents.find((i) => i.id === incidentId);
    if (!target) return;
    setSelectedId(target.id);
    setFlyToLocation({ lat: target.lat, lng: target.lng, zoom: 15, _ts: Date.now() });
    if (isMobile) setMobileListOpen(false);
    // Clean up the URL so reloads don't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete('incident');
    window.history.replaceState({}, '', url.toString());
  }, [liveIncidents, isMobile]);

  const toggleFilter = useCallback((type: IncidentType) => {
    setActiveFilters((prev) =>
    prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const policeIncidents = liveIncidents.length > 0 ? liveIncidents : mockIncidents;
  // Community reports only visible for Pro members on the map/list
  const allIncidents = useMemo(() => {
    // A Trafikverket accident that the police also reported gets no marker of its own
    const { traffic } = linkTrafficDuplicates(policeIncidents, trafikverketIncidents);
    const crisis = externalEvents.map(crisisToIncident).filter((i): i is Incident => i !== null);
    const base = [...policeIncidents, ...traffic, ...crisis];
    if (isPremium && showCommunityReports) {
      return [...base, ...communityReports];
    }
    return base;
  }, [policeIncidents, trafikverketIncidents, externalEvents, communityReports, isPremium, showCommunityReports]);
  const isLive = liveIncidents.length > 0;

  const timeFiltered = useMemo(
    () => filterIncidentsForMap(allIncidents, { isPremium }),
    [allIncidents, isPremium]
  );

  const filtered = useMemo(
    () => sortNewestFirst(timeFiltered.filter((i) => activeFilters.includes(i.type))),
    [activeFilters, timeFiltered]
  );

  const activeCount = filtered.filter((i) => i.status === 'active').length;

  // The list renders a page at a time; all of a week's events at once overwhelm phones
  const [listCount, setListCount] = useState(LIST_PAGE);
  const listRef = useRef<HTMLDivElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => setListCount(LIST_PAGE), [activeFilters]);
  const hasMoreInList = listCount < filtered.length;
  useEffect(() => {
    const end = listEndRef.current;
    if (!end || !hasMoreInList || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setListCount((c) => c + LIST_PAGE); },
      { root: listRef.current, rootMargin: '600px' },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasMoreInList, listCount, mobileListOpen, isFullscreen]);
  // An event picked on the map is always in the rendered part of the list
  useEffect(() => {
    if (!selectedId) return;
    const index = filtered.findIndex((i) => i.id === selectedId);
    if (index >= listCount) setListCount(Math.ceil((index + 1) / LIST_PAGE) * LIST_PAGE);
  }, [selectedId, filtered, listCount]);
  

  return (
    <div className="ca-dark h-[100dvh] flex flex-col overflow-hidden">
      <h1 className="sr-only">Livekarta över polishändelser och olyckor i Sverige</h1>
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
        <div ref={listRef} className="w-full md:w-80 border-b md:border-b-0 md:border-r border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))] overflow-y-auto flex-shrink-0 max-h-[25vh] md:max-h-none relative">
            <div className="sticky top-0 z-10 px-3 py-2 border-b border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))]/95 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPremium ?
              <Wifi className="w-3 h-3 text-cr-green" /> :
              isLive ?
              <Clock className="w-3 h-3 text-cr-orange" /> :

              <WifiOff className="w-3 h-3 text-muted-foreground" />
              }
                <span className="ca-mono text-[9px] text-[hsl(var(--ca-text-3))] uppercase tracking-[0.2em]">
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
                className="p-1 rounded hover:bg-white/5 text-muted-foreground transition disabled:opacity-50"
                aria-label="Uppdatera händelser"
                title="Uppdatera">
                
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {isMobile &&
              <button
                onClick={() => setMobileListOpen(false)}
                className="p-1 rounded hover:bg-white/5 text-muted-foreground"
                aria-label="Stäng händelselistan"
                title="Stäng listan">
                
                    <X className="w-4 h-4" />
                  </button>
              }
              </div>
            </div>
            {loading && liveIncidents.length === 0 ?
          <div className="p-4 text-center">
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mx-auto mb-2" />
                <span className="ca-mono text-[10px] text-[hsl(var(--ca-text-3))] tracking-[0.14em] uppercase">Hämtar data från Polisen.se</span>
              </div> :

          <>
              {filtered.slice(0, listCount).map((inc, idx) =>
            <IncidentCard
              key={inc.id}
              incident={inc}
              index={idx}
              selected={selectedId === inc.id}
              onClick={() => setSelectedId(selectedId === inc.id ? null : inc.id)} />

            )}
              {hasMoreInList &&
            <div ref={listEndRef} className="px-3 py-3 text-center ca-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--ca-text-3))]">
                  Visar {listCount} av {filtered.length}
                </div>
            }
            </>
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

          {/* Vinjett för nattkänsla över kartan */}
          <div
            className="pointer-events-none absolute inset-0 z-[400]"
            style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 45%, hsl(var(--ca-base) / 0.45) 100%)' }}
          />

          {/* Mobile: show list button */}
          {isMobile && !mobileListOpen && !isFullscreen &&
          <button
            onClick={() => setMobileListOpen(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] ca-glass rounded-full px-4 py-2 flex items-center gap-2 transition-colors duration-300 hover:bg-[hsl(var(--ca-panel-3))] text-[hsl(var(--ca-text))] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            
              <List className="w-4 h-4" />
              <span className="ca-mono text-[10px] tracking-[0.16em] uppercase">{filtered.length} händelser</span>
            </button>
          }

          {/* Fullscreen toggle button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute right-14 z-[1000] ca-glass rounded-md p-1.5 text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition-colors duration-300"
            style={{ top: isFullscreen ? 'calc(0.75rem + env(safe-area-inset-top, 0px))' : '0.75rem' }}
            aria-label={isFullscreen ? 'Avsluta fullskärm' : 'Visa kartan i fullskärm'}
            title={isFullscreen ? 'Avsluta fullskärm' : 'Fullskärm'}>
            
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="absolute left-3 z-[1000] ca-glass rounded-md px-3 py-1.5 flex items-center gap-2 ca-rise" style={{ top: isFullscreen ? 'calc(0.75rem + env(safe-area-inset-top, 0px))' : '0.75rem' }}>
            {isPremium ?
            <div className="w-1.5 h-1.5 rounded-full bg-cr-green animate-pulse-dot" /> :
            isLive ?
            <div className="w-1.5 h-1.5 rounded-full bg-cr-orange animate-pulse-dot" /> :

            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            }
            <span className="ca-mono text-[9px] tracking-[0.18em] uppercase text-[hsl(var(--ca-text-3))]">
              {isPremium ? 'Realtid' : isLive ? '15 min delay' : 'Demo'} <span className="text-[hsl(var(--ca-text-3))]/50">/</span> 7 dagar <span className="text-[hsl(var(--ca-text-3))]/50">/</span> <span className="text-[hsl(var(--ca-red))]">{activeCount} aktiva</span>
            </span>
          </div>
        </div>

      </div>

      {!isLoggedIn && <MobileSignupBar />}
      
    </div>);

};

export default Index;