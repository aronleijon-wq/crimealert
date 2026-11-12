import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { SWEDISH_KOMMUNER } from '@/data/kommuner';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useSEO } from '@/hooks/useSEO';
import { supabase } from '@/integrations/supabase/client';
import { chatOverview, chatPath, chatsSeen, isUnread, type ChatSummary, type ThreadRow } from './chats';
import { Screen } from './ui';

const MUTED = 'text-[rgba(235,235,245,0.6)]';

const preview = (s: ChatSummary, names: Record<string, string>, me: string | undefined) =>
  !s.last ? 'Inga meddelanden än' : `${s.last.user_id === me ? 'Du' : names[s.last.user_id] || 'Anonym'}: ${s.last.text.replace(/\s+/g, ' ')}`;

/** "14:32" today, "igår", "lör" this week, "7 nov" before that, as Messages does */
function when(iso: string, now = Date.now()): string {
  const at = new Date(iso);
  const days = Math.floor((now - at.getTime()) / 86400000);
  const day = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  if (day(at) === day(new Date(now))) return at.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
  if (day(at) === day(new Date(now - 86400000))) return 'igår';
  if (days < 6) return at.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short' }).replace('.', '');
  return at.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short' }).replace('.', '');
}

const Avatar = ({ name, size = 52 }: { name: string; size?: number }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-full bg-[#636366] font-semibold text-white"
    style={{ width: size, height: size, fontSize: size * 0.4 }}
    aria-hidden
  >
    {name.charAt(0)}
  </span>
);

const ChatRow = ({ s, names, me, unread }: { s: ChatSummary; names: Record<string, string>; me: string | undefined; unread: boolean }) => (
  <Link to={chatPath(s.kommun)} className="flex items-center gap-3 pl-2 pr-4 active:bg-white/[0.06]">
    <span className="flex w-2.5 justify-center" aria-hidden>{unread && <span className="h-2.5 w-2.5 rounded-full bg-[#0a84ff]" />}</span>
    <Avatar name={s.kommun} />
    <span className="min-w-0 flex-1 border-b border-[rgba(84,84,88,0.45)] py-3">
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{s.kommun}</span>
        {s.last && <span className={`shrink-0 text-[15px] ${MUTED}`}>{when(s.last.created_at)}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-[rgba(235,235,245,0.3)]" aria-hidden />
      </span>
      <span className={`mt-0.5 line-clamp-2 text-[15px] leading-[20px] ${unread ? 'text-[rgba(235,235,245,0.85)]' : MUTED}`}>
        {preview(s, names, me)}
      </span>
      {unread && <span className="sr-only">Nya meddelanden</span>}
    </span>
  </Link>
);

/** Chattar: every kommun's discussion in one place, as the Messages list: yours first, then the liveliest */
const NativeChats = () => {
  useSEO({ title: 'Chattar | CrimeAlert', description: 'Prata med grannarna i din kommun.', noindex: true });
  const { user } = useAuth();
  const { kommuner, loading: prefsLoading } = useNotificationPreferences();
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [seen] = useState(chatsSeen);

  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase
      .from('incident_comments')
      .select('incident_id, user_id, text, created_at')
      .like('incident_id', 'kommun:%')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(async ({ data }) => {
        if (!live) return;
        const found = (data ?? []) as ThreadRow[];
        setRows(found);
        const ids = [...new Set(found.map((r) => r.user_id))];
        if (!ids.length) return;
        const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', ids);
        if (live) setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name ?? ''])));
      });
    return () => { live = false; };
  }, [user]);

  const { mine, active } = useMemo(() => chatOverview(rows ?? [], kommuner), [rows, kommuner]);
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('sv-SE');
    if (!q) return [];
    return SWEDISH_KOMMUNER
      .filter((k) => k.toLocaleLowerCase('sv-SE').includes(q))
      .sort((a, b) => Number(!a.toLocaleLowerCase('sv-SE').startsWith(q)) - Number(!b.toLocaleLowerCase('sv-SE').startsWith(q)) || a.localeCompare(b, 'sv'))
      .slice(0, 30);
  }, [query]);

  const searchField = (
    <div className="mx-4 mb-2 mt-1 flex h-9 items-center gap-1.5 rounded-[10px] bg-[rgba(118,118,128,0.24)] px-2">
      <Search className="h-4 w-4 shrink-0 text-[rgba(235,235,245,0.6)]" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök kommun"
        aria-label="Sök kommun"
        className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-[rgba(235,235,245,0.6)] [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button type="button" onClick={() => setQuery('')} aria-label="Rensa" className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(235,235,245,0.6)]">
          <X className="h-3 w-3 text-black" strokeWidth={3} aria-hidden />
        </button>
      )}
    </div>
  );

  if (!user) {
    return (
      <Screen title="Chattar">
        <div className="mx-6 mt-16 text-center">
          <p className="text-[20px] font-semibold">Prata med grannarna</p>
          <p className={`mt-1.5 text-[15px] leading-snug ${MUTED}`}>Varje kommun har en egen chatt. Fråga, tipsa och berätta vad du såg.</p>
          <Link to="/auth" className="mx-auto mt-6 flex h-11 w-52 items-center justify-center rounded-full bg-[#0a84ff] text-[16px] font-semibold">Logga in</Link>
        </div>
      </Screen>
    );
  }

  const loading = rows === null || prefsLoading;
  const header = (label: string) => <h2 className={`mx-5 mb-1 mt-5 text-[13px] font-semibold uppercase tracking-[0.02em] ${MUTED}`}>{label}</h2>;

  return (
    <Screen title="Chattar">
      {searchField}

      {query.trim() ? (
        matches.length ? (
          <div className="mt-2">
            {matches.map((k) => (
              <Link key={k} to={chatPath(k)} className="flex items-center gap-3 pl-4 pr-4 active:bg-white/[0.06]">
                <Avatar name={k} size={40} />
                <span className="flex min-w-0 flex-1 items-center border-b border-[rgba(84,84,88,0.45)] py-3">
                  <span className="min-w-0 flex-1 truncate text-[17px]">{k}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(235,235,245,0.3)]" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className={`mt-16 text-center text-[15px] ${MUTED}`}>Ingen kommun heter så</p>
        )
      ) : loading ? (
        <div className="mt-3 space-y-1 px-4" aria-label="Hämtar chattar">
          {[0, 1, 2].map((n) => (
            <div key={n} className="flex items-center gap-3 py-3 pl-4">
              <span className="h-[52px] w-[52px] animate-pulse rounded-full bg-white/[0.06]" />
              <span className="flex-1 space-y-2"><span className="block h-3.5 w-28 animate-pulse rounded bg-white/[0.06]" /><span className="block h-3 w-48 animate-pulse rounded bg-white/[0.06]" /></span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {mine.length > 0 ? (
            <>
              {header('Dina kommuner')}
              {mine.map((s) => <ChatRow key={s.kommun} s={s} names={names} me={user.id} unread={isUnread(s, seen, user.id)} />)}
            </>
          ) : (
            <div className="mx-6 mt-10 text-center">
              <p className="text-[17px] font-semibold">Hitta din kommun</p>
              <p className={`mt-1 text-[15px] leading-snug ${MUTED}`}>Sök ovan, eller bevaka en kommun så hamnar dess chatt här.</p>
              <Link to="/alerts" className="mt-3 inline-block text-[16px] font-semibold text-[#0a84ff]">Välj kommuner</Link>
            </div>
          )}
          {active.length > 0 && (
            <>
              {header('Aktiva just nu')}
              {active.map((s) => <ChatRow key={s.kommun} s={s} names={names} me={user.id} unread={isUnread(s, seen, user.id)} />)}
            </>
          )}
          <p className={`mx-6 mt-8 text-center text-[13px] leading-snug ${MUTED}`}>
            Alla {SWEDISH_KOMMUNER.length} kommuner har en egen chatt. Inga namn på misstänkta och inga hot.
          </p>
        </>
      )}
    </Screen>
  );
};

export default NativeChats;
