import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import ModerationMenu from '@/components/ModerationMenu';
import { formatTimeAgo } from '@/lib/timeAgo';

interface CommentThreadProps {
  itemId: string;
  onCountChange: (count: number) => void;
}

/** A comment, with the @Name it answers in bold when it starts with one */
const MentionText = ({ text, names }: { text: string; names: string[] }) => {
  const name = names.filter(Boolean).sort((a, b) => b.length - a.length).find((n) => text.startsWith(`@${n}`));
  if (!name) return <>{text}</>;
  return <><span className="font-semibold text-primary">@{name}</span>{text.slice(name.length + 1)}</>;
};

/** Comments on one feed post (same comments as the map popup for that event). */
const CommentThread = ({ itemId, onCountChange }: CommentThreadProps) => {
  const { user } = useAuth();
  const { comments, loading, addComment, toggleLike, deleteComment, reportComment, blockAuthor } = useIncidentComments(itemId, true);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const loadedOnce = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  // Whom the comment being written answers, shown above the field until it is sent or cancelled
  const [replying, setReplying] = useState<{ userId: string; name: string } | null>(null);

  /**
   * "Svara": answers someone. With a name the comment starts with @Name, which also tells that
   * person at once (send-push-notifications); everyone who wrote in the thread hears of it anyway.
   */
  const replyTo = (userId: string, name: string) => {
    setReplying({ userId, name: name || 'Anonym' });
    if (name) {
      const mention = `@${name} `;
      setText((current) => (current.startsWith(mention) ? current : mention + current.replace(/^@\S+(?: \S+)?\s/, '')));
    }
    requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  };

  const cancelReply = () => {
    if (replying && displayNames[replying.userId]) {
      const mention = `@${displayNames[replying.userId]} `;
      setText((current) => (current.startsWith(mention) ? current.slice(mention.length) : current));
    }
    setReplying(null);
  };

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
    const refused = await addComment(text);
    setError(refused);
    if (!refused) { setText(''); setReplying(null); }
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
                  <p className="text-xs text-foreground/90 break-words mt-0.5"><MentionText text={c.text} names={Object.values(displayNames)} /></p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
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
                    {user && user.id !== c.user_id && (
                      <button
                        type="button"
                        onClick={() => replyTo(c.user_id, displayNames[c.user_id] ?? '')}
                        className="-my-1.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition"
                        aria-label={`Svara ${name}`}
                      >
                        Svara
                      </button>
                    )}
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
                    {user && user.id !== c.user_id && (
                      <ModerationMenu
                        what="kommentaren"
                        author={displayNames[c.user_id] || 'personen'}
                        onReport={async (reason) => {
                          await reportComment(c.id, reason);
                          setNotice('Tack. Vi granskar kommentaren inom 24 timmar.');
                        }}
                        onBlock={async () => {
                          await blockAuthor(c.user_id);
                          setNotice('Blockerad. Du ser inte längre personens kommentarer.');
                        }}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notice && <p className="text-[11px] text-muted-foreground">{notice}</p>}

      {user ? (
        <div className="space-y-1.5">
        {replying && (
          <p className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">Svarar <span className="font-semibold text-foreground">{replying.name}</span></span>
            <button type="button" onClick={cancelReply} className="font-semibold hover:text-foreground">Avbryt</button>
          </p>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replying ? `Svara ${replying.name}…` : 'Skriv en kommentar…'}
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
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          <Link to="/auth" className="text-primary underline">Logga in</Link> för att kommentera
        </p>
      )}
      {error && <p role="alert" className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
};

export default CommentThread;
