import { useId, useMemo, useRef, useState } from 'react';
import { Check, LocateFixed, Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import { nearestKommuner, searchKommuner } from '@/data/kommuner';

const POPULAR = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro'];

interface AreaPickerProps {
  kommuner: string[];
  loading: boolean;
  /** Events in each watched kommun over the last day, by name */
  recentCounts: Record<string, number>;
  onAdd: (kommun: string) => void;
  onRemove: (kommun: string) => void;
}

const SuggestionChip = ({ name, onAdd }: { name: string; onAdd: (k: string) => void }) => (
  <button
    type="button"
    onClick={() => onAdd(name)}
    className="inline-flex items-center gap-1 rounded-full border border-dashed border-[hsl(var(--ca-line-strong))] px-3 py-1.5 text-xs text-[hsl(var(--ca-text-2))] transition hover:border-primary/60 hover:text-foreground"
  >
    <Plus className="h-3 w-3" /> {name}
  </button>
);

const AreaPicker = ({ kommuner, loading, recentCounts, onAdd, onRemove }: AreaPickerProps) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [near, setNear] = useState<string[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const results = useMemo(() => searchKommuner(query), [query]);
  const showList = open && query.trim().length > 0;

  const add = (kommun: string) => {
    if (!kommuner.includes(kommun)) onAdd(kommun);
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && showList && results[active]) {
      e.preventDefault();
      add(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('Din webbläsare kan inte dela position.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear(nearestKommuner(pos.coords.latitude, pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setLocateError('Kunde inte hämta din position. Sök på din kommun i stället.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const nearToAdd = near?.filter((k) => !kommuner.includes(k)) ?? [];
  const popularToAdd = POPULAR.filter((k) => !kommuner.includes(k)).slice(0, 4);

  return (
    <div>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] px-3 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
            aria-label="Sök kommun att bevaka"
            placeholder="Sök kommun, t.ex. Malmö"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" aria-label="Rensa sökningen" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Kommuner"
            className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card p-1 shadow-2xl"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">Ingen kommun matchar "{query}"</li>
            ) : results.map((k, i) => {
              const watched = kommuner.includes(k);
              return (
                <li
                  key={k}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(k)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${i === active ? 'bg-[hsl(var(--ca-panel-3))] text-foreground' : 'text-[hsl(var(--ca-text-2))]'}`}
                >
                  <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{k}</span>
                  {watched
                    ? <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--cr-green))]"><Check className="h-3 w-3" /> Bevakas</span>
                    : <span className="text-[11px] text-muted-foreground">Lägg till</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--ca-line-strong))] bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/60 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5 text-primary" />}
          Nära mig
        </button>
        {nearToAdd.map((k) => <SuggestionChip key={k} name={k} onAdd={add} />)}
        {near && nearToAdd.length === 0 && <span className="text-xs text-muted-foreground">Du bevakar redan kommunerna nära dig.</span>}
        {!near && kommuner.length === 0 && popularToAdd.map((k) => <SuggestionChip key={k} name={k} onAdd={add} />)}
      </div>
      {locateError && <p className="mt-2 text-xs text-[hsl(var(--cr-red))]">{locateError}</p>}

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--ca-panel-3))]" />
            <div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--ca-panel-3))]" />
          </div>
        ) : kommuner.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[hsl(var(--ca-line-strong))] px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground">
            Du bevakar inga kommuner ännu.<br />Lägg till där du bor, och gärna där familj och vänner finns.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--ca-line))] overflow-hidden rounded-xl border border-[hsl(var(--ca-line-strong))]" aria-label="Bevakade kommuner">
            {kommuner.map((k) => {
              const count = recentCounts[k] ?? 0;
              return (
                <li key={k} className="flex items-center gap-3 bg-card/60 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{k}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {count > 0 ? `${count} ${count === 1 ? 'händelse' : 'händelser'} senaste dygnet` : 'Lugnt senaste dygnet'}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Sluta bevaka ${k}`}
                    onClick={() => onRemove(k)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--ca-red)/0.12)] hover:text-[hsl(var(--ca-red))]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AreaPicker;
