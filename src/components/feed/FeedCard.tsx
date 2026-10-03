import { memo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock, MapPin, MessageCircle, Newspaper } from 'lucide-react';
import { incidentTypeConfig } from '@/data/mockIncidents';
import { useAuth } from '@/hooks/useAuth';
import type { Engagement } from '@/hooks/useEngagementCounts';
import ShareButton from '@/components/ShareButton';
import { REACTION_TYPES } from '@/hooks/useIncidentReactions';
import type { FeedItem } from '@/lib/feed';
import { sourceName } from '@/lib/externalEvents';
import { formatTimeAgo } from '@/lib/timeAgo';
import CommentThread from './CommentThread';
import MediaBanner from './MediaBanner';

const KINDS: Record<FeedItem['kind'], { label: string; icon: string; accent: string }> = {
  police: { label: 'Polisen', icon: '🛡️', accent: incidentTypeConfig.police.color },
  community: { label: 'Medborgarrapport', icon: '👁️', accent: '#f97316' },
  traffic: { label: 'Trafik', icon: '🚧', accent: 'hsl(42, 92%, 50%)' },
  vma: { label: 'VMA', icon: '📢', accent: 'hsl(0, 78%, 52%)' },
  crisis: { label: 'Kris', icon: '📢', accent: incidentTypeConfig.crisis.color },
  news: { label: 'Nyhet', icon: '📰', accent: 'hsl(205, 30%, 45%)' },
};

const POLICE_ICONS: Partial<Record<string, string>> = { fire: '🔥', ambulance: '🚑', traffic: '🚗', other: '⚠️' };

const SOURCE_BADGES: Record<string, string> = {
  Polisen: 'POL',
  Trafikverket: 'TRV',
  'Sveriges Radio (VMA)': 'SR',
  'Krisinformation.se': 'KRIS',
  'SVT Nyheter': 'SVT',
  'Svenska Dagbladet': 'SvD',
  Aftonbladet: 'AB',
  Expressen: 'EXP',
  Medborgarrapport: 'MED',
};

const sourceBadge = (source: string) =>
  SOURCE_BADGES[source] ?? source.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

interface FeedCardProps {
  item: FeedItem;
  engagement?: Engagement;
  onToggleReaction: (id: string, type: string) => void;
  onCommentCount: (id: string, count: number) => void;
}

const FeedCard = ({ item, engagement, onToggleReaction, onCommentCount }: FeedCardProps) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showLoginNudge, setShowLoginNudge] = useState(false);
  const handleCommentCount = useCallback((count: number) => onCommentCount(item.id, count), [item.id, onCommentCount]);

  const kind = item.kind === 'police' && item.incidentType
    ? {
      label: incidentTypeConfig[item.incidentType].label,
      icon: POLICE_ICONS[item.incidentType] ?? KINDS.police.icon,
      accent: incidentTypeConfig[item.incidentType].color,
    }
    : KINDS[item.kind];
  const isLongBody = item.body.length > 260;
  const isNews = item.kind === 'news';
  const totalReactions = engagement?.reactions.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return (
    <article
      aria-labelledby={`feed-title-${item.id}`}
      className={`group overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_hsl(var(--ca-line)),0_20px_40px_-24px_rgba(0,0,0,0.6)] transition-colors duration-300 ${
        item.pinned ? 'border-[hsl(var(--ca-red)/0.6)] ring-1 ring-[hsl(var(--ca-red)/0.35)]' : 'border-[hsl(var(--ca-line-strong))] hover:border-[hsl(var(--ca-steel)/0.35)]'
      }`}
    >
      <MediaBanner item={item} accent={kind.accent} icon={kind.icon} label={kind.label} />

      <div className="relative px-4 pb-4 pt-3 sm:px-5">
        {item.pinned && (
          <p className="ca-eyebrow mb-2">Viktigt meddelande till allmänheten</p>
        )}

        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-3))] ca-mono text-[8.5px] font-semibold tracking-tight text-[hsl(var(--ca-text-2))]"
            aria-hidden
          >
            {sourceBadge(item.source)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-foreground">{item.source}</p>
            <p className="ca-meta !text-[9px]">
              <time dateTime={item.time}>{formatTimeAgo(item.time)}</time>
            </p>
          </div>
          {item.active && !isNews && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[hsl(var(--ca-red)/0.35)] bg-[hsl(var(--ca-red)/0.1)] px-2 py-0.5 ca-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--ca-red))]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--ca-red))]" />
              Pågående
            </span>
          )}
        </div>

        <h2
          id={`feed-title-${item.id}`}
          className="mt-3 font-['Archivo',Inter,sans-serif] text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-foreground sm:text-lg"
        >
          {isNews && item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline decoration-[hsl(var(--ca-red))] underline-offset-4">
              {item.title}
            </a>
          ) : item.title}
        </h2>

        {(item.image || item.lat === null) && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.area}</span>
          </p>
        )}

        {item.body && (
          <p className={`mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-[hsl(var(--ca-text-2))] ${isLongBody && !expanded ? 'line-clamp-4' : ''}`}>
            {item.body}
          </p>
        )}
        {isLongBody && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-medium text-primary hover:underline">
            {expanded ? 'Visa mindre' : 'Läs mer'}
          </button>
        )}
        {item.bodyLocked && (
          <Link
            to="/account"
            className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--ca-line-strong))] px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <Lock className="h-3.5 w-3.5 text-primary" />
            Hela beskrivningen ingår i <span className="font-semibold text-primary">Pro</span>
          </Link>
        )}

        {item.alsoReported.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            🚧 Även rapporterat av Trafikverket: {item.alsoReported.map((t) => t.title).join(', ')}
          </p>
        )}

        {(item.url || item.mapLink) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--ca-line-strong))] px-3 py-1 text-xs text-foreground transition hover:border-primary/50 hover:bg-primary/10"
              >
                {isNews ? 'Läs artikeln' : 'Läs mer'} på {hostOf(item.url)} <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {item.mapLink && (
              <Link
                to={item.mapLink}
                className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--ca-line-strong))] px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                <MapPin className="h-3 w-3" /> Visa på kartan
              </Link>
            )}
          </div>
        )}

        {item.related.length > 0 && (
          <div className="mt-4 rounded-xl border border-[hsl(var(--ca-line))] bg-[hsl(var(--ca-panel-2))] p-3">
            <p className="ca-meta mb-2 flex items-center gap-1.5 !text-[9px]">
              <Newspaper className="h-3 w-3" /> Relaterade nyheter
            </p>
            <ul className="space-y-2">
              {item.related.map((news) => (
                <li key={news.id} className="border-l-2 pl-2.5" style={{ borderColor: kind.accent }}>
                  <a href={news.url ?? undefined} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium leading-snug text-foreground hover:underline">
                    {news.title}
                  </a>
                  <p className="ca-meta mt-0.5 !text-[9px]">{sourceName(news.source)} · {formatTimeAgo(news.published_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1 border-t border-[hsl(var(--ca-line))] pt-3">
          {REACTION_TYPES.map((r) => {
            const data = engagement?.reactions.find((x) => x.type === r.type);
            return (
              <button
                key={r.type}
                type="button"
                onClick={() => (user ? onToggleReaction(item.id, r.type) : setShowLoginNudge(true))}
                aria-pressed={!!data?.userReacted}
                aria-label={`Reagera med ${r.emoji}`}
                className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs transition active:scale-95 ${
                  data?.userReacted ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'text-muted-foreground hover:bg-[hsl(var(--ca-panel-3))]'
                }`}
              >
                <span aria-hidden className="text-sm">{r.emoji}</span>
                {user && !!data?.count && <span className="tabular-nums">{data.count}</span>}
              </button>
            );
          })}
          {user && totalReactions > 0 && (
            <span className="ca-meta ml-1 hidden !text-[9px] sm:inline">{totalReactions} reaktioner</span>
          )}
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            aria-expanded={commentsOpen}
            className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition ${
              commentsOpen ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'text-muted-foreground hover:bg-[hsl(var(--ca-panel-3))]'
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            {user ? <span className="tabular-nums">{engagement?.commentCount ?? 0}</span> : 'Kommentera'}
          </button>
          {item.kind === 'police' && (
            <ShareButton
              event={item}
              compact
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-[hsl(var(--ca-panel-3))]"
            />
          )}
        </div>

        {showLoginNudge && !user && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="text-primary underline">Logga in</Link> för att reagera och kommentera
          </p>
        )}

        {/* Comments are only readable with an account */}
        {commentsOpen && (user ? (
          <CommentThread itemId={item.id} onCountChange={handleCommentCount} />
        ) : (
          <p className="mt-3 border-t border-[hsl(var(--ca-line))] pt-3 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="text-primary underline">Logga in</Link> för att läsa och skriva kommentarer
          </p>
        ))}
      </div>
    </article>
  );
};

export default memo(FeedCard);
