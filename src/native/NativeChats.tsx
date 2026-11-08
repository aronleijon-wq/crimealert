import { useEffect, useState } from 'react';
import { LogIn, MessagesSquare, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useSEO } from '@/hooks/useSEO';
import { supabase } from '@/integrations/supabase/client';
import { formatTimeAgo } from '@/lib/timeAgo';
import { chatOverview, chatPath, type ChatSummary, type ThreadRow } from './chats';
import { Row, Screen, Section } from './ui';

const preview = (s: ChatSummary, names: Record<string, string>) =>
  s.last ? `${names[s.last.user_id] || 'Anonym'}: ${s.last.text.replace(/\s+/g, ' ')}` : 'Inga meddelanden än. Starta samtalet!';

/** Chattar: every kommun's discussion in one place, yours first, then the liveliest right now */
const NativeChats = () => {
  useSEO({ title: 'Chattar | CrimeAlert', description: 'Prata med grannarna i din kommun.', noindex: true });
  const { user } = useAuth();
  const { kommuner, loading: prefsLoading } = useNotificationPreferences();
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

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

  if (!user) {
    return (
      <Screen title="Chattar">
        <p className="mx-5 -mt-1 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">Varje kommun har sin egen diskussion. Fråga, tipsa och berätta vad du såg.</p>
        <Section footer="Med ett gratis konto kan du läsa och skriva i kommunernas chattar.">
          <Row icon={LogIn} label="Logga in eller skapa konto" to="/auth" />
        </Section>
        <Section><Row icon={Search} iconBg="#636366" label="Hitta en kommun" to="/kommun" /></Section>
      </Screen>
    );
  }

  const { mine, active } = chatOverview(rows ?? [], kommuner);
  const loading = rows === null || prefsLoading;
  const row = (s: ChatSummary) => (
    <Row
      key={s.kommun}
      icon={MessagesSquare}
      iconBg={s.today ? '#ff453a' : '#3a3a3c'}
      label={<span className="flex items-center gap-2">{s.kommun}{s.today > 0 && <span className="rounded-full bg-[rgba(255,69,58,0.18)] px-1.5 text-[12px] font-semibold text-[#ff6961]">{s.today} idag</span>}</span>}
      detail={<span className="block truncate">{preview(s, names)}</span>}
      value={s.last ? <span className="text-[13px]">{formatTimeAgo(s.last.created_at).replace(' sedan', '')}</span> : undefined}
      to={chatPath(s.kommun)}
    />
  );

  return (
    <Screen title="Chattar">
      <p className="mx-5 -mt-1 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">Prata med grannarna: fråga, tipsa och berätta vad du såg.</p>

      <Section header="Dina kommuner" footer={!loading && !kommuner.length ? 'Bevaka en kommun under Profil → Kommuner och notiser, så hamnar den här.' : undefined}>
        {loading ? <Row label="Hämtar…" /> : mine.length ? mine.map(row) : <Row icon={Search} iconBg="#0a84ff" label="Välj en kommun att bevaka" to="/alerts" />}
      </Section>

      {active.length > 0 && <Section header="Mest aktiva just nu">{active.map(row)}</Section>}

      <Section footer="Inga namn på misstänkta, och inga hot. Anmäl det som bryter mot reglerna med flaggan vid kommentaren.">
        <Row icon={Search} iconBg="#636366" label="Hitta en kommun" detail="Alla 290 kommuner har en egen chatt" to="/kommun" />
      </Section>
    </Screen>
  );
};

export default NativeChats;
