import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import Header from '@/components/Header';
import { searchKommuner } from '@/data/kommuner';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { countByKommun, kommunerByLetter, kommunPath } from '@/lib/kommunPages';

const LETTERS = kommunerByLetter();
const DAY_MS = 24 * 60 * 60 * 1000;

const Kommuner = () => {
  useSEO({
    title: 'Polisens händelser per kommun – alla 290 kommuner | CrimeAlert',
    description: 'Välj kommun och se Polisens händelser just nu: brott, bränder och olyckor i alla Sveriges 290 kommuner, uppdaterat var femte minut.',
    canonical: 'https://crimealert.se/kommun',
  });
  const { incidents } = usePoliceEvents();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchKommuner(query, 12), [query]);
  const busiest = useMemo(() => countByKommun(incidents, Date.now() - DAY_MS).slice(0, 8), [incidents]);

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] ca-gridlines"
          style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-4 pb-20">
          <section className="pb-6 pt-8 sm:pt-12">
            <p className="ca-eyebrow">Polisens händelser</p>
            <h1 className="ca-display mt-3 text-5xl uppercase text-foreground sm:text-6xl">Kommuner</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
              Välj en kommun och se det senaste som Polisen rapporterat där, dygnet och veckan i siffror.
            </p>
            <label className="relative mt-6 block">
              <span className="sr-only">Sök kommun</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök kommun, t.ex. malmo"
                className="h-12 w-full rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
              />
            </label>
            {query && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card">
                {matches.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">Ingen kommun matchar.</li>
                ) : (
                  matches.map((name) => (
                    <li key={name}>
                      <Link to={kommunPath(name)} className="block px-4 py-2.5 text-sm text-foreground transition hover:bg-[hsl(var(--ca-panel-2))]">
                        {name}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            )}
          </section>

          {busiest.length > 0 && (
            <section aria-labelledby="aktiva" className="mb-8">
              <h2 id="aktiva" className="ca-meta !text-[10px]">Flest händelser senaste dygnet</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {busiest.map(({ name, count }) => (
                  <Link
                    key={name}
                    to={kommunPath(name)}
                    className="rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card px-3 py-2.5 transition hover:border-primary/50"
                  >
                    <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
                    <span className="ca-meta !text-[10px]">{count} {count === 1 ? 'händelse' : 'händelser'}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="alla">
            <h2 id="alla" className="ca-meta !text-[10px]">Alla 290 kommuner</h2>
            <div className="mt-3 space-y-5">
              {LETTERS.map(([letter, names]) => (
                <div key={letter} className="flex gap-4">
                  <span className="w-6 shrink-0 font-['Archivo',Inter,sans-serif] text-lg font-extrabold text-primary">{letter}</span>
                  <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1.5">
                    {names.map((name) => (
                      <li key={name}>
                        <Link to={kommunPath(name)} className="text-sm text-[hsl(var(--ca-text-2))] transition hover:text-foreground">
                          {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Kommuner;
