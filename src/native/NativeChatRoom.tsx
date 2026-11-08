import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUp, Copy, Flag, Heart, Reply, Trash2, UserX, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentComments, type IncidentComment } from '@/hooks/useIncidentComments';
import { useSEO } from '@/hooks/useSEO';
import { supabase } from '@/integrations/supabase/client';
import { kommunFromSlug } from '@/lib/kommunPages';
import { REPORT_REASONS, type ReportReason } from '@/lib/moderation';
import { kommunThreadId } from '../../supabase/functions/_shared/replies';
import { chatItems, clock, personColor } from './chatRoom';
import { haptics } from './haptics';

const POLL_MS = 15000;
const STARTERS = ['Hörde någon smällarna?', 'Vet någon vad som hände?', 'Tips: håll koll på cykeln i trapphuset', 'Lugnt här ikväll 👍'];

/** "@Anna L hörde det också", with the name it answers in bold */
const MessageText = ({ text, names }: { text: string; names: string[] }) => {
  const name = names.filter(Boolean).sort((a, b) => b.length - a.length).find((n) => text.startsWith(`@${n}`));
  if (!name) return <>{text}</>;
  return <><span className="font-semibold">@{name}</span>{text.slice(name.length + 1)}</>;
};

type Sheet = { kind: 'actions'; message: IncidentComment } | { kind: 'report'; message: IncidentComment } | null;

/**
 * A kommun's discussion as a chat, in the app from 1.3: bubbles like Messages, your own on the
 * right, a composer at the bottom, and new messages coming in by themselves.
 */
const NativeChatRoom = () => {
  const { slug } = useParams();
  const kommun = kommunFromSlug(slug);
  const threadId = kommun ? kommunThreadId(kommun) : null;
  useSEO({ title: kommun ? `Chatt: ${kommun} | CrimeAlert` : 'Chatt | CrimeAlert', description: 'Prata med grannarna.', noindex: true });
  const { user } = useAuth();
  const { comments, loading, addComment, toggleLike, deleteComment, reportComment, blockAuthor, refetch } = useIncidentComments(threadId, !!user);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ userId: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);

  // New messages come in by themselves while the room is open and on screen
  useEffect(() => {
    if (!user || !threadId) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') refetch(); }, POLL_MS);
    return () => clearInterval(id);
  }, [user, threadId, refetch]);

  // Everyone's names, once
  useEffect(() => {
    const missing = [...new Set(comments.map((c) => c.user_id))].filter((id) => !(id in names));
    if (!missing.length) return;
    supabase.from('profiles').select('id, display_name').in('id', missing).then(({ data }) => {
      setNames((prev) => {
        const next = { ...prev };
        for (const id of missing) next[id] = '';
        for (const p of data ?? []) next[p.id] = p.display_name ?? '';
        return next;
      });
    });
  }, [comments, names]);

  // Stays at the newest message, unless you have scrolled up to read
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [comments.length, loading]);

  const items = useMemo(() => chatItems(comments), [comments]);
  const people = new Set(comments.map((c) => c.user_id)).size;
  const today = comments.filter((c) => Date.now() - Date.parse(c.created_at) < 86400000).length;
  const nameOf = (id: string) => names[id] || 'Anonym';

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    stick.current = true;
    const refused = await addComment(text);
    setSending(false);
    if (refused) { setError(refused); haptics.error(); return; }
    haptics.impact('light');
    setText('');
    setReplyTo(null);
  };

  const answer = (m: IncidentComment) => {
    const name = names[m.user_id];
    setReplyTo({ userId: m.user_id, name: name || 'Anonym' });
    if (name) setText((t) => (t.startsWith(`@${name} `) ? t : `@${name} ${t.replace(/^@\S+(?: \S+)?\s/, '')}`));
    setSheet(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (!kommun) {
    return <div className="ios flex h-full items-center justify-center bg-black p-8 text-center text-[17px] text-white">Den kommunen finns inte. <Link to="/chattar" className="ml-1 text-[#ff453a]">Till Chattar</Link></div>;
  }

  return (
    <div className="ios flex h-full flex-col bg-black text-white">
      {/* Whose room it is */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 pb-3 pt-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff453a] to-[#bf5af2] text-[19px] font-bold">{kommun.charAt(0)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[19px] font-bold leading-6">{kommun}</span>
          <span className="block text-[13px] text-[rgba(235,235,245,0.6)]">
            {people ? `${people} ${people === 1 ? 'person' : 'personer'} · ${today} meddelanden idag` : 'Kommunens chatt'}
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-[rgba(48,209,88,0.14)] px-2.5 py-1 text-[12px] font-semibold text-[#30d158]"><i className="h-1.5 w-1.5 rounded-full bg-[#30d158]" />Live</span>
      </div>

      <div
        ref={listRef}
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2"
      >
        <p className="mx-auto mb-3 mt-1 max-w-[300px] rounded-2xl bg-white/[0.05] px-3 py-2 text-center text-[12px] leading-snug text-[rgba(235,235,245,0.55)]">
          Inga namn på misstänkta och inga hot. Håll en bra ton – det här är dina grannar.
        </p>

        {!user ? (
          <div className="mt-16 text-center">
            <p className="text-[20px] font-bold">Prata om {kommun}</p>
            <p className="mx-auto mt-2 max-w-[280px] text-[15px] text-[rgba(235,235,245,0.6)]">Logga in för att läsa och skriva i kommunens chatt.</p>
            <Link to="/auth" className="mx-auto mt-5 flex h-11 w-56 items-center justify-center rounded-full bg-[#ff453a] text-[16px] font-semibold">Logga in</Link>
          </div>
        ) : loading && !comments.length ? (
          <p className="mt-16 text-center text-[15px] text-[rgba(235,235,245,0.6)]">Hämtar chatten…</p>
        ) : !comments.length ? (
          <div className="mt-12 text-center">
            <p className="text-[34px]">👋</p>
            <p className="mt-2 text-[20px] font-bold">Starta samtalet i {kommun}</p>
            <p className="mx-auto mt-1.5 max-w-[280px] text-[15px] text-[rgba(235,235,245,0.6)]">Bli först att skriva. Fråga något eller berätta vad du såg.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 px-4">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => { setText(s); inputRef.current?.focus(); }} className="rounded-full border border-white/15 px-3.5 py-2 text-[14px] active:bg-white/10">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          items.map(({ message: m, day, first, last }) => {
            const mine = m.user_id === user.id;
            return (
              <div key={m.id}>
                {day && <p className="my-4 text-center text-[12px] font-semibold uppercase tracking-wide text-[rgba(235,235,245,0.45)]">{day}</p>}
                <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${last ? 'mb-2.5' : 'mb-[3px]'}`}>
                  {!mine && (
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${last ? '' : 'invisible'}`} style={{ background: personColor(m.user_id) }}>
                      {nameOf(m.user_id).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className={`max-w-[76%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!mine && first && <span className="mb-1 ml-3 text-[12px] font-semibold" style={{ color: personColor(m.user_id) }}>{nameOf(m.user_id)}</span>}
                    <button
                      type="button"
                      onClick={() => { haptics.selection(); setSheet({ kind: 'actions', message: m }); }}
                      className={`relative select-text whitespace-pre-wrap break-words px-3.5 py-2 text-left text-[16px] leading-[21px] active:opacity-80 ${mine ? 'bg-[#ff453a] text-white' : 'bg-[#26262a] text-white'} ${mine ? `rounded-[20px] ${last ? 'rounded-br-[6px]' : ''}` : `rounded-[20px] ${last ? 'rounded-bl-[6px]' : ''}`}`}
                    >
                      <MessageText text={m.text} names={Object.values(names)} />
                      {m.likes_count > 0 && (
                        <span className={`absolute -bottom-2 ${mine ? '-left-2' : '-right-2'} flex items-center gap-0.5 rounded-full border-2 border-black bg-[#3a3a3c] px-1.5 py-[1px] text-[11px] font-semibold`}>
                          <Heart className={`h-3 w-3 ${m.user_has_liked ? 'fill-[#ff453a] text-[#ff453a]' : ''}`} aria-hidden />{m.likes_count}
                        </span>
                      )}
                    </button>
                    {last && <span className={`mt-1 text-[11px] text-[rgba(235,235,245,0.4)] ${mine ? 'mr-2' : 'ml-3'}`}>{clock(Date.parse(m.created_at))}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Writing */}
      {user && (
        <div className="shrink-0 border-t border-white/[0.08] bg-[rgba(18,18,20,0.95)] px-3 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-1.5 text-[13px]">
              <Reply className="h-3.5 w-3.5 text-[#ff453a]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[rgba(235,235,245,0.7)]">Svarar <b className="text-white">{replyTo.name}</b></span>
              <button type="button" aria-label="Avbryt svaret" onClick={() => { setReplyTo(null); setText((t) => t.replace(/^@\S+(?: \S+)?\s/, '')); }}><X className="h-4 w-4 text-[rgba(235,235,245,0.6)]" /></button>
            </div>
          )}
          {error && <p role="alert" className="mb-2 px-1 text-[13px] text-[#ff6961]">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, 500)); setError(null); const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 110)}px`; }}
              placeholder={`Skriv till ${kommun}…`}
              aria-label="Meddelande"
              rows={1}
              className="max-h-[110px] min-h-[38px] flex-1 resize-none rounded-[20px] border border-white/15 bg-black px-4 py-[8px] text-[16px] leading-[21px] text-white outline-none placeholder:text-[rgba(235,235,245,0.35)]"
            />
            <button type="button" onClick={send} disabled={!text.trim() || sending} aria-label="Skicka" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#ff453a] transition active:scale-90 disabled:bg-[#3a3a3c]">
              <ArrowUp className="h-5 w-5" strokeWidth={2.6} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* What you can do with a message */}
      {sheet && (
        <div className="fixed inset-0 z-[3000] flex flex-col justify-end bg-black/50" onClick={() => setSheet(null)} role="dialog" aria-modal="true" aria-label="Meddelande">
          <div className="ca-app-sheet mx-2 mb-2 space-y-2" style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }} onClick={(e) => e.stopPropagation()}>
            {sheet.kind === 'actions' ? (() => {
              const m = sheet.message;
              const mine = m.user_id === user?.id;
              const action = (icon: typeof Reply, label: string, run: () => void, danger = false) => {
                const Icon = icon;
                return (
                  <button key={label} type="button" onClick={run} className={`flex h-[54px] w-full items-center justify-between px-5 text-[18px] active:bg-white/10 ${danger ? 'text-[#ff453a]' : 'text-white'}`}>
                    {label}<Icon className="h-5 w-5" aria-hidden />
                  </button>
                );
              };
              return (
                <>
                  <div className="overflow-hidden rounded-[14px] bg-[#2c2c2e] [&>*+*]:border-t [&>*+*]:border-white/10">
                    <p className="px-5 py-3 text-center text-[13px] text-[rgba(235,235,245,0.6)]">{mine ? 'Ditt meddelande' : nameOf(m.user_id)} · {clock(Date.parse(m.created_at))}</p>
                    {!mine && action(Reply, 'Svara', () => answer(m))}
                    {action(Heart, m.user_has_liked ? 'Ta bort gilla' : 'Gilla', () => { haptics.selection(); toggleLike(m.id, m.user_has_liked); setSheet(null); })}
                    {action(Copy, 'Kopiera', () => { navigator.clipboard?.writeText(m.text).catch(() => {}); setSheet(null); })}
                    {mine && action(Trash2, 'Radera', () => { deleteComment(m.id); setSheet(null); }, true)}
                    {!mine && action(Flag, 'Anmäl', () => setSheet({ kind: 'report', message: m }), true)}
                    {!mine && action(UserX, `Blockera ${nameOf(m.user_id)}`, () => { blockAuthor(m.user_id); setSheet(null); }, true)}
                  </div>
                  <button type="button" onClick={() => setSheet(null)} className="h-[56px] w-full rounded-[14px] bg-[#2c2c2e] text-[18px] font-semibold text-[#0a84ff]">Avbryt</button>
                </>
              );
            })() : (
              <>
                <div className="overflow-hidden rounded-[14px] bg-[#2c2c2e] [&>*+*]:border-t [&>*+*]:border-white/10">
                  <p className="px-5 py-3 text-center text-[13px] text-[rgba(235,235,245,0.6)]">Varför anmäler du meddelandet? Vi granskar det inom 24 timmar.</p>
                  {REPORT_REASONS.map((r) => (
                    <button key={r.value} type="button" onClick={() => { reportComment(sheet.message.id, r.value as ReportReason); haptics.success(); setSheet(null); }} className="flex h-[54px] w-full items-center px-5 text-[18px] text-white active:bg-white/10">{r.label}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setSheet(null)} className="h-[56px] w-full rounded-[14px] bg-[#2c2c2e] text-[18px] font-semibold text-[#0a84ff]">Avbryt</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NativeChatRoom;
