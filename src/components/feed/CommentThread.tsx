import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Heart, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import ModerationMenu from '@/components/ModerationMenu';
import { formatTimeAgo } from '@/lib/timeAgo';
import { personColor } from '@/native/chatRoom';
import '@/native/chat.css';

interface CommentThreadProps {
  itemId: string;
  onCountChange: (count: number) => void;
}

/** A comment, with the @Name it answers in bold when it starts with one */
const MentionText = ({ text, names }: { text: string; names: string[] }) => {
  const name = names.filter(Boolean).sort((a, b) => b.length - a.length).find((n) => text.startsWith(`@${n}`));
  if (!name) return <>{text}</>;
  return <><span className="font-semibold text-[#0a84ff]">@{name}</span>{text.slice(name.length + 1)}</>;
};

const Avatar = ({ id, name, size = 32 }: { id: string; name: string; size?: number }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    style={{ width: size, height: size, fontSize: size * 0.4, background: personColor(id) }}
    aria-hidden
  >
    {name.charAt(0).toUpperCase()}
  </span>
);

/** "5 min" from "5 min sedan", as comment lists write it */
const shortAgo = (iso: string) => formatTimeAgo(iso).replace(/ sedan$/, '');

/**
 * Comments on a feed post or an event (the same comments as the map popup), Instagram's way: the
 * name and the words together, a heart to the right, "Svara" under, and a field at the bottom
 * with the send arrow in it.
 */
const CommentThread = ({ itemId, onCountChange }: CommentThreadProps) => {
  const { user } = useAuth();
  const { comments, loading, addComment, toggleLike, deleteComment, reportComment, blockAuthor } = useIncidentComments(itemId, true);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [popped, setPopped] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const openedAt = useRef(Date.now());
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLUListElement>(null);

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

  // The newest comment in view when one is added
  useEffect(() => {
    const el = list.current;
    if (el && (pending !== null || Date.parse(comments[comments.length - 1]?.created_at ?? '') > openedAt.current)) {
      el.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [comments, pending]);

  const submit = async () => {
    const message = text.trim();
    if (!message || pending !== null) return;
    setError(null);
    // Shown at once, a little faded, until it is saved
    setPending(message);
    setText('');
    setReplying(null);
    if (input.current) input.current.style.height = '';
    const refused = await addComment(message);
    setPending(null);
    if (refused) { setError(refused); setText(message); }
  };

  const like = (id: string, liked: boolean) => {
    if (!user) return;
    if (!liked) { setPopped(id); setTimeout(() => setPopped(null), 500); }
    toggleLike(id, liked);
  };

  const names = Object.values(displayNames);
  const myName = user ? displayNames[user.id] || user.email || 'Du' : '';

  return (
    <div className="mt-3 border-t border-border pt-3">
      {loading && comments.length === 0 ? (
        <div className="space-y-3 py-1" aria-label="Laddar kommentarer">
          {[70, 45].map((w) => (
            <div key={w} className="flex items-center gap-2.5">
              <span className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <span className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : comments.length === 0 && pending === null ? (
        <p className="py-2 text-center text-[14px] text-muted-foreground">Inga kommentarer än. Skriv den första.</p>
      ) : (
        <ul ref={list} className="max-h-[420px] space-y-4 overflow-y-auto overscroll-contain pr-1">
          {comments.map((c) => {
            const name = displayNames[c.user_id] || 'Anonym';
            const mine = user?.id === c.user_id;
            const fresh = !mine && Date.parse(c.created_at) > openedAt.current;
            return (
              <li key={c.id} className={`flex gap-2.5 ${fresh ? 'ca-msg-in' : ''}`}>
                <Avatar id={c.user_id} name={name} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[14px] leading-[19px] text-foreground" onDoubleClick={() => like(c.id, c.user_has_liked)}>
                    <span className="mr-1.5 font-semibold">{name}</span>
                    <MentionText text={c.text} names={names} />
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-muted-foreground">
                    <span>{shortAgo(c.created_at)}</span>
                    {c.likes_count > 0 && <span className="font-semibold">{c.likes_count === 1 ? '1 gillar' : `${c.likes_count} gillar`}</span>}
                    {user && !mine && (
                      <button type="button" onClick={() => replyTo(c.user_id, displayNames[c.user_id] ?? '')} className="font-semibold transition hover:text-foreground" aria-label={`Svara ${name}`}>
                        Svara
                      </button>
                    )}
                    {mine && (
                      <button type="button" onClick={() => deleteComment(c.id)} className="font-semibold transition hover:text-destructive" aria-label="Ta bort kommentaren">
                        Radera
                      </button>
                    )}
                    {user && !mine && (
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
                <button
                  type="button"
                  onClick={() => like(c.id, c.user_has_liked)}
                  disabled={!user}
                  className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-muted disabled:opacity-50"
                  aria-label={c.user_has_liked ? 'Ta bort gilla' : 'Gilla kommentaren'}
                  aria-pressed={c.user_has_liked}
                >
                  <Heart
                    className={`h-[15px] w-[15px] ${popped === c.id ? 'ca-like-pop' : ''} ${c.user_has_liked ? 'fill-[#ff453a] text-[#ff453a]' : 'text-muted-foreground'}`}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
          {pending !== null && user && (
            <li className="ca-msg-in flex gap-2.5 opacity-60">
              <Avatar id={user.id} name={myName} />
              <p className="min-w-0 flex-1 break-words text-[14px] leading-[19px] text-foreground">
                <span className="mr-1.5 font-semibold">{displayNames[user.id] || 'Du'}</span>{pending}
              </p>
            </li>
          )}
        </ul>
      )}

      {notice && <p className="mt-3 text-[12px] text-muted-foreground">{notice}</p>}

      {user ? (
        <div className="mt-4">
          {replying && (
            <div className="ca-msg-in mb-2 flex items-center gap-2 border-l-[3px] border-[#0a84ff] pl-2.5 text-[13px] text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">Svarar <span className="font-semibold text-foreground">{replying.name}</span></span>
              <button type="button" onClick={cancelReply} aria-label="Avbryt svaret" className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-muted">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2.5">
            <Avatar id={user.id} name={myName} size={32} />
            <div className="flex min-w-0 flex-1 items-end rounded-[20px] border border-border bg-muted/40 py-[3px] pl-4 pr-[3px] transition focus-within:border-[hsl(var(--ca-line-strong))]">
              <textarea
                ref={input}
                value={text}
                rows={1}
                onChange={(e) => { setText(e.target.value.slice(0, 500)); setError(null); const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 110)}px`; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder={replying ? `Svara ${replying.name}…` : 'Skriv en kommentar…'}
                aria-label="Kommentar"
                className="max-h-[110px] min-h-[28px] min-w-0 flex-1 resize-none bg-transparent py-[4px] text-[14px] leading-[20px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!text.trim() || pending !== null}
                aria-label="Skicka"
                className={`ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a84ff] text-white transition duration-200 active:scale-90 ${text.trim() ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0'}`}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.8} aria-hidden />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-center text-[14px] text-muted-foreground">
          <Link to="/auth" className="font-semibold text-foreground underline underline-offset-2">Logga in</Link> för att kommentera
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  );
};

export default CommentThread;
