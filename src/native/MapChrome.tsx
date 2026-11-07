// The map in the iPhone app from version 1.3, laid out as Apple Maps: the map fills the screen,
// a search field floats at the top, and the events are in a sheet you pull up from the bottom.
// The map page (pages/Index) keeps all the data and state; this only draws it. Older app
// versions and the website keep the map page's own layout.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, History, Lock, Search, SlidersHorizontal, X } from 'lucide-react';
import { incidentTypeConfig, type Incident, type IncidentType } from '@/data/mockIncidents';
import { SWEDISH_MUNICIPALITIES, type Municipality } from '@/data/swedishMunicipalities';
import { usePoliceSourceStatus } from '@/hooks/usePoliceEvents';
import { cleanPoliceTitle } from '@/lib/feed';
import { canSellPro } from '@/lib/native';
import { formatTimeAgo } from '@/lib/timeAgo';
import { incidentTypeIcon } from '@/lib/typeIcons';
import { haptics } from './haptics';
import { detentHeights, rubberBand, settle, type Detent } from './sheet';
import { Switch } from './ui';

const TYPES: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other', 'trafikverket', 'crisis'];
const PAGE = 60;
const STALE_AFTER_MS = 30 * 60 * 1000;

const glass = 'bg-[rgba(28,28,30,0.78)] backdrop-blur-xl backdrop-saturate-150 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.45)]';

export interface MapChromeProps {
  incidents: Incident[];
  activeCount: number;
  loading: boolean;
  /** "Realtid", "15 min fördröjning", "Tidslinje …" */
  status: string;
  live: boolean;
  selectedId: string | null;
  onSelect: (incident: Incident) => void;
  activeFilters: IncidentType[];
  onToggleFilter: (type: IncidentType) => void;
  isPremium: boolean;
  showCommunityReports: boolean;
  onToggleCommunityReports: () => void;
  onSearch: (m: Municipality) => void;
  onTimeline: () => void;
  timelineOpen: boolean;
  /** The timeline's panel, shown just above the sheet */
  timeline: ReactNode;
}

/** One event in the sheet, as a row in an iOS list */
const EventRow = ({ incident, selected, onClick }: { incident: Incident; selected: boolean; onClick: () => void }) => {
  const config = incidentTypeConfig[incident.type] ?? incidentTypeConfig.other;
  // "Övrigt" is a dark grey on the map; on the sheet it needs to be lighter to be seen
  const color = incident.type === 'other' ? '#8e8e93' : config.color;
  const Icon = incidentTypeIcon(incident.type);
  const title = cleanPoliceTitle(incident.title);
  return (
    <button type="button" onClick={onClick} className={`ios-row flex w-full items-center gap-3 pl-4 text-left active:bg-white/[0.06] ${selected ? 'bg-white/[0.06]' : ''}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)` }}>
        <Icon className="h-[18px] w-[18px]" style={{ color }} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="ios-row-body flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-4">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium leading-[21px] text-white">{title}</span>
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-[rgba(235,235,245,0.6)]">
            {incident.area} · {formatTimeAgo(incident.time)}
          </span>
        </span>
        {incident.status === 'active' && (
          <span className="shrink-0 rounded-full bg-[rgba(255,69,58,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[#ff453a]">Pågår</span>
        )}
      </span>
    </button>
  );
};

/** Searching for a kommun, over the whole screen as iOS does when a search field is tapped */
const SearchScreen = ({ onPick, onClose }: { onPick: (m: Municipality) => void; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.toLocaleLowerCase('sv-SE').trim();
    if (!q) return [];
    const name = (m: Municipality) => m.name.toLocaleLowerCase('sv-SE');
    return [...SWEDISH_MUNICIPALITIES.filter((m) => name(m).startsWith(q)), ...SWEDISH_MUNICIPALITIES.filter((m) => !name(m).startsWith(q) && name(m).includes(q))].slice(0, 30);
  }, [query]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Sök kommun" className="ios ca-app-fade fixed inset-0 z-[3000] flex flex-col bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center gap-3 px-4 pb-2 pt-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-[rgba(118,118,128,0.24)] px-2.5">
          <Search className="h-[17px] w-[17px] shrink-0 text-[rgba(235,235,245,0.6)]" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 50))}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) onPick(results[0]); }}
            placeholder="Sök kommun"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.6)]"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Rensa" className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[rgba(235,235,245,0.6)]">
              <X className="h-3 w-3 text-black" strokeWidth={3} aria-hidden />
            </button>
          )}
        </label>
        <button type="button" onClick={onClose} className="shrink-0 text-[17px] text-[#ff453a]">Avbryt</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {query.trim() && !results.length && <p className="px-6 pt-10 text-center text-[15px] text-[rgba(235,235,245,0.6)]">Ingen kommun heter så.</p>}
        {!query.trim() && <p className="px-6 pt-10 text-center text-[15px] text-[rgba(235,235,245,0.6)]">Skriv namnet på en kommun för att flyga dit.</p>}
        {results.length > 0 && (
          <div className="ios-group mx-4 mt-2 overflow-hidden rounded-xl bg-[#1c1c1e]">
            {results.map((m) => (
              <button key={m.name} type="button" onClick={() => onPick(m)} className="ios-row flex w-full items-center pl-4 text-left active:bg-[#2c2c2e]">
                <span className="ios-row-body flex min-h-[44px] flex-1 items-center justify-between py-2.5 pr-4 text-[17px] text-white">
                  {m.name}
                  <ChevronRight className="h-[18px] w-[18px] text-[rgba(235,235,245,0.3)]" strokeWidth={2.5} aria-hidden />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Which kinds of event the map shows, as a sheet of switches */
const FilterSheet = ({ activeFilters, onToggle, isPremium, showCommunityReports, onToggleCommunityReports, onClose }: {
  activeFilters: IncidentType[];
  onToggle: (type: IncidentType) => void;
  isPremium: boolean;
  showCommunityReports: boolean;
  onToggleCommunityReports: () => void;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[3000] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Visa på kartan">
      <button type="button" aria-label="Stäng" onClick={onClose} className="ca-app-fade absolute inset-0 bg-black/40" />
      <div className="ios ca-app-sheet relative max-h-[85%] overflow-y-auto rounded-t-[14px] bg-[#1c1c1e] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#1c1c1e] px-4 pb-2 pt-3">
          <span className="w-16" />
          <span className="text-[17px] font-semibold">Visa på kartan</span>
          <button type="button" onClick={onClose} className="w-16 text-right text-[17px] font-semibold text-[#ff453a]">Klar</button>
        </div>
        <div className="ios-group mx-4 mt-2 overflow-hidden rounded-xl bg-[#2c2c2e]">
          {TYPES.map((type) => {
            const config = incidentTypeConfig[type];
            const Icon = incidentTypeIcon(type);
            const on = activeFilters.includes(type);
            return (
              <div key={type} className="ios-row flex items-center gap-3 pl-4">
                <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px]" style={{ background: config.color }}>
                  <Icon className="h-[17px] w-[17px] text-white" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="ios-row-body flex min-h-[44px] flex-1 items-center justify-between gap-2 py-1.5 pr-4">
                  <span className="text-[17px]">{config.label}</span>
                  <Switch checked={on} label={config.label} onChange={() => { haptics.selection(); onToggle(type); }} />
                </span>
              </div>
            );
          })}
        </div>
        <div className="ios-group mx-4 mt-6 overflow-hidden rounded-xl bg-[#2c2c2e]">
          <div className="ios-row flex items-center gap-3 pl-4">
            <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#ff9f0a]">
              {isPremium ? <AlertTriangle className="h-[17px] w-[17px] text-white" aria-hidden /> : <Lock className="h-[16px] w-[16px] text-white" aria-hidden />}
            </span>
            <span className="ios-row-body flex min-h-[44px] flex-1 items-center justify-between gap-2 py-1.5 pr-4">
              <span className="text-[17px]">Medborgarrapporter</span>
              {isPremium ? (
                <Switch checked={showCommunityReports} label="Medborgarrapporter" onChange={() => { haptics.selection(); onToggleCommunityReports(); }} />
              ) : canSellPro() ? (
                <button type="button" onClick={() => { onClose(); navigate('/prisplan'); }} className="rounded-full bg-[rgba(255,69,58,0.16)] px-3 py-1 text-[13px] font-semibold text-[#ff453a]">Pro</button>
              ) : (
                <span className="text-[15px] text-[rgba(235,235,245,0.6)]">Pro</span>
              )}
            </span>
          </div>
        </div>
        <p className="mx-8 mt-2 text-[13px] leading-snug text-[rgba(235,235,245,0.6)]">Vad andra i närheten har sett och rapporterat.</p>
      </div>
    </div>
  );
};

const MapChrome = ({
  incidents, activeCount, loading, status, live, selectedId, onSelect, activeFilters, onToggleFilter, isPremium,
  showCommunityReports, onToggleCommunityReports, onSearch, onTimeline, timelineOpen, timeline,
}: MapChromeProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState(0);
  const [detent, setDetent] = useState<Detent>('peek');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startHeight: number; lastY: number; lastT: number; velocity: number; moved: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const { fetchedAt, stale } = usePoliceSourceStatus();
  const old = stale || (fetchedAt !== null && Date.now() - fetchedAt > STALE_AFTER_MS);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setContainer(el.clientHeight);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => setShown(PAGE), [activeFilters]);

  const heights = detentHeights(container || 700);
  const height = dragHeight ?? heights[detent];
  const filtersOff = TYPES.length - activeFilters.length;

  const goTo = (next: Detent) => {
    if (next !== detent) haptics.impact('light');
    setDetent(next);
    if (next !== 'full') listRef.current?.scrollTo?.({ top: 0 });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { startY: e.clientY, startHeight: height, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (!d.moved && Math.abs(dy) < 4) return;
    d.moved = true;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = 0.8 * ((d.lastY - e.clientY) / dt) + 0.2 * d.velocity;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setDragHeight(rubberBand(d.startHeight + dy, heights.peek, heights.full));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // A tap on the header opens the sheet halfway, or closes it
      goTo(detent === 'peek' ? 'half' : 'peek');
    } else {
      goTo(settle(dragHeight ?? height, d.velocity, heights));
    }
    setDragHeight(null);
  };

  const pick = (incident: Incident) => {
    haptics.selection();
    onSelect(incident);
    goTo('peek');
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[1000]">
      {/* Search, filters and the timeline, floating over the map below the status bar */}
      <div className="pointer-events-auto absolute inset-x-0 top-0 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { haptics.impact('light'); setSearching(true); }} className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-left active:scale-[0.98] ${glass} transition`}>
            <Search className="h-[18px] w-[18px] shrink-0 text-[rgba(235,235,245,0.6)]" aria-hidden />
            <span className="truncate text-[17px] text-[rgba(235,235,245,0.6)]">Sök kommun</span>
          </button>
          <button type="button" aria-label="Visa på kartan" onClick={() => { haptics.impact('light'); setFiltering(true); }} className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 ${glass} transition`}>
            <SlidersHorizontal className="h-[19px] w-[19px] text-white" aria-hidden />
            {filtersOff > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-[#1c1c1e] bg-[#ff453a]" aria-label="Några slag är dolda" />}
          </button>
          <button type="button" aria-label="Tidslinje" aria-pressed={timelineOpen} onClick={() => { haptics.impact('light'); onTimeline(); }} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 ${glass} transition ${timelineOpen ? '!bg-[#ff453a]' : ''}`}>
            <History className="h-[19px] w-[19px] text-white" aria-hidden />
          </button>
        </div>
        {old && (
          <p role="status" className={`mx-auto mt-2 flex w-fit max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-white ${glass}`}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#ff9f0a]" aria-hidden />
            <span className="truncate">Polisens händelser uppdateras inte just nu</span>
          </p>
        )}
      </div>

      {timelineOpen && (
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 transition-[bottom] duration-300" style={{ bottom: Math.min(height, heights.half) + 12 }}>
          {timeline}
        </div>
      )}

      {/* The sheet of events */}
      <section
        aria-label="Händelser"
        className={`ios pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[14px] bg-[rgba(28,28,30,0.92)] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-150 ${dragHeight === null ? 'transition-[height] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]' : ''}`}
        style={{ height }}
      >
        <div
          className="shrink-0 touch-none select-none px-4 pb-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="button"
          tabIndex={0}
          aria-expanded={detent !== 'peek'}
          aria-label={detent === 'peek' ? 'Visa händelserna' : 'Dölj händelserna'}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(detent === 'peek' ? 'half' : 'peek'); } }}
        >
          <div className="mx-auto mb-2.5 mt-1.5 h-[5px] w-9 rounded-full bg-[rgba(235,235,245,0.3)]" aria-hidden />
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-bold leading-7 tracking-[-0.01em] text-white">
                {loading && !incidents.length ? 'Hämtar händelser…' : `${incidents.length} händelser`}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[14px] text-[rgba(235,235,245,0.6)]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-[#30d158]' : 'bg-[#ff9f0a]'}`} aria-hidden />
                {status}{activeCount > 0 ? ` · ${activeCount} pågår` : ''}
              </p>
            </div>
          </div>
        </div>
        <div ref={listRef} className={`min-h-0 flex-1 overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom,0px))] ${detent === 'full' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <div className="ios-group mx-4 overflow-hidden rounded-xl bg-[#2c2c2e]">
            {incidents.slice(0, shown).map((incident) => (
              <EventRow key={incident.id} incident={incident} selected={incident.id === selectedId} onClick={() => pick(incident)} />
            ))}
          </div>
          {!loading && !incidents.length && (
            <p className="px-6 pt-6 text-center text-[15px] text-[rgba(235,235,245,0.6)]">Inget att visa med de här filtren.</p>
          )}
          {shown < incidents.length && (
            <button type="button" onClick={() => { if (detent !== 'full') goTo('full'); setShown((n) => n + PAGE); }} className="mx-auto mt-3 block h-11 px-6 text-[15px] font-semibold text-[#ff453a]">
              Visa fler ({incidents.length - shown} till)
            </button>
          )}
        </div>
      </section>

      {/* Over the tabs too, so outside the map's own layer */}
      {searching && createPortal(
        <div className="ca-dark">
          <SearchScreen onClose={() => setSearching(false)} onPick={(m) => { haptics.selection(); setSearching(false); goTo('peek'); onSearch(m); }} />
        </div>,
        document.body,
      )}
      {filtering && createPortal(
        <div className="ca-dark">
          <FilterSheet
            activeFilters={activeFilters}
            onToggle={onToggleFilter}
            isPremium={isPremium}
            showCommunityReports={showCommunityReports}
            onToggleCommunityReports={onToggleCommunityReports}
            onClose={() => setFiltering(false)}
          />
        </div>,
        document.body,
      )}
    </div>
  );
};

export default MapChrome;
