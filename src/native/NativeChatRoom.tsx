import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Flag, Heart, Reply, Trash2, UserX, X } from 'lucide-react';
import { isNativeApp } from '@/lib/native';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentComments, type IncidentComment } from '@/hooks/useIncidentComments';
import { useSEO } from '@/hooks/useSEO';
import { supabase } from '@/integrations/supabase/client';
import { kommunFromSlug } from '@/lib/kommunPages';
import { REPORT_REASONS, type ReportReason } from '@/lib/moderation';
import { kommunThreadId } from '../../supabase/functions/_shared/replies';
import { chatItems, clock, personColor } from './chatRoom';
import { markChatSeen } from './chats';
import { haptics } from './haptics';
import './chat.css';

const POLL_MS = 15000;
const MINE = '#0a84ff';
const THEIRS = '#26262a';
const MUTED = 'text-[rgba(235,235,245,0.6)]';
/** How far a message is pulled to the right before letting go answers it */
const SWIPE_REPLY = 56;
const LONG_PRESS_MS = 420;
const DOUBLE_TAP_MS = 280;

/** "@Anna L hörde det också", with the name it answers in bold */
const MessageText = ({ text, names }: { text: string; names: string[] }) => {
  const name = names.filter(Boolean).sort((a, b) => b.length - a.length).find((n) => text.startsWith(`@${n}`));
  if (!name) return <>{text}</>;
  return <><span className="font-semibold">@{name}</span>{text.slice(name.length + 1)}</>;
};

interface BubbleProps {
  message: IncidentComment;
  mine: boolean;
  last: boolean;
  fresh: boolean;
  names: string[];
  onMenu: () => void;
  onReply: () => void;
  onLike: () => void;
}

/**
 * One message. Like Messages: hold it for the menu, pull it to the right to answer, tap twice to
 * like. Vertical scrolling stays with the list.
 */
const Bubble = ({ message: m, mine, last, fresh, names, onMenu, onReply, onLike }: BubbleProps) => {
  const [offset, setOffset] = useState(0);
  const [popped, setPopped] = useState(false);
  const start = useRef<{ x: number; y: number; swiping: boolean; moved: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastTap = useRef(0);
  const passed = useRef(false);

  const cancelPress = () => { if (timer.current) clearTimeout(timer.current); timer.current = undefined; };

  const down = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, swiping: false, moved: false };
    passed.current = false;
    cancelPress();
    timer.current = setTimeout(() => { timer.current = undefined; start.current = null; haptics.impact('medium'); onMenu(); }, LONG_PRESS_MS);
  };
  const move = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { s.moved = true; cancelPress(); }
    if (!s.swiping && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { start.current = null; return; }
    if (dx > 10 && dx > Math.abs(dy)) s.swiping = true;
    if (!s.swiping) return;
    // Follows the finger, then gets heavier past the point where it answers
    const pulled = dx <= SWIPE_REPLY ? dx : SWIPE_REPLY + (dx - SWIPE_REPLY) * 0.25;
    setOffset(Math.max(0, Math.min(pulled, 90)));
    if (dx >= SWIPE_REPLY && !passed.current) { passed.current = true; haptics.selection(); }
    if (dx < SWIPE_REPLY) passed.current = false;
  };
  const up = () => {
    cancelPress();
    const s = start.current;
    start.current = null;
    if (s?.swiping) { if (passed.current) onReply(); setOffset(0); return; }
    if (s && !s.moved) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        haptics.impact('light');
        if (!m.user_has_liked) { setPopped(true); setTimeout(() => setPopped(false), 700); }
        onLike();
      } else lastTap.current = now;
    }
  };
  const leave = () => { cancelPress(); if (start.current?.swiping) setOffset(0); start.current = null; };

  return (
    <div className="relative" style={{ touchAction: 'pan-y' }}>
      {/* The answer arrow, revealed by the pull */}
      <span
        className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/10"
        style={{ opacity: Math.min(1, offset / SWIPE_REPLY), transform: `translateY(-50%) scale(${0.6 + 0.4 * Math.min(1, offset / SWIPE_REPLY)})` }}
        aria-hidden
      >
        <Reply className="h-4 w-4 text-white" />
      </span>
      <div
        className={`relative max-w-full ${fresh ? 'ca-msg-in' : ''}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: offset ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={leave}
        onPointerLeave={leave}
        onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`${m.text}. Håll in för fler val`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMenu(); } }}
          className={`select-none whitespace-pre-wrap break-words px-3.5 py-[7px] text-[16px] leading-[21px] text-white [-webkit-touch-callout:none] ${
            last ? (mine ? 'rounded-[18px] rounded-br-[5px]' : 'rounded-[18px] rounded-bl-[5px]') : 'rounded-[18px]'
          }`}
          style={{ background: mine ? MINE : THEIRS }}
        >
          <MessageText text={m.text} names={names} />
        </div>
        {(m.likes_count > 0 || popped) && (
          <span
            key={m.likes_count}
            className={`ca-like-pop absolute -top-3 ${mine ? '-left-3' : '-right-3'} flex h-[22px] min-w-[22px] items-center justify-center gap-0.5 rounded-full border-2 border-black bg-[#2c2c2e] px-1 text-[11px] font-semibold tabular-nums`}
            aria-label={`${m.likes_count} gillar`}
          >
            <Heart className="h-3 w-3 fill-[#ff453a] text-[#ff453a]" aria-hidden />
            {m.likes_count > 1 && m.likes_count}
          </span>
        )}
      </div>
    </div>
  );
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
  const [pending, setPending] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ userId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [below, setBelow] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const seenCount = useRef(0);
  // Messages from before the room opened are simply there; later ones rise into place
  const openedAt = useRef(Date.now());

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

  // Stays at the newest message, unless you have scrolled up to read: then a pill says how many came
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const added = comments.length - seenCount.current;
    const first = seenCount.current === 0;
    seenCount.current = comments.length;
    if (stick.current || pending !== null) el.scrollTo({ top: el.scrollHeight, behavior: first ? 'auto' : 'smooth' });
    else if (added > 0) setBelow((n) => n + added);
  }, [comments.length, loading, pending]);

  useEffect(() => { if (kommun && comments.length) markChatSeen(kommun); }, [kommun, comments.length]);

  const items = useMemo(() => chatItems(comments), [comments]);
  const nameList = useMemo(() => Object.values(names), [names]);
  const people = new Set(comments.map((c) => c.user_id)).size;
  const nameOf = (id: string) => names[id] || 'Anonym';

  const toBottom = () => {
    const el = listRef.current;
    stick.current = true;
    setBelow(0);
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const send = async () => {
    const message = text.trim();
    if (!message || pending !== null) return;
    setError(null);
    stick.current = true;
    // Shown at once, a little faded, until it is saved
    setPending(message);
    setText('');
    setReplyTo(null);
    if (inputRef.current) inputRef.current.style.height = '';
    haptics.impact('light');
    const refused = await addComment(message);
    setPending(null);
    if (refused) { setError(refused); setText(message); haptics.error(); }
  };

  const answer = (m: IncidentComment) => {
    const name = names[m.user_id];
    setReplyTo({ userId: m.user_id, name: name || 'Anonym' });
    if (name) setText((t) => (t.startsWith(`@${name} `) ? t : `@${name} ${t.replace(/^@\S+(?: \S+)?\s/, '')}`));
    setSheet(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (!kommun) {
    return <div className="ios flex h-full items-center justify-center bg-black p-8 text-center text-[17px] text-white">Den kommunen finns inte. <Link to="/chattar" className="ml-1 text-[#0a84ff]">Till Chattar</Link></div>;
  }

  const menuMessage = sheet?.message ?? null;
  const menuMine = menuMessage?.user_id === user?.id;

  return (
    <div className="ios flex h-full flex-col bg-black text-white">
      {/* Whose room it is */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 pb-2.5 pt-0.5">
        {/* The app has its own back button above; the website gets one here */}
        {!isNativeApp() && (
          <Link to="/chattar" aria-label="Alla chattar" className="-ml-2 flex h-9 w-7 items-center justify-center text-[#0a84ff]">
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </Link>
        )}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#636366] text-[16px] font-semibold">{kommun.charAt(0)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-[22px]">{kommun}</span>
          <span className={`block text-[12px] ${MUTED}`}>{people ? `${people} ${people === 1 ? 'person' : 'personer'} i chatten` : 'Kommunens chatt'}</span>
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (stick.current && below) setBelow(0);
          }}
          className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-3"
        >
          <p className={`mx-auto mb-4 max-w-[290px] text-center text-[12px] leading-snug ${MUTED}`}>
            Var schysst. Inga namn på misstänkta och inga hot.
          </p>

          {!user ? (
            <div className="mt-20 text-center">
              <p className="text-[17px] font-semibold">Logga in för att vara med</p>
              <p className={`mx-auto mt-1 max-w-[260px] text-[15px] ${MUTED}`}>Med ett gratis konto läser och skriver du i {kommun}s chatt.</p>
              <Link to="/auth" className="mx-auto mt-5 flex h-11 w-48 items-center justify-center rounded-full bg-[#0a84ff] text-[16px] font-semibold">Logga in</Link>
            </div>
          ) : loading && !comments.length ? (
            <div className="space-y-2.5 pt-2" aria-label="Hämtar chatten">
              {[56, 38, 64, 30].map((w, i) => (
                <div key={w} className={`flex ${i % 2 ? 'justify-end' : 'justify-start pl-9'}`}>
                  <span className="h-9 animate-pulse rounded-[18px] bg-white/[0.06]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : !comments.length && pending === null ? (
            <div className="mt-24 text-center">
              <p className="text-[17px] font-semibold">Inga meddelanden än</p>
              <p className={`mx-auto mt-1 max-w-[260px] text-[15px] ${MUTED}`}>Skriv det första: fråga något eller berätta vad du såg i {kommun}.</p>
            </div>
          ) : (
            <>
              {items.map(({ message: m, day, first, last }) => {
                const mine = m.user_id === user.id;
                // Your own just replaced its faded copy, so only others' rise in
                const fresh = !mine && Date.parse(m.created_at) > openedAt.current;
                return (
                  <div key={m.id}>
                    {day && (
                      <p className={`mb-3 mt-4 text-center text-[11px] ${MUTED}`}>
                        <span className="font-semibold">{day.split(' ').slice(0, -1).join(' ')}</span> {day.split(' ').pop()}
                      </p>
                    )}
                    <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${last ? 'mb-2' : 'mb-[2px]'}`}>
                      {!mine && (
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${last ? '' : 'invisible'}`}
                          style={{ background: personColor(m.user_id) }}
                          aria-hidden
                        >
                          {nameOf(m.user_id).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className={`flex max-w-[75%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        {!mine && first && <span className={`mb-[3px] ml-3 text-[11px] ${MUTED}`}>{nameOf(m.user_id)}</span>}
                        <Bubble
                          message={m}
                          mine={mine}
                          last={last}
                          fresh={fresh}
                          names={nameList}
                          onMenu={() => setSheet({ kind: 'actions', message: m })}
                          onReply={() => answer(m)}
                          onLike={() => toggleLike(m.id, m.user_has_liked)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {pending !== null && (
                <div className="mb-2 flex justify-end">
                  <div className="ca-msg-in max-w-[75%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[5px] px-3.5 py-[7px] text-[16px] leading-[21px] opacity-60" style={{ background: MINE }}>
                    {pending}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {below > 0 && (
          <button
            type="button"
            onClick={toBottom}
            className="ca-msg-in absolute bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-[rgba(44,44,46,0.92)] px-4 text-[14px] font-semibold shadow-lg backdrop-blur-xl"
          >
            <ArrowDown className="h-4 w-4" aria-hidden /> {below === 1 ? 'Nytt meddelande' : `${below} nya meddelanden`}
          </button>
        )}
      </div>

      {/* Writing */}
      {user && (
        <div className="shrink-0 border-t border-white/[0.08] bg-[rgba(18,18,20,0.94)] px-3 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
          {replyTo && (
            <div className="ca-msg-in mb-2 flex items-center gap-2.5 border-l-[3px] border-[#0a84ff] pl-2.5 text-[13px]">
              <span className={`min-w-0 flex-1 truncate ${MUTED}`}>Svarar <b className="font-semibold text-white">{replyTo.name}</b></span>
              <button type="button" aria-label="Avbryt svaret" className="flex h-7 w-7 items-center justify-center rounded-full active:bg-white/10" onClick={() => { setReplyTo(null); setText((t) => t.replace(/^@\S+(?: \S+)?\s/, '')); }}>
                <X className="h-4 w-4 text-[rgba(235,235,245,0.6)]" />
              </button>
            </div>
          )}
          {error && <p role="alert" className="mb-2 px-1 text-[13px] text-[#ff6961]">{error}</p>}
          <div className="flex items-end rounded-[20px] border border-white/[0.12] bg-[#1c1c1e] py-[3px] pl-4 pr-[3px]">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, 500)); setError(null); const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 110)}px`; }}
              placeholder="Meddelande"
              aria-label={`Meddelande till ${kommun}`}
              rows={1}
              className="max-h-[110px] min-h-[32px] flex-1 resize-none bg-transparent py-[5px] text-[16px] leading-[21px] text-white outline-none placeholder:text-[rgba(235,235,245,0.3)]"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || pending !== null}
              aria-label="Skicka"
              className={`ml-2 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#0a84ff] transition duration-200 active:scale-90 ${text.trim() ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.8} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* What you can do with a message: the message itself, and a menu under it */}
      {sheet && menuMessage && createPortal(
        <div className="ios ca-menu-backdrop fixed inset-0 z-[3000] flex flex-col justify-center bg-black/75 px-4 text-white backdrop-blur-xl" onClick={() => setSheet(null)} role="dialog" aria-modal="true" aria-label="Meddelande">
          <div className={`flex flex-col ${menuMine ? 'items-end' : 'items-start'}`} onClick={(e) => e.stopPropagation()}>
            <div className="ca-menu-in max-w-[80%]" style={{ ['--origin' as string]: menuMine ? 'bottom right' : 'bottom left' }}>
              <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-[7px] text-[16px] leading-[21px]" style={{ background: menuMine ? MINE : '#3a3a3c' }}>
                <MessageText text={menuMessage.text} names={nameList} />
              </div>
            </div>
            <div
              className="ca-menu-in mt-2 w-[250px] overflow-hidden rounded-[14px] bg-[rgba(44,44,46,0.94)] backdrop-blur-xl [&>*+*]:border-t [&>*+*]:border-white/[0.08]"
              style={{ ['--origin' as string]: menuMine ? 'top right' : 'top left' }}
            >
              {sheet.kind === 'actions' ? (() => {
                const m = menuMessage;
                const action = (icon: typeof Reply, label: string, run: () => void, danger = false) => {
                  const Icon = icon;
                  return (
                    <button key={label} type="button" onClick={run} className={`flex h-11 w-full items-center justify-between px-4 text-[17px] active:bg-white/10 ${danger ? 'text-[#ff453a]' : 'text-white'}`}>
                      <span className="truncate">{label}</span><Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    </button>
                  );
                };
                return (
                  <>
                    <p className={`px-4 py-2 text-[12px] ${MUTED}`}>{menuMine ? 'Du' : nameOf(m.user_id)} · {clock(Date.parse(m.created_at))}</p>
                    {action(Reply, 'Svara', () => answer(m))}
                    {action(Heart, m.user_has_liked ? 'Ta bort gilla' : 'Gilla', () => { haptics.selection(); toggleLike(m.id, m.user_has_liked); setSheet(null); })}
                    {action(Copy, 'Kopiera', () => { navigator.clipboard?.writeText(m.text).catch(() => {}); setSheet(null); })}
                    {menuMine && action(Trash2, 'Radera', () => { deleteComment(m.id); setSheet(null); }, true)}
                    {!menuMine && action(Flag, 'Anmäl', () => setSheet({ kind: 'report', message: m }), true)}
                    {!menuMine && action(UserX, `Blockera ${nameOf(m.user_id)}`, () => { blockAuthor(m.user_id); setSheet(null); }, true)}
                  </>
                );
              })() : (
                <>
                  <p className={`px-4 py-2.5 text-[13px] leading-snug ${MUTED}`}>Varför anmäler du meddelandet? Vi granskar det inom 24 timmar.</p>
                  {REPORT_REASONS.map((r) => (
                    <button key={r.value} type="button" onClick={() => { reportComment(menuMessage.id, r.value as ReportReason); haptics.success(); setSheet(null); }} className="flex h-11 w-full items-center px-4 text-[17px] text-white active:bg-white/10">{r.label}</button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default NativeChatRoom;
