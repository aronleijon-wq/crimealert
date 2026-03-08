import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IncidentType, incidentTypeConfig } from '@/data/mockIncidents';
import { SlidersHorizontal, Search, X, MapPin } from 'lucide-react';
import { SWEDISH_MUNICIPALITIES, Municipality } from '@/data/swedishMunicipalities';

interface FilterBarProps {
  activeFilters: IncidentType[];
  onToggleFilter: (type: IncidentType) => void;
  incidentCount: number;
  activeCount: number;
  onSearchLocation?: (lat: number, lng: number, zoom: number, name: string) => void;
}


const TYPE_COLORS: Record<IncidentType, string> = {
  police: 'hsl(var(--cr-blue))',
  fire: 'hsl(var(--cr-red))',
  ambulance: 'hsl(var(--cr-green))',
  traffic: 'hsl(var(--cr-orange))',
  other: 'hsl(var(--muted-foreground))',
};

const FilterBar = ({ activeFilters, onToggleFilter, incidentCount, activeCount, onSearchLocation }: FilterBarProps) => {
  const types: IncidentType[] = ['police', 'fire', 'ambulance', 'traffic', 'other'];

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return SWEDISH_MUNICIPALITIES
      .filter(m => m.name.toLowerCase().startsWith(q))
      .concat(
        SWEDISH_MUNICIPALITIES.filter(
          m => !m.name.toLowerCase().startsWith(q) && m.name.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Close dropdown on outside click
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

  const selectMunicipality = (m: Municipality) => {
    onSearchLocation?.(m.lat, m.lng, m.zoom, m.name);
    setSearchOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      selectMunicipality(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm overflow-x-auto scrollbar-none">
      <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mr-1" />
      
      {/* Municipality search */}
      <div className="relative shrink-0" ref={dropdownRef}>
        {searchOpen ? (
          <div className="flex items-center gap-1 bg-muted rounded-full px-2 py-1">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value.replace(/<[^>]*>/g, '').slice(0, 50))}
              onKeyDown={handleKeyDown}
              placeholder="Sök kommun..."
              className="bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none w-28 sm:w-36"
            />
            <button
              onClick={() => { setSearchOpen(false); setQuery(''); }}
              className="p-0.5 hover:bg-muted-foreground/10 rounded-full"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-transparent text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground transition-all duration-200 whitespace-nowrap"
            title="Sök kommun"
          >
            <Search className="w-3 h-3" />
            <span className="hidden sm:inline">Sök kommun</span>
          </button>
        )}

        {/* Dropdown results */}
        {searchOpen && results.length > 0 && createPortal(
          <div ref={portalRef} className="fixed w-52 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto" style={{ zIndex: 99999, top: (inputRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: inputRef.current?.getBoundingClientRect().left ?? 0 }}>
            {results.map((m, i) => (
              <button
                key={m.name}
                onClick={() => selectMunicipality(m)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  i === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
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

      {/* Separator */}
      <div className="w-px h-4 bg-border shrink-0" />

      {types.map((type) => {
        const config = incidentTypeConfig[type];
        const active = activeFilters.includes(type);
        const color = TYPE_COLORS[type];

        return (
          <button
            key={type}
            onClick={() => onToggleFilter(type)}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
              transition-all duration-200 whitespace-nowrap select-none
              ${active
                ? 'bg-muted text-foreground shadow-sm'
                : 'bg-transparent text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground'
              }
            `}
            title={config.label}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-opacity duration-200 ${
                active ? 'opacity-100' : 'opacity-40'
              }`}
              style={{ backgroundColor: color }}
            />
            
            <span className="leading-none">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default FilterBar;
