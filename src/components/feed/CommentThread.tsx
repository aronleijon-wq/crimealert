import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { formatTimeAgo } from '@/lib/timeAgo';

interface CommentThreadProps {
  itemId: string;
  onCountChange: (count: number) => void;
}

/** Comments on one feed post (same comments as the map popup for that event). */
const CommentThread = ({ itemId, onCountChange }: CommentThreadProps) => {
  const { user } = useAuth();
  const { comments, loading, addComment, toggleLike, deleteComment } = useIncidentComments(itemId, true);
  const [text, setText] = useState('');
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (loading) loadedOnce.current = true;
    else if (loadedOnce.current) onCountChange(comments.length);
  }, [loading, comments.length, onCountChange]);

  useEffect(() => {
    const missing = [...new Set(comments.map((c) => c.user_id))].filter((id) => !(id in displayNames));
    if (missing.length === 0) return;
    supabase.from('profiles').select('id, display_name').in('id', missing).then(({ data }) => {
      setDisplayNames((prev) => {
        const next = { ...prev };
        missing.forEach((id) => { next[id] = ''; });
        (data ?? []).forEach((p) => { next[p.id] = p.display_name ?? ''; });
        return next;
      });
    });
  }, [comments, displayNames]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addComment(text);
    setText('');
  };

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-2">Laddar kommentarer…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Inga kommentarer ännu</p>
      ) : (
        <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {comments.map((c) => {
            const name = displayNames[c.user_id] || 'Anonym';
            return (
              <li key={c.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-foreground/90 break-words mt-0.5">{c.text}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => user && toggleLike(c.id, c.user_has_liked)}
                      disabled={!user}
                      className={`flex items-center gap-1 text-[10px] transition ${c.user_has_liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      aria-label={c.user_has_liked ? 'Ta bort gilla' : 'Gilla kommentaren'}
                    >
                      <Heart className={`w-3 h-3 ${c.user_has_liked ? 'fill-current' : ''}`} />
                      {c.likes_count > 0 && c.likes_count}
                    </button>
                    {user?.id === c.user_id && (
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition"
                        aria-label="Ta bort kommentaren"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv en kommentar…"
            maxLength={500}
            aria-label="Kommentar"
            className="flex-1 min-w-0 rounded-full bg-muted px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            Skicka
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          <Link to="/auth" className="text-primary underline">Logga in</Link> för att kommentera
        </p>
      )}
    </div>
  );
};

export default CommentThread;
