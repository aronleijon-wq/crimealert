import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { useSEO } from '@/hooks/useSEO';
import FilterBar from '@/components/FilterBar';
import StatsBar from '@/components/StatsBar';

import MapView from '@/components/MapView';
import IncidentCard from '@/components/IncidentCard';
import MobileSignupBar from '@/components/MobileSignupBar';


import { KOMMUN_COORDINATES } from '@/data/kommuner';
import HistoryPanel from '@/components/HistoryPanel';
import { useArchiveEvents } from '@/hooks/useArchiveEvents';
import { archiveDaysFor, firstEnd, historyEvents, historyLabel, HISTORY_RANGES, type HistoryRange } from '@/lib/history';
import { mockIncidents, Incident, IncidentType } from '@/data/mockIncidents';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useTrafikverketEvents } from '@/hooks/useTrafikverketEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Wifi, WifiOff, Maximize2, Minimize2, Clock, Zap, List, X, ShieldCheck, MapPin, Bell as BellIcon, History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { filterIncidentsForMap, linkTrafficDuplicates, sortNewestFirst } from '@/lib/mapFilters';
import { crisisToIncident } from '@/lib/externalEvents';
import { useExternalEvents } from '@/hooks/useExternalEvents';


const ALL_FILTERS: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other', 'trafikverket', 'crisis'];

const LIST_PAGE = 60;
// The heat view hides the markers; a constant keeps MapView from redrawing for nothing
const NO_INCIDENTS: Incident[] = [];

const Index = () => {
  useSEO({
    title: 'Livekarta över polishändelser | CrimeAlert',
    description: 'Se polishändelser, brand, trafikolyckor och brott i realtid på kartan. Trygghetskarta för hela Sverige med live-uppdateringar.',
    canonical: 'https://crimealert.se/karta',
  });
  const { isPremium } = useIsPremium();
  const { user, subscription } = useAuth();
  const isMobile = useIsMobile();
  const isLoggedIn = !!user;
  // Phones start with the whole screen for the map; the list opens from the button at the bottom
  const [mobileListOpen, setMobileListOpen] = useState(false);
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

  // Timeline (Pro): a day, week, month or two months back, as a whole, a window being played, or a heatmap
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('7d');
  const [historyEnd, setHistoryEnd] = useState<number | null>(null);
  const [historyPlaying, setHistoryPlaying] = useState(false);
  const [historyHeat, setHistoryHeat] = useState(false);
  const [historyNow, setHistoryNow] = useState(() => Date.now());
  const historyActive = historyOpen && isPremium;
  const archiveDays = archiveDaysFor(historyRange);
  const { incidents: archiveIncidents, loading: archiveLoading } = useArchiveEvents(archiveDays, historyActive && archiveDays > 0);
  const historyIncidents = useMemo(
    () => (historyActive ? historyEvents(archiveDays > 0 ? archiveIncidents : liveIncidents, historyRange, historyEnd, historyNow) : null),
    [historyActive, archiveDays, historyRange, archiveIncidents, liveIncidents, historyEnd, historyNow],
  );
  const chooseHistoryRange = (range: HistoryRange) => {
    setHistoryRange(range);
    setHistoryEnd(null);
    setHistoryPlaying(false);
    setHistoryNow(Date.now());
    // A month or more of events is easiest to read, and lightest to draw, as heat
    if (archiveDaysFor(range) > 0) setHistoryHeat(true);
  };
  const playHistory = (play: boolean) => {
    if (play && (historyEnd === null || historyEnd >= historyNow)) setHistoryEnd(firstEnd(historyRange, historyNow));
    setHistoryPlaying(play);
  };
  // About 20 seconds from start to end, whatever the range
  useEffect(() => {
    if (!historyPlaying) return;
    const { span, window, step } = HISTORY_RANGES[historyRange];
    const tick = Math.max(120, 20000 / ((span - window) / step));
    const id = setInterval(() => setHistoryEnd((end) => (end === null ? null : end + step)), tick);
    return () => clearInterval(id);
  }, [historyPlaying, historyRange]);
  useEffect(() => {
    if (historyPlaying && historyEnd !== null && historyEnd >= historyNow) {
      setHistoryPlaying(false);
      setHistoryEnd(null);
    }
  }, [historyPlaying, historyEnd, historyNow]);

  const timeFiltered = useMemo(
    () => filterIncidentsForMap(allIncidents, { isPremium }),
    [allIncidents, isPremium]
  );

  const filtered = useMemo(
    () => sortNewestFirst((historyIncidents ?? timeFiltered).filter((i) => activeFilters.includes(i.type))),
    [activeFilters, timeFiltered, historyIncidents]
  );
  const showHeat = historyActive && historyHeat;

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
                  {historyActive ?
                `Tidslinje — ${filtered.length} händelser` :
                isPremium ?
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
            incidents={showHeat ? NO_INCIDENTS : filtered}
            selectedId={selectedId}
            onSelectIncident={(id) => setSelectedId(id || null)}
            isPremium={isPremium}
            flyToLocation={flyToLocation}
            heatPoints={showHeat ? filtered : null} />

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

          <div className="absolute left-3 z-[1000] ca-glass rounded-md px-3 py-1.5 flex max-w-[calc(100%-8rem)] items-center gap-2 ca-rise" style={{ top: isFullscreen ? 'calc(0.75rem + env(safe-area-inset-top, 0px))' : '0.75rem' }}>
            {isPremium ?
            <div className="w-1.5 h-1.5 rounded-full bg-cr-green animate-pulse-dot" /> :
            isLive ?
            <div className="w-1.5 h-1.5 rounded-full bg-cr-orange animate-pulse-dot" /> :

            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            }
            <span className="ca-mono min-w-0 truncate text-[9px] tracking-[0.18em] uppercase text-[hsl(var(--ca-text-3))]">
              {historyActive ? (
                <>Tidslinje <span className="text-[hsl(var(--ca-text-3))]/50">/</span> {historyLabel(historyRange, historyEnd)}</>
              ) : (
                <>{isPremium ? 'Realtid' : isLive ? '15 min delay' : 'Demo'} <span className="text-[hsl(var(--ca-text-3))]/50">/</span> 7 dagar <span className="text-[hsl(var(--ca-text-3))]/50">/</span> <span className="text-[hsl(var(--ca-red))]">{activeCount} aktiva</span></>
              )}
            </span>
          </div>

          {!historyOpen && (
            <button
              type="button"
              onClick={() => { setHistoryOpen(true); setHistoryNow(Date.now()); }}
              className="absolute left-3 z-[1000] ca-glass rounded-md px-3 py-1.5 flex items-center gap-1.5 text-[hsl(var(--ca-text-2))] hover:text-[hsl(var(--ca-text))] transition-colors"
              style={{ top: isFullscreen ? 'calc(3.1rem + env(safe-area-inset-top, 0px))' : '3.1rem' }}
            >
              <History className="w-3.5 h-3.5" />
              <span className="ca-mono text-[9px] tracking-[0.18em] uppercase">Tidslinje</span>
              {!isPremium && <span className="rounded bg-primary/20 px-1 text-[8px] font-bold text-primary">PRO</span>}
            </button>
          )}

          {historyOpen && (
            <div className={`absolute left-1/2 z-[1000] -translate-x-1/2 ${isMobile && !mobileListOpen ? 'bottom-16' : 'bottom-4'}`}>
              <HistoryPanel
                isPremium={isPremium}
                offerTrial={!isLoggedIn || subscription.trialEligible === true}
                range={historyRange}
                end={historyEnd}
                start={firstEnd(historyRange, historyNow)}
                now={historyNow}
                playing={historyPlaying}
                heat={historyHeat}
                count={filtered.length}
                loading={archiveDays > 0 && archiveLoading}
                onRange={chooseHistoryRange}
                onEnd={setHistoryEnd}
                onPlay={playHistory}
                onHeat={setHistoryHeat}
                onClose={() => { setHistoryOpen(false); setHistoryPlaying(false); setHistoryEnd(null); }}
              />
            </div>
          )}
        </div>

      </div>

      {/* The sign-up bar sits over the bottom of the screen; the map ends above it, so the list
          button and the timeline stay reachable */}
      {!isLoggedIn && <div className="h-[calc(3.6rem+env(safe-area-inset-bottom,0px))] shrink-0 md:hidden" aria-hidden />}
      {!isLoggedIn && <MobileSignupBar />}
      
    </div>);

};

export default Index;