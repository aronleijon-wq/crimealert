import { memo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Lock, MapPin, MessageCircle, Newspaper } from 'lucide-react';
import { incidentTypeConfig } from '@/data/mockIncidents';
import { useAuth } from '@/hooks/useAuth';
import type { Engagement } from '@/hooks/useEngagementCounts';
import { REACTION_TYPES } from '@/hooks/useIncidentReactions';
import type { FeedItem } from '@/lib/feed';
import { sourceName } from '@/lib/externalEvents';
import { formatTimeAgo } from '@/lib/timeAgo';
import CommentThread from './CommentThread';

const KIND_LABELS: Record<FeedItem['kind'], { label: string; icon: string; color: string }> = {
  police: { label: 'Polisen', icon: '🛡️', color: incidentTypeConfig.police.color },
  community: { label: 'Medborgarrapport', icon: '👁️', color: '#f97316' },
  traffic: { label: 'Trafik', icon: '🚧', color: incidentTypeConfig.trafikverket.color },
  vma: { label: 'VMA', icon: '📢', color: 'hsl(0, 84%, 60%)' },
  crisis: { label: 'Kris', icon: '📢', color: incidentTypeConfig.crisis.color },
  news: { label: 'Nyhet', icon: '📰', color: 'hsl(215, 16%, 57%)' },
};

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
  const kind = item.kind === 'police' && item.incidentType
    ? { ...KIND_LABELS.police, label: incidentTypeConfig[item.incidentType].label, color: incidentTypeConfig[item.incidentType].color }
    : KIND_LABELS[item.kind];
  const handleCommentCount = useCallback((count: number) => onCommentCount(item.id, count), [item.id, onCommentCount]);
  const isLongBody = item.body.length > 280;

  const titleLink = item.kind === 'news' && item.url;

  return (
    <article
      className={`rounded-lg border p-4 bg-card ${item.pinned ? 'border-destructive/60 bg-destructive/5' : 'border-border'}`}
      aria-labelledby={`feed-title-${item.id}`}
    >
      {item.pinned && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-destructive">
          Viktigt meddelande till allmänheten
        </p>
      )}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: `${kind.color}22`, color: kind.color }}>
          <span aria-hidden>{kind.icon}</span>
          {kind.label}
        </span>
        <span className="truncate">{item.source}</span>
        <span aria-hidden>·</span>
        <time dateTime={item.time} className="shrink-0">{formatTimeAgo(item.time)}</time>
        {item.active && item.kind !== 'news' && (
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[10px] text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />Pågående
          </span>
        )}
      </div>

      <h2 id={`feed-title-${item.id}`} className="mt-2 text-sm font-semibold leading-snug text-foreground">
        {titleLink ? (
          <a href={item.url!} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {item.title}
          </a>
        ) : item.title}
      </h2>

      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="truncate">{item.area}</span>
      </p>

      {item.body && (
        <p className={`mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground/85 ${isLongBody && !expanded ? 'line-clamp-4' : ''}`}>
          {item.body}
        </p>
      )}
      {isLongBody && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-[11px] text-primary hover:underline">
          {expanded ? 'Visa mindre' : 'Läs mer'}
        </button>
      )}
      {item.bodyLocked && (
        <Link to="/account" className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <Lock className="w-3 h-3" /> Hela beskrivningen ingår i Pro
        </Link>
      )}

      {item.alsoReported.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          🚧 Även rapporterat av Trafikverket: {item.alsoReported.map((t) => t.title).join(', ')}
        </p>
      )}

      {(item.url || item.mapLink) && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
          {item.url && item.kind !== 'news' && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Läs mer hos {hostOf(item.url)} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {item.kind === 'news' && item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Läs artikeln på {hostOf(item.url)} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {item.mapLink && (
            <Link to={item.mapLink} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <MapPin className="w-3 h-3" /> Visa på kartan
            </Link>
          )}
        </div>
      )}

      {item.related.length > 0 && (
        <div className="mt-3 rounded-md bg-muted/50 p-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Newspaper className="w-3 h-3" /> Relaterade nyheter
          </p>
          <ul className="space-y-1.5">
            {item.related.map((news) => (
              <li key={news.id} className="text-xs">
                <a href={news.url ?? undefined} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                  {news.title}
                </a>
                <span className="text-[10px] text-muted-foreground"> · {sourceName(news.source)} · {formatTimeAgo(news.published_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        {REACTION_TYPES.map((r) => {
          const data = engagement?.reactions.find((x) => x.type === r.type);
          return (
            <button
              key={r.type}
              type="button"
              onClick={() => (user ? onToggleReaction(item.id, r.type) : setShowLoginNudge(true))}
              aria-pressed={!!data?.userReacted}
              aria-label={`Reagera med ${r.emoji}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                data?.userReacted ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <span aria-hidden>{r.emoji}</span>
              {user && <span>{data?.count ?? 0}</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
          className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
            commentsOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {user ? engagement?.commentCount ?? 0 : 'Kommentera'}
        </button>
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
        <p className="mt-3 border-t border-border pt-3 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="text-primary underline">Logga in</Link> för att läsa och skriva kommentarer
        </p>
      ))}
    </article>
  );
};

export default memo(FeedCard);
