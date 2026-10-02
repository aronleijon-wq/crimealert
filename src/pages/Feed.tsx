import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Clock, Radio } from 'lucide-react';
import Header from '@/components/Header';
import FeedCard from '@/components/feed/FeedCard';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useEngagementCounts } from '@/hooks/useEngagementCounts';
import { useExternalEvents } from '@/hooks/useExternalEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { useTrafikverketEvents } from '@/hooks/useTrafikverketEvents';
import { sourceName } from '@/lib/externalEvents';
import { buildFeed, filterFeed, groupByDay, type FeedFilter } from '@/lib/feed';

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const FILTERS: { value: FeedFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'Allt', icon: '◉' },
  { value: 'police', label: 'Polisen', icon: '🛡️' },
  { value: 'crisis', label: 'Kris & VMA', icon: '📢' },
  { value: 'traffic', label: 'Trafik', icon: '🚧' },
  { value: 'news', label: 'Nyheter', icon: '📰' },
  { value: 'mine', label: 'Mitt område', icon: '📍' },
];

const SkeletonCard = () => (
  <div className="overflow-hidden rounded-2xl border border-[hsl(var(--ca-line-strong))] bg-card" aria-hidden>
    <div className="h-40 animate-pulse bg-[hsl(var(--ca-panel-3))]" />
    <div className="space-y-3 p-5">
      <div className="h-3 w-1/3 animate-pulse rounded bg-[hsl(var(--ca-panel-3))]" />
      <div className="h-5 w-4/5 animate-pulse rounded bg-[hsl(var(--ca-panel-3))]" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-[hsl(var(--ca-panel-3))]" />
    </div>
  </div>
);

const Stat = ({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | number }) => (
  <div className="rounded-xl border border-[hsl(var(--ca-line-strong))] bg-card/70 px-3 py-2.5 backdrop-blur">
    <p className="ca-meta flex items-center gap-1.5 !text-[9px]"><Icon className="h-3 w-3" />{label}</p>
    <p className="mt-1 font-['Archivo',Inter,sans-serif] text-xl font-extrabold tabular-nums text-foreground">{value}</p>
  </div>
);

const Feed = () => {
  useSEO({
    title: 'Flöde — senaste händelserna i Sverige | CrimeAlert',
    description: 'Polisens händelser, VMA, krisinformation, trafikstörningar och lokala nyheter i ett flöde. Gilla och kommentera.',
    canonical: 'https://crimealert.se/flode',
  });
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { incidents: police, loading: policeLoading, error: policeError, updatedAt } = usePoliceEvents();
  const { incidents: traffic } = useTrafikverketEvents();
  const { events: external, loading: externalLoading } = useExternalEvents();
  const { reports: community } = useCommunityReports(isPremium);
  const { kommuner } = useNotificationPreferences();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => buildFeed({ police, traffic, community, external, isPremium }),
    [police, traffic, community, external, isPremium],
  );
  const filtered = useMemo(() => filterFeed(items, filter, kommuner), [items, filter, kommuner]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const sections = useMemo(() => groupByDay(visible), [visible]);
  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const { engagement, toggleReaction, setCommentCount } = useEngagementCounts(visibleIds);
  const hasMore = visibleCount < filtered.length;

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, filterFeed(items, f.value, kommuner).length])) as Record<FeedFilter, number>,
    [items, kommuner],
  );
  const stats = useMemo(() => {
    const events = items.filter((i) => i.kind !== 'news');
    return {
      lastDay: events.filter((i) => i.timestamp >= Date.now() - DAY_MS).length,
      ongoing: events.filter((i) => i.active).length,
    };
  }, [items]);

  // Newspapers can be switched on and off in the backend, so list the ones actually in use
  const sources = useMemo(() => {
    const news = [...new Set(external.filter((e) => e.kind === 'news').map((e) => sourceName(e.source)))].sort();
    const all = ['Polisen', 'Trafikverket', 'Krisinformation.se (Myndigheten för civilt försvar)', 'Sveriges Radio (VMA)', ...(news.length ? news : ['SVT Nyheter'])];
    return `${all.slice(0, -1).join(', ')} och ${all[all.length - 1]}`;
  }, [external]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filter]);

  // Load the next page when the end of the list scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + PAGE_SIZE);
    }, { rootMargin: '800px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visible.length]);

  const loading = (policeLoading || externalLoading) && items.length === 0;
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : '–';

  return (
    <div className="ca-dark flex h-[100dvh] flex-col">
      <Header />
      <main className="relative flex-1 overflow-y-auto">
        {/* Atmosphere, as on the landing page */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[460px] ca-gridlines"
          style={{ maskImage: 'linear-gradient(to bottom, black, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[min(900px,100%)] -translate-x-1/2 ca-breathe"
          style={{ background: 'radial-gradient(60% 70% at 50% 0%, hsl(var(--ca-red) / 0.18), transparent 70%)' }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-2xl px-4 pb-20">
          <section className="pb-6 pt-8 sm:pt-12">
            <p className="ca-eyebrow flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--ca-red))] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--ca-red))]" />
              </span>
              Live · Lägesbild Sverige
            </p>
            <h1 className="ca-display mt-3 text-5xl uppercase text-foreground sm:text-6xl">Flöde</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--ca-text-2))]">
              Polisens händelser, VMA, krisinformation, trafik och lokala nyheter. Allt som händer, samlat och senaste först.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <Stat icon={Activity} label="24 timmar" value={stats.lastDay} />
              <Stat icon={Radio} label="Pågående" value={stats.ongoing} />
              <Stat icon={Clock} label="Uppdaterad" value={updatedLabel} />
            </div>

            {!isPremium && (
              <p className="mt-4 rounded-xl border border-[hsl(var(--ca-line))] bg-card/60 px-3 py-2.5 text-xs leading-relaxed text-[hsl(var(--ca-text-2))] backdrop-blur">
                Polisens händelser visas med 15 minuters fördröjning.{' '}
                <Link to="/account" className="font-semibold text-primary hover:underline">Pro</Link> ger realtid och hela beskrivningar.
                VMA och krisinformation visas direkt för alla.
              </p>
            )}
          </section>

          <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-base)/0.8)] px-4 py-3 backdrop-blur-xl">
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:justify-between sm:px-0" role="tablist" aria-label="Filtrera flödet">
              {FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.value)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_20px_-6px_hsl(var(--ca-red))]'
                        : 'border-[hsl(var(--ca-line-strong))] bg-card/60 text-[hsl(var(--ca-text-2))] hover:text-foreground'
                    }`}
                  >
                    <span aria-hidden className="text-[11px]">{f.icon}</span>
                    {f.label}
                    {counts[f.value] > 0 && (
                      <span className={`tabular-nums text-[10px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{counts[f.value]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {policeError && police.length === 0 && (
            <p className="mb-4 rounded-xl border border-[hsl(var(--ca-line))] bg-card p-3 text-xs text-muted-foreground">
              Polisens händelser kunde inte hämtas just nu. Övriga källor visas nedan.
            </p>
          )}

          {loading ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--ca-line-strong))] px-6 py-16 text-center text-sm text-muted-foreground">
              {filter === 'mine' && !user ? (
                <><Link to="/auth" className="text-primary underline">Logga in</Link> och välj kommuner under Notiser för att se ditt område.</>
              ) : filter === 'mine' && kommuner.length === 0 ? (
                <>Du bevakar inga kommuner än. Lägg till under <Link to="/alerts" className="text-primary underline">Notiser</Link>.</>
              ) : 'Inga händelser just nu.'}
            </div>
          ) : (
            sections.map((section) => (
              <Fragment key={section.key}>
                <h2 className={`ca-meta mb-3 mt-8 flex items-center gap-3 first:mt-0 ${section.key === 'pinned' ? '!text-[hsl(var(--ca-red))]' : ''}`}>
                  {section.label}
                  <span className="h-px flex-1 bg-[hsl(var(--ca-line-strong))]" />
                </h2>
                <div className="space-y-4">
                  {section.items.map((item) => (
                    <FeedCard
                      key={item.id}
                      item={item}
                      engagement={engagement[item.id]}
                      onToggleReaction={toggleReaction}
                      onCommentCount={setCommentCount}
                    />
                  ))}
                </div>
              </Fragment>
            ))
          )}

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-[hsl(var(--ca-line-strong))] bg-card px-5 py-2 text-xs text-[hsl(var(--ca-text-2))] transition hover:text-foreground"
              >
                Visa fler
              </button>
            </div>
          )}

          <footer className="mt-10 border-t border-[hsl(var(--ca-line))] pt-5 text-[11px] leading-relaxed text-muted-foreground">
            Källor: {sources}. Nyheter visas med rubrik och länk till originalartikeln. Platser är ungefärliga.
            Kartbilder: Esri, HERE, Garmin, © OpenStreetMap-bidragsgivare.
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Feed;
