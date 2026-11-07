import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Construction, Eye, Layers, Lock, MapPin, Megaphone, MessageCircle, Newspaper, Shield, type LucideIcon } from 'lucide-react';
import CommentThread from '@/components/feed/CommentThread';
import ShareButton from '@/components/ShareButton';
import { incidentTypeConfig } from '@/data/mockIncidents';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useEngagementCounts, type Engagement } from '@/hooks/useEngagementCounts';
import { useExternalEvents } from '@/hooks/useExternalEvents';
import { REACTION_TYPES } from '@/hooks/useIncidentReactions';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePoliceEvents } from '@/hooks/usePoliceEvents';
import { useSEO } from '@/hooks/useSEO';
import { useTrafikverketEvents } from '@/hooks/useTrafikverketEvents';
import { sourceName } from '@/lib/externalEvents';
import { buildFeed, filterFeed, type FeedItem } from '@/lib/feed';
import { TILE_SIZE, tilesAround, tileUrl } from '@/lib/mapTiles';
import { canSellPro } from '@/lib/native';
import { formatTimeAgo } from '@/lib/timeAgo';
import { incidentTypeIcon } from '@/lib/typeIcons';
import { watchedKommunFor } from '../../supabase/functions/_shared/notifications';
import { Screen } from './ui';

const PAGE = 25;
const HOUR = 60 * 60 * 1000;
const MUTED = 'text-[rgba(235,235,245,0.6)]';

const KIND: Record<FeedItem['kind'], { icon: LucideIcon; color: string }> = {
  police: { icon: Shield, color: incidentTypeConfig.police.color },
  community: { icon: Eye, color: '#f97316' },
  traffic: { icon: Construction, color: 'hsl(42, 92%, 50%)' },
  vma: { icon: Megaphone, color: '#ff453a' },
  crisis: { icon: Megaphone, color: incidentTypeConfig.crisis.color },
  news: { icon: Newspaper, color: '#5e5ce6' },
};

/** The post's own icon and colour: the kind of police event, or the kind of post */
const lookOf = (item: FeedItem) => item.kind === 'police' || item.kind === 'traffic'
  ? { icon: incidentTypeIcon(item.incidentType), color: incidentTypeConfig[item.incidentType ?? 'other']?.color ?? KIND[item.kind].color }
  : KIND[item.kind];

/** Police titles are "Inbrott, Malmö": the kind of event, without the place the header already says */
const headline = (item: FeedItem) => (item.kind === 'police' ? item.title.split(',')[0].trim() : item.title);

// ---- Story circles: one tap picks what the feed shows ----

type Story = { id: string; label: string; icon: LucideIcon; match: (item: FeedItem) => boolean };

const StoryCircle = ({ story, selected, fresh, onPick }: { story: Story; selected: boolean; fresh: boolean; onPick: () => void }) => {
  const Icon = story.icon;
  return (
    <button type="button" onClick={onPick} className="flex w-[70px] shrink-0 flex-col items-center gap-1.5 active:opacity-70" aria-pressed={selected}>
      <span className="rounded-full p-[2.5px]"
        style={{ background: fresh ? 'linear-gradient(45deg, #ffd60a, #ff9f0a 35%, #ff453a 65%, #bf5af2)' : selected ? '#fff' : 'rgba(118,118,128,0.4)' }}>
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-[3px] border-black bg-[#1c1c1e]">
          <Icon className={`h-6 w-6 ${selected ? 'text-white' : 'text-[rgba(235,235,245,0.75)]'}`} strokeWidth={1.8} aria-hidden />
        </span>
      </span>
      <span className={`w-full truncate text-center text-[12px] ${selected ? 'font-semibold text-white' : MUTED}`}>{story.label}</span>
    </button>
  );
};

// ---- The picture of a post ----

const ZOOM = 11;

const MapPicture = ({ lat, lng, color }: { lat: number; lng: number; color: string }) => {
  const tiles = useMemo(() => tilesAround(lat, lng, ZOOM, 220, 170), [lat, lng]);
  return (
    <>
      <div className="absolute left-1/2 top-1/2" aria-hidden>
        {tiles.map((t) => (
          <img key={t.key} src={tileUrl(t.x, t.y, ZOOM, false)} alt="" width={TILE_SIZE} height={TILE_SIZE} loading="lazy" decoding="async" draggable={false}
            className="absolute max-w-none select-none" style={{ left: t.dx, top: t.dy }} />
        ))}
      </div>
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <span className="absolute -inset-16 rounded-full opacity-25" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
        <span className="absolute -inset-3 animate-ping rounded-full opacity-40" style={{ background: color }} />
        <span className="relative block h-4 w-4 rounded-full ring-[3px] ring-white" style={{ background: color }} />
      </div>
    </>
  );
};

const Art = ({ icon: Icon, color }: { icon: LucideIcon; color: string }) => (
  <div className="absolute inset-0" style={{ background: `radial-gradient(90% 90% at 70% 20%, ${color}, #111 75%)` }} aria-hidden>
    <Icon className="absolute right-6 top-6 h-24 w-24 text-white/15" strokeWidth={1.2} />
  </div>
);

const Picture = ({ item, icon: Icon, color }: { item: FeedItem; icon: LucideIcon; color: string }) => {
  const [failed, setFailed] = useState(false);
  const image = item.image && !failed ? item.image : null;
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#111]">
      {image ? (
        <img src={image.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover" />
      ) : item.lat !== null && item.lng !== null ? (
        <MapPicture lat={item.lat} lng={item.lng} color={color} />
      ) : (
        <Art icon={Icon} color={color} />
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" aria-hidden />
      {item.active && item.kind !== 'news' && (
        <span className="absolute left-3 top-3 rounded-[5px] bg-[#ff453a] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Pågår</span>
      )}
      <div className="absolute inset-x-4 bottom-3.5 flex items-end gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: color }}>
          <Icon className="h-5 w-5 text-white" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="min-w-0 pb-0.5 text-[22px] font-bold leading-[26px] tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] line-clamp-2">
          {headline(item)}
        </span>
      </div>
      {image?.credit && <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">Foto: {image.credit}</span>}
    </div>
  );
};

// ---- One post ----

interface PostProps {
  item: FeedItem;
  engagement?: Engagement;
  signedIn: boolean;
  onReact: (id: string, type: string) => void;
  onCommentCount: (id: string, count: number) => void;
}

const ActionButton = ({ onClick, label, pressed, children }: { onClick: () => void; label: string; pressed?: boolean; children: ReactNode }) => (
  <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="flex h-10 min-w-[40px] items-center justify-center gap-1 rounded-full px-1.5 active:scale-90 transition-transform">
    {children}
  </button>
);

const Post = memo(({ item, engagement, signedIn, onReact, onCommentCount }: PostProps) => {
  const navigate = useNavigate();
  const { icon, color } = lookOf(item);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const reactions = engagement?.reactions ?? [];
  const total = reactions.reduce((s, r) => s + r.count, 0);
  const comments = engagement?.commentCount ?? 0;
  const handleCount = useCallback((n: number) => onCommentCount(item.id, n), [item.id, onCommentCount]);
  const open = () => {
    if (item.kind === 'police') navigate(`/handelse/${encodeURIComponent(item.id)}`);
    else if (item.mapLink) navigate(item.mapLink);
    else if (item.url) window.open(item.url, '_blank');
  };
  const KindIcon = KIND[item.kind].icon;
  const long = item.body.length > 110;

  return (
    <article className="border-b border-[rgba(84,84,88,0.45)] pb-3">
      <header className="flex items-center gap-3 px-4 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${KIND[item.kind].color}` }}>
          <KindIcon className="h-[18px] w-[18px] text-white" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-semibold text-white">{item.source}</span>
          <span className={`block truncate text-[13px] ${MUTED}`}>{item.area}</span>
        </span>
        <span className={`shrink-0 text-[13px] ${MUTED}`}>{formatTimeAgo(item.time)}</span>
      </header>

      <button type="button" onClick={open} className="block w-full text-left active:opacity-90" aria-label={`Öppna ${headline(item)}`}>
        <Picture item={item} icon={icon} color={color} />
      </button>

      <div className="flex items-center px-2.5 pt-1.5">
        {REACTION_TYPES.map((r) => {
          const mine = reactions.find((x) => x.type === r.type);
          return (
            <ActionButton key={r.type} label={`Reagera med ${r.emoji}`} pressed={!!mine?.userReacted}
              onClick={() => (signedIn ? onReact(item.id, r.type) : navigate('/auth'))}>
              <span className={`text-[22px] leading-none transition ${mine?.userReacted ? 'scale-110' : 'opacity-90 grayscale-[35%]'}`} aria-hidden>{r.emoji}</span>
              {!!mine?.count && <span className="text-[13px] font-semibold tabular-nums text-white">{mine.count}</span>}
            </ActionButton>
          );
        })}
        <ActionButton label="Kommentarer" pressed={commentsOpen} onClick={() => setCommentsOpen((v) => !v)}>
          <MessageCircle className="h-[24px] w-[24px] text-white" strokeWidth={1.9} aria-hidden />
          {comments > 0 && <span className="text-[13px] font-semibold tabular-nums text-white">{comments}</span>}
        </ActionButton>
        {item.kind === 'police' && (
          <ShareButton event={item} compact className="flex h-10 min-w-[40px] items-center justify-center rounded-full px-1.5 text-white [&_svg]:h-[22px] [&_svg]:w-[22px]" />
        )}
        {item.mapLink && (
          <Link to={item.mapLink} aria-label="Visa på kartan" className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-white active:scale-90 transition-transform">
            <MapPin className="h-[24px] w-[24px]" strokeWidth={1.9} aria-hidden />
          </Link>
        )}
      </div>

      <div className="px-4">
        {total > 0 && <p className="text-[14px] font-semibold text-white">{total} {total === 1 ? 'reaktion' : 'reaktioner'}</p>}
        <p className="mt-0.5 text-[15px] leading-[20px] text-white">
          <span className="font-semibold">{item.title}</span>
          {item.body && (
            <span className="text-[rgba(235,235,245,0.85)]">
              {' '}{long && !expanded ? `${item.body.slice(0, 110).trimEnd()}… ` : `${item.body} `}
              {long && !expanded && <button type="button" onClick={() => setExpanded(true)} className={MUTED}>mer</button>}
            </span>
          )}
        </p>
        {item.bodyLocked && (
          <p className={`mt-1 flex items-center gap-1.5 text-[14px] ${MUTED}`}>
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Polisens beskrivning finns med Pro{canSellPro() && <>{' · '}<Link to="/prisplan" className="font-semibold text-[#ff453a]">Prova</Link></>}
          </p>
        )}
        {item.related.length > 0 && (
          <div className="mt-2 space-y-1">
            {item.related.map((news) => (
              <a key={news.id} href={news.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-[14px] leading-snug">
                <Newspaper className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5e5ce6]" aria-hidden />
                <span><span className="font-semibold text-white">{sourceName(news.source)}</span> <span className="text-[rgba(235,235,245,0.85)]">{news.title}</span></span>
              </a>
            ))}
          </div>
        )}
        {comments > 0 && !commentsOpen && (
          <button type="button" onClick={() => setCommentsOpen(true)} className={`mt-1 block text-[14px] ${MUTED}`}>
            {comments === 1 ? 'Visa kommentaren' : `Visa alla ${comments} kommentarer`}
          </button>
        )}
        {commentsOpen && (signedIn
          ? <div className="ca-dark mt-1"><CommentThread itemId={item.id} onCountChange={handleCount} /></div>
          : <p className={`mt-2 text-[14px] ${MUTED}`}><Link to="/auth" className="font-semibold text-[#0a84ff]">Logga in</Link> för att läsa och skriva kommentarer.</p>)}
      </div>
    </article>
  );
});
Post.displayName = 'Post';

/** Flöde in the iPhone app: everything that happens, as posts in the Instagram way. */
const NativeFeed = () => {
  useSEO({ title: 'Flöde | CrimeAlert', description: 'Det senaste som händer.', noindex: true });
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { incidents: police, loading } = usePoliceEvents();
  const { incidents: traffic } = useTrafikverketEvents();
  const { events: external } = useExternalEvents();
  const { reports: community } = useCommunityReports(isPremium);
  const { kommuner } = useNotificationPreferences();
  const [storyId, setStoryId] = useState('all');
  const [count, setCount] = useState(PAGE);

  const items = useMemo(() => buildFeed({ police, traffic, community, external, isPremium }), [police, traffic, community, external, isPremium]);

  const stories = useMemo<Story[]>(() => [
    { id: 'all', label: 'Allt', icon: Layers, match: () => true },
    ...kommuner.map((k) => ({ id: `k:${k}`, label: k, icon: MapPin, match: (i: FeedItem) => !!watchedKommunFor(i.area, [k]) })),
    { id: 'police', label: 'Polisen', icon: Shield, match: (i: FeedItem) => filterFeed([i], 'police').length > 0 },
    { id: 'crisis', label: 'VMA', icon: Megaphone, match: (i: FeedItem) => filterFeed([i], 'crisis').length > 0 },
    { id: 'traffic', label: 'Trafik', icon: Construction, match: (i: FeedItem) => i.kind === 'traffic' },
    { id: 'news', label: 'Nyheter', icon: Newspaper, match: (i: FeedItem) => filterFeed([i], 'news').length > 0 },
  ], [kommuner]);

  const story = stories.find((s) => s.id === storyId) ?? stories[0];
  const filtered = useMemo(() => items.filter(story.match), [items, story]);
  const shown = filtered.slice(0, count);
  const ids = useMemo(() => shown.map((i) => i.id), [shown]);
  const { engagement, toggleReaction, setCommentCount } = useEngagementCounts(ids);
  const hourAgo = Date.now() - HOUR;

  return (
    <Screen title="Flöde">
      <div className="flex gap-1 overflow-x-auto px-3 pb-3 pt-1 [scrollbar-width:none]">
        {stories.map((s) => (
          <StoryCircle key={s.id} story={s} selected={s.id === story.id}
            fresh={s.id !== 'all' && items.some((i) => i.timestamp > hourAgo && s.match(i))}
            onPick={() => { setStoryId(s.id); setCount(PAGE); window.dispatchEvent(new Event('ca-tab-top')); }} />
        ))}
      </div>
      <div className="border-t border-[rgba(84,84,88,0.45)]" />

      {!isPremium && (
        <p className={`mx-4 mt-2.5 text-[13px] ${MUTED}`}>Polisens händelser visas 15 minuter efter att de rapporterats. Med Pro direkt.</p>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-3 space-y-6" aria-label="Laddar flödet">
          {[0, 1].map((n) => (
            <div key={n}>
              <div className="flex items-center gap-3 px-4 py-2.5"><span className="h-9 w-9 animate-pulse rounded-full bg-[#1c1c1e]" /><span className="h-3 w-32 animate-pulse rounded bg-[#1c1c1e]" /></div>
              <div className="aspect-[4/3] w-full animate-pulse bg-[#1c1c1e]" />
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <p className={`mt-16 px-8 text-center text-[15px] ${MUTED}`}>Inget här just nu.</p>
      ) : (
        <div className="mt-1">
          {shown.map((item) => (
            <Post key={item.id} item={item} engagement={engagement[item.id]} signedIn={!!user} onReact={toggleReaction} onCommentCount={setCommentCount} />
          ))}
        </div>
      )}
      {count < filtered.length && (
        <button type="button" onClick={() => setCount((c) => c + PAGE)} className="mx-auto mt-5 block h-11 rounded-full bg-[#1c1c1e] px-6 text-[15px] font-semibold text-white active:opacity-70">
          Visa fler
        </button>
      )}
    </Screen>
  );
};

export default NativeFeed;
