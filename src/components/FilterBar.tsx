import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { IncidentType, incidentTypeConfig } from '@/data/mockIncidents';
import { SlidersHorizontal, Search, X, MapPin, Lock, Crown, ChevronDown } from 'lucide-react';
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
  other: 'hsl(var(--muted-foreground))'
};

const FilterBar = ({ activeFilters, onToggleFilter, incidentCount, activeCount, showCommunityReports, onToggleCommunityReports, onSearchLocation }: FilterBarProps) => {
  const types: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other'];
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const isLoggedIn = !!user;
  const navigate = useNavigate();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = activeFilters.length + (showCommunityReports && isPremium ? 1 : 0);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return SWEDISH_MUNICIPALITIES
      .filter((m) => m.name.toLowerCase().startsWith(q))
      .concat(
        SWEDISH_MUNICIPALITIES.filter(
          (m) => !m.name.toLowerCase().startsWith(q) && m.name.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [query]);

  useEffect(() => { setSelectedIndex(0); }, [results]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        (!portalRef.current || !portalRef.current.contains(e.target as Node))
      ) {
        setSearchOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filtersOpen]);

  const selectMunicipality = (m: Municipality) => {
    onSearchLocation?.(m.lat, m.lng, m.zoom, m.name);
    setSearchOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[selectedIndex]) { e.preventDefault(); selectMunicipality(results[selectedIndex]); }
    else if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); }
  };

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Filter toggle button */}
        <div className="relative" ref={filterPanelRef}>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium
              transition-all duration-150 whitespace-nowrap select-none border
              ${filtersOpen
                ? 'bg-muted text-foreground border-border shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground border-transparent hover:border-border'}
            `}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Filter dropdown panel */}
          {filtersOpen && (
            <div className="absolute top-full left-0 mt-1 z-[9999] bg-card border border-border rounded-lg shadow-xl p-3 min-w-[220px]">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Händelsetyper</p>
              <div className="flex flex-col gap-0.5 mb-3">
                {types.map((type) => {
                  const config = incidentTypeConfig[type];
                  const active = activeFilters.includes(type);
                  const color = TYPE_COLORS[type];
                  const isLocked = type === 'other' && !isLoggedIn;

                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (isLocked) { navigate('/auth?mode=login'); return; }
                        onToggleFilter(type);
                      }}
                      className={`
                        flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium
                        transition-all duration-150 whitespace-nowrap select-none
                        ${isLocked
                          ? 'text-primary hover:bg-primary/5'
                          : active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                      `}>
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 transition-all duration-150 ${
                            active ? 'border-transparent' : 'border-muted-foreground/20 bg-transparent'
                          }`}
                          style={active ? { backgroundColor: color } : {}}
                        />
                      )}
                      <span className="flex-1 text-left">{config.label}</span>
                      {isLocked && (
                        <span className="text-[9px] font-semibold text-primary/70 bg-primary/5 rounded px-1.5 py-0.5">Gratis</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-border mb-3" />

              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Medborgarrapporter</p>
              <button
                onClick={() => {
                  if (!isPremium) { navigate('/account'); return; }
                  onToggleCommunityReports();
                }}
                className={`
                  w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium
                  transition-all duration-150 whitespace-nowrap select-none
                  ${!isPremium
                    ? 'text-secondary hover:bg-secondary/5'
                    : showCommunityReports
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                `}
                title={!isPremium ? 'Uppgradera till Pro för medborgarrapporter' : 'Visa/dölj medborgarrapporter'}>
                {!isPremium ? (
                  <Lock className="w-3.5 h-3.5 text-secondary shrink-0" />
                ) : (
                  <span
                    className={`w-2.5 h-2.5 rounded-sm rotate-45 shrink-0 border-2 transition-all duration-150 ${
                      showCommunityReports ? 'border-transparent' : 'border-muted-foreground/20 bg-transparent'
                    }`}
                    style={showCommunityReports ? { backgroundColor: 'hsl(var(--cr-orange))' } : {}}
                  />
                )}
                <span className="flex-1 text-left">Medborgarrapporter</span>
                {!isPremium && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-secondary bg-secondary/10 rounded px-1.5 py-0.5 leading-none">
                    <Crown className="w-2.5 h-2.5" />
                    PRO
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Active filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {activeFilters.map((type) => {
            const color = TYPE_COLORS[type];
            const config = incidentTypeConfig[type];
            return (
              <button
                key={type}
                onClick={() => onToggleFilter(type)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/60 text-[10px] font-medium text-foreground hover:bg-muted transition-colors shrink-0"
                title={`Ta bort ${config.label}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{config.label}</span>
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            );
          })}
          {isPremium && showCommunityReports && (
            <button
              onClick={onToggleCommunityReports}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/60 text-[10px] font-medium text-foreground hover:bg-muted transition-colors shrink-0"
              title="Ta bort Medborgarrapporter">
              <span className="w-1.5 h-1.5 rounded-sm rotate-45" style={{ backgroundColor: 'hsl(var(--cr-orange))' }} />
              <span>Rapporter</span>
              <X className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Municipality search */}
        <div className="relative shrink-0" ref={dropdownRef}>
          {searchOpen ? (
            <div className="flex items-center gap-1 bg-muted rounded-md px-2.5 py-1.5 border border-border">
              <Search className="w-3 h-3 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/<[^>]*>/g, '').slice(0, 50))}
                onKeyDown={handleKeyDown}
                placeholder="Sök kommun..."
                className="bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none w-28 sm:w-36"
              />
              <button
                onClick={() => { setSearchOpen(false); setQuery(''); }}
                className="p-0.5 hover:bg-muted-foreground/10 rounded">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 whitespace-nowrap border border-transparent hover:border-border"
              title="Sök kommun">
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Sök kommun</span>
            </button>
          )}

          {searchOpen && results.length > 0 && createPortal(
            <div ref={portalRef} className="fixed w-52 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto" style={{ zIndex: 99999, top: (inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: inputRef.current?.getBoundingClientRect().left ?? 0 }}>
              {results.map((m, i) => (
                <button
                  key={m.name}
                  onClick={() => selectMunicipality(m)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    i === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'
                  }`}>
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-medium">{m.name}</span>
                </button>
              ))}
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
      </div>
    </div>
  );
};

export default FilterBar;
