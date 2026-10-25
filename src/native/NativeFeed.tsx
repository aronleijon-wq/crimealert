import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Construction, Eye, Megaphone, Newspaper, type LucideIcon } from 'lucide-react';
import { incidentTypeConfig } from '@/data/mockIncidents';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useExternalEvents } from '@/hooks/useExternalEvents';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { useTrafikverketEvents } from '@/hooks/useTrafikverketEvents';
import { buildFeed, filterFeed, groupByDay, type FeedFilter, type FeedItem } from '@/lib/feed';
import { formatTimeAgo } from '@/lib/timeAgo';
import { incidentTypeIcon } from '@/lib/typeIcons';
import { Screen, Section, Segmented } from './ui';

const PAGE = 60;

const KIND_ICON: Partial<Record<FeedItem['kind'], { icon: LucideIcon; color: string }>> = {
  community: { icon: Eye, color: '#f97316' },
  traffic: { icon: Construction, color: 'hsl(42, 92%, 50%)' },
  vma: { icon: Megaphone, color: '#ff453a' },
  crisis: { icon: Megaphone, color: incidentTypeConfig.crisis.color },
  news: { icon: Newspaper, color: '#5e5ce6' },
};

const iconFor = (item: FeedItem) => KIND_ICON[item.kind] ?? {
  icon: incidentTypeIcon(item.incidentType),
  color: incidentTypeConfig[item.incidentType ?? 'other']?.color ?? '#8e8e93',
};

/** Flöde in the iPhone app: everything that happens, as a list in the iOS way. */
const NativeFeed = () => {
  useSEO({ title: 'Flöde | CrimeAlert', description: 'Det senaste som händer.', noindex: true });
  const navigate = useNavigate();
  const { isPremium } = useIsPremium();
  const { incidents: police, loading } = usePoliceEvents();
  const { incidents: traffic } = useTrafikverketEvents();
  const { events: external } = useExternalEvents();
  const { reports: community } = useCommunityReports(isPremium);
  const { kommuner } = useNotificationPreferences();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [count, setCount] = useState(PAGE);

  const items = useMemo(() => buildFeed({ police, traffic, community, external, isPremium }), [police, traffic, community, external, isPremium]);
  const filtered = useMemo(() => filterFeed(items, filter, kommuner), [items, filter, kommuner]);
  const sections = useMemo(() => groupByDay(filtered.slice(0, count)), [filtered, count]);

  const options: { value: FeedFilter; label: string }[] = [
    { value: 'all', label: 'Allt' },
    { value: 'police', label: 'Polisen' },
    { value: 'crisis', label: 'VMA' },
    { value: 'traffic', label: 'Trafik' },
    ...(kommuner.length ? [{ value: 'mine' as FeedFilter, label: 'Mina' }] : []),
  ];

  const open = (item: FeedItem) => {
    if (item.kind === 'police') navigate(`/handelse/${encodeURIComponent(item.id)}`);
    else if (item.mapLink) navigate(item.mapLink);
    else if (item.url) window.open(item.url, '_blank');
  };

  return (
    <Screen title="Flöde">
      <div className="sticky top-0 z-10 bg-black/90 pb-2 pt-1 backdrop-blur-xl">
        <Segmented options={options} value={filter} onChange={(v) => { setFilter(v); setCount(PAGE); }} />
      </div>
      {!isPremium && (
        <p className="mx-5 mt-2 text-[13px] text-[rgba(235,235,245,0.6)]">Polisens händelser visas 15 minuter efter att de rapporterats. Med Pro direkt.</p>
      )}
      {loading && items.length === 0 ? (
        <p className="mt-16 text-center text-[15px] text-[rgba(235,235,245,0.6)]">Hämtar det senaste…</p>
      ) : !filtered.length ? (
        <p className="mt-16 px-8 text-center text-[15px] text-[rgba(235,235,245,0.6)]">Inget här just nu.</p>
      ) : (
        sections.map((section) => (
          <Section key={section.key} header={section.label}>
            {section.items.map((item) => {
              const { icon: Icon, color } = iconFor(item);
              return (
                <button key={item.id} type="button" onClick={() => open(item)} className="ios-row flex w-full items-start gap-3 pl-4 text-left active:bg-[#2c2c2e]">
                  <span className="mt-3 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full" style={{ background: color }}>
                    <Icon className="h-4 w-4 text-white" strokeWidth={2.2} aria-hidden />
                  </span>
                  <span className="ios-row-body min-w-0 flex-1 py-2.5 pr-4">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-[21px] text-white">{item.title}</span>
                      <span className="shrink-0 text-[13px] text-[rgba(235,235,245,0.6)]">{formatTimeAgo(item.time)}</span>
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-[19px] text-[rgba(235,235,245,0.6)] line-clamp-2">
                      {item.area}{item.body && !item.bodyLocked ? ` · ${item.body}` : ''}
                    </span>
                    {item.active && item.kind !== 'news' && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#ff453a]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff453a]" /> Pågående
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </Section>
        ))
      )}
      {count < filtered.length && (
        <button type="button" onClick={() => setCount((c) => c + PAGE)} className="mx-auto mt-6 block text-[17px] text-[#ff453a]">Visa fler</button>
      )}
    </Screen>
  );
};

export default NativeFeed;
