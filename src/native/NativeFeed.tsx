import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Construction, Eye, Layers, Lock, MapPin, Megaphone, MessageCircle, MessagesSquare, Newspaper, Send, Shield, SmilePlus, type LucideIcon } from 'lucide-react';
import CommentThread from '@/components/feed/CommentThread';
import ShareCardButton from '@/components/ShareCardButton';
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
import { eventUrl } from '@/lib/share';
import { cardTime, drawEventCard } from '@/lib/shareCard';
import { formatTimeAgo } from '@/lib/timeAgo';
import { incidentTypeIcon } from '@/lib/typeIcons';
import { kommunPath } from '@/lib/kommunPages';
import { chatPath } from './chats';
import FeedNudge from './FeedNudge';
import { pickNudge, readNudges, usageDays } from './nudges';
import { watchedKommunFor } from '../../supabase/functions/_shared/notifications';
import { Screen } from './ui';

const PAGE = 25;
/** The card about free Pro or feedback, after this many posts */
const NUDGE_AFTER = 4;
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
  <div className="absolute inset-0" style={{ background: `radial-gradient(100% 80% at 75% 15%, ${color}, #0b0b0c 72%)` }} aria-hidden>
    <Icon className="absolute right-7 top-7 h-20 w-20 text-white/15" strokeWidth={1.2} />
  </div>
);

/** The post's square picture: the news photo, the place on the map, or the kind's colour */
const Picture = ({ item, icon, color }: { item: FeedItem; icon: LucideIcon; color: string }) => {
  const [failed, setFailed] = useState(false);
  const image = item.image && !failed ? item.image : null;
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-[#111]">
      {image ? (
        <img src={image.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover" />
      ) : item.lat !== null && item.lng !== null ? (
        <MapPicture lat={item.lat} lng={item.lng} color={color} />
      ) : (
        <Art icon={icon} color={color} />
      )}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
      {item.active && item.kind !== 'news' && (
        <span className="absolute left-3 top-3 rounded-md bg-[#ff453a] px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide text-white">Pågår</span>
      )}
      <span className="absolute inset-x-4 bottom-3.5 text-[24px] font-bold leading-[28px] tracking-tight text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.45)] line-clamp-2">
        {headline(item)}
      </span>
      {image?.credit && <span className="absolute bottom-1.5 right-2 text-[10px] text-white/60">Foto: {image.credit}</span>}
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

const ICON = 'h-[26px] w-[26px] text-white';
const iconButton = 'flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90';

const Post = memo(({ item, engagement, signedIn, onReact, onCommentCount }: PostProps) => {
  const navigate = useNavigate();
  const { icon, color } = lookOf(item);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const reactions = engagement?.reactions ?? [];
  const total = reactions.reduce((s, r) => s + r.count, 0);
  const mine = reactions.find((r) => r.userReacted);
  const top = REACTION_TYPES.filter((r) => (reactions.find((x) => x.type === r.type)?.count ?? 0) > 0)
    .sort((a, b) => (reactions.find((x) => x.type === b.type)?.count ?? 0) - (reactions.find((x) => x.type === a.type)?.count ?? 0))
    .slice(0, 3);
  const comments = engagement?.commentCount ?? 0;
  const handleCount = useCallback((n: number) => onCommentCount(item.id, n), [item.id, onCommentCount]);
  const open = () => {
    if (item.kind === 'police') navigate(`/handelse/${encodeURIComponent(item.id)}`);
    else if (item.mapLink) navigate(item.mapLink);
    else if (item.url) window.open(item.url, '_blank');
  };
  const react = (type: string) => {
    setPicking(false);
    if (signedIn) onReact(item.id, type);
    else navigate('/auth');
  };
  const KindIcon = KIND[item.kind].icon;
  const text = [item.title, item.body].filter(Boolean).join(' · ');
  const long = text.length > 90;
  const news = item.related[0];

  return (
    <article className="pb-6">
      <header className="flex items-center gap-2.5 px-3 py-2">
        <span className="rounded-full p-[2px]" style={{ background: item.active ? 'linear-gradient(45deg, #ffd60a, #ff453a 60%, #bf5af2)' : 'transparent' }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black" style={{ background: KIND[item.kind].color }}>
            <KindIcon className="h-4 w-4 text-white" strokeWidth={2.2} aria-hidden />
          </span>
        </span>
        <span className="min-w-0 flex-1 leading-[17px]">
          <span className="block truncate text-[14px] font-semibold text-white">{item.source}</span>
          <span className="block truncate text-[12px] text-[rgba(235,235,245,0.7)]">{item.area}</span>
        </span>
      </header>

      <button type="button" onClick={open} className="block w-full text-left active:opacity-90" aria-label={`Öppna ${headline(item)}`}>
        <Picture item={item} icon={icon} color={color} />
      </button>

      <div className="relative flex items-center px-1.5">
        <button type="button" onClick={() => setPicking((v) => !v)} aria-label="Reagera" aria-expanded={picking} className={iconButton}>
          {mine
            ? <span className="text-[24px] leading-none" aria-hidden>{REACTION_TYPES.find((r) => r.type === mine.type)?.emoji}</span>
            : <SmilePlus className={ICON} strokeWidth={1.7} aria-hidden />}
        </button>
        <button type="button" onClick={() => setCommentsOpen((v) => !v)} aria-label="Kommentarer" aria-pressed={commentsOpen} className={iconButton}>
          <MessageCircle className={ICON} strokeWidth={1.7} aria-hidden />
        </button>
        {item.kind === 'police' && (
          <ShareCardButton
            make={() => drawEventCard({ id: item.id, kind: headline(item), area: item.area, when: cardTime(item.timestamp), active: item.active, color })}
            title={item.title}
            text={`${item.title} – på CrimeAlert`}
            url={eventUrl(item.id)}
            fileName="crimealert.png"
            label="Dela som bild"
            className={iconButton}
          >
            <Send className="h-[24px] w-[24px] text-white" strokeWidth={1.7} aria-hidden />
          </ShareCardButton>
        )}
        {item.mapLink && (
          <Link to={item.mapLink} aria-label="Visa på kartan" className={`${iconButton} ml-auto`}>
            <MapPin className={ICON} strokeWidth={1.7} aria-hidden />
          </Link>
        )}
        {picking && (
          <div className="absolute -top-12 left-2 z-10 flex gap-1 rounded-full bg-[#2c2c2e] px-2 py-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]" role="menu">
            {REACTION_TYPES.map((r) => (
              <button key={r.type} type="button" role="menuitem" onClick={() => react(r.type)} aria-label={`Reagera med ${r.emoji}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-[26px] transition-transform active:scale-125 ${mine?.type === r.type ? 'bg-white/15' : ''}`}>
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1 px-3.5">
        {total > 0 && (
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-white">
            <span className="text-[14px] tracking-[-0.15em]" aria-hidden>{top.map((r) => r.emoji).join('')}</span>
            {total} {total === 1 ? 'reaktion' : 'reaktioner'}
          </p>
        )}
        <p className={`text-[14px] leading-[19px] text-white ${long && !expanded ? 'line-clamp-2' : ''}`}>
          <span className="font-semibold">{item.source}</span>{' '}
          <span className="text-[rgba(255,255,255,0.88)]">{text}</span>
        </p>
        {long && !expanded && (
          <button type="button" onClick={() => setExpanded(true)} className="text-[14px] text-[rgba(235,235,245,0.6)]">mer</button>
        )}
        {item.bodyLocked && (
          <p className="flex items-center gap-1.5 text-[13px] text-[rgba(235,235,245,0.6)]">
            <Lock className="h-3 w-3" aria-hidden />
            Hela beskrivningen med Pro{canSellPro() && <>{' · '}<Link to="/prisplan" className="font-semibold text-[#ff453a]">Prova</Link></>}
          </p>
        )}
        {news && (
          <a href={news.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13px] text-[rgba(235,235,245,0.6)]">
            <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate"><span className="font-semibold text-[rgba(235,235,245,0.85)]">{sourceName(news.source)}:</span> {news.title}</span>
          </a>
        )}
        {comments > 0 && !commentsOpen && (
          <button type="button" onClick={() => setCommentsOpen(true)} className="block text-[14px] text-[rgba(235,235,245,0.6)]">
            {comments === 1 ? 'Visa kommentaren' : `Visa alla ${comments} kommentarer`}
          </button>
        )}
        {commentsOpen && (signedIn
          ? <div className="ca-dark"><CommentThread itemId={item.id} onCountChange={handleCount} /></div>
          : <p className="text-[14px] text-[rgba(235,235,245,0.6)]"><Link to="/auth" className="font-semibold text-[#0a84ff]">Logga in</Link> för att läsa och skriva kommentarer.</p>)}
        <p className="pt-0.5 text-[11px] uppercase tracking-[0.04em] text-[rgba(235,235,245,0.45)]">{formatTimeAgo(item.time)}</p>
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
  // Decided once per visit to Flöde, so a card doesn't come and go while scrolling
  const [nudge, setNudge] = useState(() => pickNudge({ days: usageDays(), isPremium, state: readNudges(), now: Date.now() }));

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
    <Screen
      title="Flöde"
      action={(
        <Link to="/chattar" aria-label="Chattar" className="flex h-10 items-center gap-1.5 rounded-full bg-[#1c1c1e] px-3.5 text-[15px] font-semibold text-white active:opacity-60">
          <MessagesSquare className="h-[18px] w-[18px] text-[#ff453a]" aria-hidden /> Chattar
        </Link>
      )}
    >
      <div className="flex gap-1 overflow-x-auto px-3 pb-3 pt-1 [scrollbar-width:none]">
        {stories.map((s) => (
          <StoryCircle key={s.id} story={s} selected={s.id === story.id}
            fresh={s.id !== 'all' && items.some((i) => i.timestamp > hourAgo && s.match(i))}
            onPick={() => { setStoryId(s.id); setCount(PAGE); window.dispatchEvent(new Event('ca-tab-top')); }} />
        ))}
      </div>
      <div className="border-t border-[rgba(84,84,88,0.45)]" />

      {story.id.startsWith('k:') && (
        <Link to={chatPath(story.label)} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-[#1c1c1e] px-4 py-3 active:opacity-70">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff453a]/15 text-[#ff453a]">
            <MessagesSquare className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-white">Prata om {story.label}</span>
            <span className={`block text-[13px] ${MUTED}`}>Kommunens diskussion: fråga, tipsa, berätta vad du såg</span>
          </span>
          <ChevronRight className="h-5 w-5 text-[rgba(235,235,245,0.3)]" aria-hidden />
        </Link>
      )}

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
          {shown.map((item, i) => (
            <Fragment key={item.id}>
              <Post item={item} engagement={engagement[item.id]} signedIn={!!user} onReact={toggleReaction} onCommentCount={setCommentCount} />
              {i === Math.min(NUDGE_AFTER, shown.length) - 1 && nudge && !(nudge === 'invite' && isPremium) && (
                <FeedNudge nudge={nudge} onDone={() => setNudge(null)} />
              )}
            </Fragment>
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
