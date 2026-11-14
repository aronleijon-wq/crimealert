import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Construction, Eye, Lock, Megaphone, MessageCircle, MessagesSquare, Newspaper, Send, Shield, SmilePlus, type LucideIcon } from 'lucide-react';
import CommentThread from '@/components/feed/CommentThread';
import ShareCardButton from '@/components/ShareCardButton';
import SituationCard from '@/components/SituationCard';
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
import { eventUrl } from '@/lib/share';
import { cardTime, drawEventCard } from '@/lib/shareCard';
import { formatTimeAgo } from '@/lib/timeAgo';
import { incidentTypeIcon } from '@/lib/typeIcons';
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

// ---- Filters: one tap picks what the feed shows ----

type Story = { id: string; label: string; match: (item: FeedItem) => boolean };

const Chip = ({ story, selected, fresh, onPick }: { story: Story; selected: boolean; fresh: boolean; onPick: () => void }) => (
  <button
    type="button"
    onClick={onPick}
    aria-pressed={selected}
    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] transition-colors active:opacity-70 ${selected ? 'bg-white font-semibold text-black' : 'bg-[#1c1c1e] text-white'}`}
  >
    {story.label}
    {fresh && <span className="h-1.5 w-1.5 rounded-full bg-[#ff453a]" aria-label="Nytt senaste timmen" />}
  </button>
);

// ---- The small picture beside a post ----

const ZOOM = 11;
const THUMB = 76;

const MapThumb = ({ lat, lng, color }: { lat: number; lng: number; color: string }) => {
  const tiles = useMemo(() => tilesAround(lat, lng, ZOOM, THUMB / 2, THUMB / 2), [lat, lng]);
  return (
    <>
      <div className="absolute left-1/2 top-1/2" aria-hidden>
        {tiles.map((t) => (
          <img key={t.key} src={tileUrl(t.x, t.y, ZOOM, false)} alt="" width={TILE_SIZE} height={TILE_SIZE} loading="lazy" decoding="async" draggable={false}
            className="absolute max-w-none select-none" style={{ left: t.dx, top: t.dy }} />
        ))}
      </div>
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ background: color }} aria-hidden />
    </>
  );
};

/** The news photo, or the place on the map; nothing when there is neither */
const Thumb = ({ item, color }: { item: FeedItem; color: string }) => {
  const [failed, setFailed] = useState(false);
  const image = item.image && !failed ? item.image : null;
  if (!image && (item.lat === null || item.lng === null)) return null;
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-[10px] bg-[#1c1c1e]" style={{ width: THUMB, height: THUMB }}>
      {image
        ? <img src={image.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        : <MapThumb lat={item.lat!} lng={item.lng!} color={color} />}
    </span>
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

const action = 'flex h-9 items-center gap-1.5 pr-4 text-[13px] text-[rgba(235,235,245,0.6)] active:opacity-50';
const ACTION_ICON = 'h-[18px] w-[18px]';

/** "12 min", "3 tim": the time ago, short, as a list of news writes it */
const shortAgo = (time: string) => formatTimeAgo(time).replace(/ sedan$/, '');

const Post = memo(({ item, engagement, signedIn, onReact, onCommentCount }: PostProps) => {
  const navigate = useNavigate();
  const { icon: Icon, color } = lookOf(item);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const reactions = engagement?.reactions ?? [];
  const total = reactions.reduce((s, r) => s + r.count, 0);
  const mine = reactions.find((r) => r.userReacted);
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
  const where = item.kind === 'news' ? item.source : item.area || item.source;
  const news = item.related[0];

  return (
    <article className="ca-feed-post px-4 pt-3.5">
      <button type="button" onClick={open} className="flex w-full items-start gap-3 text-left active:opacity-70" aria-label={`Öppna ${headline(item)}`}>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center gap-1.5 text-[13px] ${MUTED}`}>
            <Icon className="h-[15px] w-[15px] shrink-0" style={{ color }} strokeWidth={2} aria-hidden />
            <span className="truncate">{where}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{shortAgo(item.time)}</span>
            {item.active && item.kind !== 'news' && (
              <span className="flex shrink-0 items-center gap-1 font-medium text-[#ff453a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff453a]" aria-hidden />Pågår
              </span>
            )}
          </span>
          <span className="mt-1 block text-[17px] font-semibold leading-[22px] text-white">{headline(item)}</span>
          {item.body && <span className={`mt-0.5 line-clamp-2 block text-[15px] leading-[20px] ${MUTED}`}>{item.body}</span>}
          {item.bodyLocked && (
            <span className={`mt-1 flex items-center gap-1.5 text-[13px] ${MUTED}`}>
              <Lock className="h-3 w-3 shrink-0" aria-hidden />Hela beskrivningen med Pro
            </span>
          )}
        </span>
        <Thumb item={item} color={color} />
      </button>

      {news && (
        <a href={news.url ?? undefined} target="_blank" rel="noopener noreferrer" className={`mt-1.5 flex items-center gap-1.5 text-[13px] ${MUTED}`}>
          <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate"><span className="font-semibold text-[rgba(235,235,245,0.85)]">{sourceName(news.source)}:</span> {news.title}</span>
        </a>
      )}

      <div className="relative mt-1 flex items-center">
        <button type="button" onClick={() => setPicking((v) => !v)} aria-label="Reagera" aria-expanded={picking} className={action}>
          {mine
            ? <span className="text-[17px] leading-none" aria-hidden>{REACTION_TYPES.find((r) => r.type === mine.type)?.emoji}</span>
            : <SmilePlus className={ACTION_ICON} strokeWidth={1.8} aria-hidden />}
          {total > 0 && <span>{total}</span>}
        </button>
        <button type="button" onClick={() => setCommentsOpen((v) => !v)} aria-label="Kommentarer" aria-pressed={commentsOpen} className={action}>
          <MessageCircle className={ACTION_ICON} strokeWidth={1.8} aria-hidden />
          {comments > 0 && <span>{comments}</span>}
        </button>
        {item.kind === 'police' && (
          <ShareCardButton
            make={() => drawEventCard({ id: item.id, kind: headline(item), area: item.area, when: cardTime(item.timestamp), active: item.active, color })}
            title={item.title}
            text={`${item.title} – på CrimeAlert`}
            url={eventUrl(item.id)}
            fileName="crimealert.png"
            label="Dela som bild"
            className={action}
          >
            <Send className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden />
          </ShareCardButton>
        )}
        {picking && (
          <div className="absolute -top-12 left-0 z-10 flex gap-1 rounded-full bg-[#2c2c2e] px-2 py-1" role="menu">
            {REACTION_TYPES.map((r) => (
              <button key={r.type} type="button" role="menuitem" onClick={() => react(r.type)} aria-label={`Reagera med ${r.emoji}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-[26px] transition-transform active:scale-125 ${mine?.type === r.type ? 'bg-white/15' : ''}`}>
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {commentsOpen && (
        <div className="pb-2">
          {signedIn
            ? <div className="ca-dark"><CommentThread itemId={item.id} onCountChange={handleCount} /></div>
            : <p className={`text-[14px] ${MUTED}`}><Link to="/auth" className="font-semibold text-[#0a84ff]">Logga in</Link> för att läsa och skriva kommentarer.</p>}
        </div>
      )}
      <div className="mt-1.5 border-b border-[rgba(84,84,88,0.45)]" />
    </article>
  );
});
Post.displayName = 'Post';

/** Flöde in the iPhone app: everything that happens, newest first, as a calm list of news. */
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
    { id: 'all', label: 'Allt', match: () => true },
    ...kommuner.map((k) => ({ id: `k:${k}`, label: k, match: (i: FeedItem) => !!watchedKommunFor(i.area, [k]) })),
    { id: 'police', label: 'Polisen', match: (i: FeedItem) => filterFeed([i], 'police').length > 0 },
    { id: 'crisis', label: 'VMA', match: (i: FeedItem) => filterFeed([i], 'crisis').length > 0 },
    { id: 'traffic', label: 'Trafik', match: (i: FeedItem) => i.kind === 'traffic' },
    { id: 'news', label: 'Nyheter', match: (i: FeedItem) => filterFeed([i], 'news').length > 0 },
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
        <Link to="/chattar" aria-label="Chattar" className="-mr-2 flex h-10 w-10 items-center justify-center text-[#ff453a] active:opacity-50">
          <MessagesSquare className="h-[25px] w-[25px]" strokeWidth={1.8} aria-hidden />
        </Link>
      )}
    >
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s) => (
          <Chip key={s.id} story={s} selected={s.id === story.id}
            fresh={s.id !== 'all' && items.some((i) => i.timestamp > hourAgo && s.match(i))}
            onPick={() => { setStoryId(s.id); setCount(PAGE); window.dispatchEvent(new Event('ca-tab-top')); }} />
        ))}
      </div>
      <div className="border-t border-[rgba(84,84,88,0.45)]" />

      {story.id.startsWith('k:') && (
        <Link to={chatPath(story.label)} className="mx-4 mt-3 flex items-center gap-3 rounded-[14px] bg-[#1c1c1e] px-4 py-3 active:opacity-70">
          <MessagesSquare className="h-[22px] w-[22px] shrink-0 text-[#ff453a]" strokeWidth={1.8} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-white">Prata om {story.label}</span>
            <span className={`block text-[13px] ${MUTED}`}>Kommunens diskussion: fråga, tipsa, berätta vad du såg</span>
          </span>
          <ChevronRight className="h-5 w-5 text-[rgba(235,235,245,0.3)]" aria-hidden />
        </Link>
      )}
      {story.id.startsWith('k:') && <SituationCard kommun={story.label} className="mx-4 mt-3" />}

      {!isPremium && (
        <p className={`mx-4 mt-2.5 text-[13px] ${MUTED}`}>Polisens händelser visas 15 minuter efter att de rapporterats. Med Pro direkt.</p>
      )}

      {loading && items.length === 0 ? (
        <div className="mt-2" aria-label="Laddar flödet">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="flex gap-3 border-b border-[rgba(84,84,88,0.45)] px-4 py-4">
              <span className="flex-1 space-y-2">
                <span className="block h-3 w-28 animate-pulse rounded bg-[#1c1c1e]" />
                <span className="block h-4 w-44 animate-pulse rounded bg-[#1c1c1e]" />
                <span className="block h-3 w-full animate-pulse rounded bg-[#1c1c1e]" />
              </span>
              <span className="h-[76px] w-[76px] animate-pulse rounded-[10px] bg-[#1c1c1e]" />
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
