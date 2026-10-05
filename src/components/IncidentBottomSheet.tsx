import { useState, useRef, useEffect } from 'react';
import { Incident, incidentTypeConfig } from '@/data/mockIncidents';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { useIncidentReactions, REACTION_TYPES } from '@/hooks/useIncidentReactions';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { Send, Heart, Trash2, Lock, X, ChevronDown } from 'lucide-react';
import { incidentTypeIcon } from '@/lib/typeIcons';
import { useNavigate } from 'react-router-dom';

interface Props {
  incident: Incident | null;
  onClose: () => void;
}

const formatTimeAgo = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  return `${Math.floor(hours / 24)}d sedan`;
};

const formatIncidentTime = (time: string): string => {
  const s = time.replace(/\s(?=\+|-)/, 'T').replace(' ', 'T');
  const d = new Date(s);
  if (isNaN(d.getTime())) return time;
  return d.toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getInitial = (email?: string) => {
  if (!email) return 'A';
  return email.charAt(0).toUpperCase();
};

const IncidentBottomSheet = ({ incident, onClose }: Props) => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { comments, loading, addComment, toggleLike, deleteComment } = useIncidentComments(incident?.id || null);
  const { reactions, toggleReaction } = useIncidentReactions(incident?.id || null);

  // Reset state on incident change
  useEffect(() => {
    setCommentText('');
    setDragOffset(0);
  }, [incident?.id]);

  // Scroll to bottom on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    await addComment(commentText);
    setCommentText('');
  };

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = y;
    setIsDragging(true);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const diff = y - dragStartRef.current;
    if (diff > 0) setDragOffset(diff);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (dragOffset > 120) {
      onClose();
    }
    setDragOffset(0);
  };

  if (!incident) return null;

  const config = incidentTypeConfig[incident.type];
  const TypeIcon = incidentTypeIcon(incident.type);
  const visibleComments = isPremium ? comments : comments.slice(0, 3);
  const hiddenCount = isPremium ? 0 : Math.max(0, comments.length - 3);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-[2001] flex flex-col bg-card border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out"
        style={{
          maxHeight: '70vh',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : undefined,
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-start gap-3">
            <TypeIcon className="mt-0.5 h-6 w-6 shrink-0" style={{ color: config.color }} aria-hidden />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground leading-tight truncate">{incident.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                <span className="font-medium" style={{ color: config.color }}>{config.label}</span>
                <span>•</span>
                <span>{incident.area}</span>
                <span>•</span>
                <span>{formatIncidentTime(incident.time)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reactions */}
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
          {REACTION_TYPES.map((r, i) => {
            const data = reactions[i];
            return (
              <button
                key={r.type}
                onClick={() => {
                  if (!user) { navigate('/auth'); return; }
                  toggleReaction(r.type);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                  data?.userReacted
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground border border-transparent'
                }`}
              >
                <span className="text-base leading-none">{r.emoji}</span>
                <span>{data?.count || 0}</span>
              </button>
            );
          })}
        </div>

        {/* Comments section */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : visibleComments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Inga kommentarer ännu</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Bli den första att kommentera</p>
            </div>
          ) : (
            visibleComments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5 group">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {getInitial(comment.user_id)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Anonym</span>
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed break-words">{comment.text}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => {
                        if (!user) { navigate('/auth'); return; }
                        toggleLike(comment.id, comment.user_has_liked);
                      }}
                      className={`flex items-center gap-1 text-[10px] transition-colors ${
                        comment.user_has_liked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${comment.user_has_liked ? 'fill-current' : ''}`} />
                      {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
                    </button>
                    {user && comment.user_id === user.id && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Premium gate for more comments */}
          {hiddenCount > 0 && (
            <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-muted/50 border border-border">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">+{hiddenCount} fler kommentarer</p>
                <p className="text-[10px] text-muted-foreground">Uppgradera till Pro för att se alla</p>
              </div>
              <button
                onClick={() => navigate('/prisplan')}
                className="text-[10px] font-semibold text-primary hover:underline shrink-0"
              >
                Uppgradera
              </button>
            </div>
          )}
        </div>

        {/* Comment input */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          {user ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder="Skriv en kommentar..."
                className="flex-1 bg-muted rounded-full px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                maxLength={500}
              />
              <button
                onClick={handleSubmit}
                disabled={!commentText.trim()}
                className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-2.5 rounded-full bg-muted text-sm text-muted-foreground hover:bg-muted-foreground/10 transition-colors border border-border"
            >
              Logga in för att kommentera
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default IncidentBottomSheet;
