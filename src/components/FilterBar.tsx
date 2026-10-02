import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { IncidentType, incidentTypeConfig } from '@/data/mockIncidents';
import { SlidersHorizontal, Search, X, MapPin, Lock, Crown } from 'lucide-react';
import { SWEDISH_MUNICIPALITIES, Municipality } from '@/data/swedishMunicipalities';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';

interface FilterBarProps {
  activeFilters: IncidentType[];
  onToggleFilter: (type: IncidentType) => void;
  incidentCount: number;
  activeCount: number;
  showCommunityReports: boolean;
  onToggleCommunityReports: () => void;
  onSearchLocation?: (lat: number, lng: number, zoom: number, name: string) => void;
}

const TYPE_COLORS: Record<IncidentType, string> = {
  police: 'hsl(var(--cr-blue))',
  fire: 'hsl(var(--cr-red))',
  ambulance: 'hsl(var(--cr-green))',
  traffic: 'hsl(var(--cr-orange))',
  other: 'hsl(var(--muted-foreground))',
  trafikverket: 'hsl(48, 100%, 55%)',
  crisis: 'hsl(280, 75%, 62%)'
};

const FilterBar = ({ activeFilters, onToggleFilter, incidentCount, activeCount, showCommunityReports, onToggleCommunityReports, onSearchLocation }: FilterBarProps) => {
  const types: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other', 'trafikverket', 'crisis'];
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const isLoggedIn = !!user;
  const navigate = useNavigate();

  const [filtersVisible, setFiltersVisible] = useState(() => {
    const stored = sessionStorage.getItem('filtersVisible');
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    sessionStorage.setItem('filtersVisible', String(filtersVisible));
  }, [filtersVisible]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = activeFilters.length + (showCommunityReports && isPremium ? 1 : 0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return SWEDISH_MUNICIPALITIES.
    filter((m) => m.name.toLowerCase().startsWith(q)).
    concat(
      SWEDISH_MUNICIPALITIES.filter(
        (m) => !m.name.toLowerCase().startsWith(q) && m.name.toLowerCase().includes(q)
      )
    ).
    slice(0, 8);
  }, [query]);

  useEffect(() => {setSelectedIndex(0);}, [results]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (
      dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && (
      !portalRef.current || !portalRef.current.contains(e.target as Node)))
      {
        setSearchOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const selectMunicipality = (m: Municipality) => {
    onSearchLocation?.(m.lat, m.lng, m.zoom, m.name);
    setSearchOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {e.preventDefault();setSelectedIndex((i) => Math.min(i + 1, results.length - 1));} else
    if (e.key === 'ArrowUp') {e.preventDefault();setSelectedIndex((i) => Math.max(i - 1, 0));} else
    if (e.key === 'Enter' && results[selectedIndex]) {e.preventDefault();selectMunicipality(results[selectedIndex]);} else
    if (e.key === 'Escape') {setSearchOpen(false);setQuery('');}
  };

  return (
    <div className="border-b border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base-2))]/80 backdrop-blur-md">
      <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none">
        {/* Municipality search */}
        <div className="relative shrink-0" ref={dropdownRef}>
          {searchOpen ?
          <div className="flex items-center gap-1 bg-muted rounded-md px-2.5 py-1.5 border border-border">
              <Search className="w-3 h-3 text-muted-foreground shrink-0" />
              <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.replace(/<[^>]*>/g, '').slice(0, 50))}
              onKeyDown={handleKeyDown}
              placeholder="Sök kommun..."
              className="bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none w-28 sm:w-36" />
            
              <button
              onClick={() => {setSearchOpen(false);setQuery('');}}
              className="p-0.5 hover:bg-muted-foreground/10 rounded">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div> :

          <button
            onClick={() => setSearchOpen(true)}
            className="ca-mono flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9.5px] uppercase tracking-[0.16em] text-[hsl(var(--ca-text-3))] hover:bg-[hsl(var(--ca-panel-3))] hover:text-[hsl(var(--ca-text))] transition-all duration-300 whitespace-nowrap border border-transparent hover:border-[hsl(var(--ca-line))]"
            title="Sök kommun">
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Sök kommun</span>
            </button>
          }

          {searchOpen && results.length > 0 && createPortal(
            <div ref={portalRef} className="fixed w-52 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto" style={{ zIndex: 99999, top: (inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: inputRef.current?.getBoundingClientRect().left ?? 0 }}>
              {results.map((m, i) =>
              <button
                key={m.name}
                onClick={() => selectMunicipality(m)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                i === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'}`
                }>
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-medium">{m.name}</span>
                </button>
              )}
            </div>,
            document.body
          )}

          {searchOpen && query.trim() && results.length === 0 && createPortal(
            <div className="fixed w-52 bg-card border border-border rounded-lg shadow-xl p-3" style={{ zIndex: 99999, top: (inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: inputRef.current?.getBoundingClientRect().left ?? 0 }}>
              <p className="text-[10px] text-muted-foreground text-center">Ingen kommun hittades</p>
            </div>,
            document.body
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersVisible(!filtersVisible)}
          className={`
            ca-mono flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9.5px] uppercase tracking-[0.16em] shrink-0
            transition-all duration-300 whitespace-nowrap select-none border
            ${filtersVisible ?
          'bg-[hsl(var(--ca-panel-3))] text-[hsl(var(--ca-text))] border-[hsl(var(--ca-line-strong))]' :
          'text-[hsl(var(--ca-text-3))] hover:bg-[hsl(var(--ca-panel-3))] hover:text-[hsl(var(--ca-text-2))] border-transparent hover:border-[hsl(var(--ca-line))]'}
          `}>

          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filter</span>
          {!filtersVisible && activeFilterCount > 0 &&
          <span className="bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {activeFilterCount}
            </span>
          }
        </button>

        {/* Inline filter chips — shown when filtersVisible */}
        {filtersVisible &&
        <>
            <div className="w-px h-4 bg-border shrink-0" />

            {types.map((type) => {
            const config = incidentTypeConfig[type];
            const active = activeFilters.includes(type);
            const color = TYPE_COLORS[type];
            const isLocked = false;

            return (
              <button
                key={type}
                onClick={() => {
                  if (isLocked) {navigate('/auth?mode=login');return;}
                  onToggleFilter(type);
                }}
                className={`
                    ca-mono flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9.5px] uppercase tracking-[0.16em] shrink-0
                    transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap select-none border
                    ${isLocked ?
                'bg-primary/5 text-primary border-primary/15 hover:bg-primary/10' :
                active ?
                'bg-[hsl(var(--ca-panel-3))] text-[hsl(var(--ca-text))] border-[hsl(var(--ca-line-strong))]' :
                'text-[hsl(var(--ca-text-3))] border-transparent hover:bg-[hsl(var(--ca-panel-3))] hover:text-[hsl(var(--ca-text-2))] hover:border-[hsl(var(--ca-line))]'}
                  `}

                title={isLocked ? 'Logga in gratis för att se Övrigt' : config.label}>
                  {isLocked ?
                <Lock className="w-3 h-3 text-destructive/70 shrink-0 drop-shadow-[0_0_4px_hsl(var(--destructive)/0.5)]" /> :

                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-30'}`}
                  style={{ backgroundColor: color }} />

                }
                  <span className="leading-none">{config.label}</span>
                  {isLocked &&
                <span className="text-[9px] font-semibold text-primary/70">{'\u200B'}</span>
                }
                </button>);

          })}

            <div className="w-px h-4 bg-border shrink-0" />

            {/* Medborgarrapporter */}
            <button
            onClick={() => {
              if (!isPremium) {navigate('/account');return;}
              onToggleCommunityReports();
            }}
            className={`
                ca-mono flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9.5px] uppercase tracking-[0.16em] shrink-0
                transition-all duration-300 whitespace-nowrap select-none border
                ${!isPremium ?
            'bg-secondary/5 text-secondary border-secondary/15 hover:bg-secondary/10' :
            showCommunityReports ?
            'bg-[hsl(var(--ca-panel-3))] text-[hsl(var(--ca-text))] border-[hsl(var(--ca-line-strong))]' :
            'text-[hsl(var(--ca-text-3))] border-transparent hover:bg-[hsl(var(--ca-panel-3))] hover:text-[hsl(var(--ca-text-2))] hover:border-[hsl(var(--ca-line))]'}
              `}

            title={!isPremium ? 'Uppgradera till Pro för medborgarrapporter' : 'Medborgarrapporter'}>
              {!isPremium ?
            <Lock className="w-3 h-3 text-yellow-500 shrink-0 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" /> :

            <span className={`relative shrink-0 flex items-center justify-center transition-opacity duration-150 ${showCommunityReports ? 'opacity-100' : 'opacity-30'}`} style={{ width: 14, height: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f97316', border: '1.5px solid rgba(255,255,255,0.95)', transform: 'rotate(45deg)', boxShadow: '0 1px 4px rgba(249,115,22,0.5)', display: 'block' }} />
                  <span style={{ position: 'absolute', fontSize: 7, lineHeight: 1, pointerEvents: 'none' }}>👁️</span>
                </span>
            }
              <span className="leading-none">Medborgarrapporter</span>
              {!isPremium &&
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-secondary bg-secondary/10 rounded px-1 py-0.5 leading-none">
                  <Crown className="w-2.5 h-2.5" />
                  PRO
                </span>
            }
            </button>
          </>
        }

        <div className="flex-1" />
      </div>
    </div>);

};

export default FilterBar;