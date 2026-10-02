import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
import { buildFeed, filterFeed, type FeedFilter } from '@/lib/feed';

const PAGE_SIZE = 20;

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Allt' },
  { value: 'police', label: 'Polisen' },
  { value: 'crisis', label: 'Kris & VMA' },
  { value: 'traffic', label: 'Trafik' },
  { value: 'news', label: 'Nyheter' },
  { value: 'mine', label: 'Mina kommuner' },
];

const Feed = () => {
  useSEO({
    title: 'Flöde — senaste händelserna i Sverige | CrimeAlert',
    description: 'Polisens händelser, VMA, krisinformation, trafikstörningar och lokala nyheter i ett flöde. Gilla och kommentera.',
    canonical: 'https://crimealert.se/flode',
  });
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { incidents: police, loading: policeLoading, error: policeError } = usePoliceEvents();
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
  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const { engagement, toggleReaction, setCommentCount } = useEngagementCounts(visibleIds);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => setVisibleCount(PAGE_SIZE), [filter]);

  // Load the next page when the end of the list scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + PAGE_SIZE);
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visible.length]);

  const loading = (policeLoading || externalLoading) && items.length === 0;
  // Newspapers can be switched on and off in the backend, so list the ones actually in use
  const sources = useMemo(() => {
    const news = [...new Set(external.filter((e) => e.kind === 'news').map((e) => sourceName(e.source)))].sort();
    const all = ['Polisen', 'Trafikverket', 'Krisinformation.se (Myndigheten för civilt försvar)', 'Sveriges Radio (VMA)', ...(news.length ? news : ['SVT Nyheter'])];
    return `${all.slice(0, -1).join(', ')} och ${all[all.length - 1]}`;
  }, [external]);

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Flöde</h1>
            <p className="text-xs text-muted-foreground">
              Polisens händelser, VMA, krisinformation, trafik och lokala nyheter. Senaste först.
            </p>
            {!isPremium && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Polisens händelser visas med 15 minuters fördröjning.{' '}
                <Link to="/account" className="text-primary underline">Pro</Link> ger realtid och hela beskrivningar.
                VMA och krisinformation visas direkt för alla.
              </p>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" role="tablist" aria-label="Filtrera flödet">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {policeError && police.length === 0 && (
            <p className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
              Polisens händelser kunde inte hämtas just nu. Övriga källor visas nedan.
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Hämtar händelser…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-xs text-muted-foreground">
              {filter === 'mine' && !user ? (
                <><Link to="/auth" className="text-primary underline">Logga in</Link> och välj kommuner under Notiser för att se ditt område.</>
              ) : filter === 'mine' && kommuner.length === 0 ? (
                <>Du bevakar inga kommuner än. Lägg till under <Link to="/alerts" className="text-primary underline">Notiser</Link>.</>
              ) : 'Inga händelser just nu.'}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  engagement={engagement[item.id]}
                  onToggleReaction={toggleReaction}
                  onCommentCount={setCommentCount}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Visa fler
              </button>
            </div>
          )}

          <footer className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            Källor: {sources}. Nyheter visas med rubrik och länk till originalartikeln.
            Platser är ungefärliga.
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Feed;
