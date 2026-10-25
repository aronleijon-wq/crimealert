import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Info, LogIn, Mail, Shield, Star, UserRound, Zap } from 'lucide-react';
import BlockedUsers from '@/components/account/BlockedUsers';
import DeleteAccount from '@/components/account/DeleteAccount';
import { planLabel } from '@/components/account/plans';
import { CONTACT_EMAIL } from '@/components/landing/faqItems';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { useSEO } from '@/hooks/useSEO';
import { supabase } from '@/integrations/supabase/client';
import { BLOCKED_WORDS_MESSAGE, hasBlockedWords, isBlockedWordsError } from '@/lib/moderation';
import { TRUSTPILOT_REVIEW_URL } from '@/lib/trustpilot';
import { Row, Screen, Section } from './ui';

/** Changing the name shown with comments, as an iOS alert with a text field */
const NameSheet = ({ userId, current, onDone }: { userId: string; current: string; onDone: (name: string | null) => void }) => {
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const name = draft.trim().slice(0, 30);
    if (!name) return;
    if (hasBlockedWords(name)) { setError(BLOCKED_WORDS_MESSAGE); return; }
    setSaving(true);
    const { error: e } = await supabase.from('profiles').upsert({ id: userId, display_name: name });
    setSaving(false);
    if (e) { setError(isBlockedWordsError(e) ? BLOCKED_WORDS_MESSAGE : 'Kunde inte spara. Försök igen.'); return; }
    onDone(name);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Användarnamn" className="ios fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 px-12">
      <div className="w-full max-w-[270px] overflow-hidden rounded-[14px] bg-[#2c2c2e]/95 text-center backdrop-blur-xl">
        <div className="px-4 pb-4 pt-5">
          <p className="text-[17px] font-semibold">Användarnamn</p>
          <p className="mt-1 text-[13px] text-white/80">Visas vid dina kommentarer.</p>
          <input autoFocus value={draft} maxLength={30} onChange={(e) => { setDraft(e.target.value); setError(null); }} onKeyDown={(e) => e.key === 'Enter' && save()} className="mt-3 h-8 w-full rounded-[7px] border border-white/10 bg-[#1c1c1e] px-2 text-[15px] text-white outline-none" />
          {error && <p className="mt-2 text-[13px] text-[#ff453a]">{error}</p>}
        </div>
        <div className="flex border-t border-white/15">
          <button type="button" onClick={() => onDone(null)} className="h-11 flex-1 border-r border-white/15 text-[17px] text-[#ff453a]">Avbryt</button>
          <button type="button" onClick={save} disabled={saving || !draft.trim()} className="h-11 flex-1 text-[17px] font-semibold text-[#ff453a] disabled:opacity-50">Spara</button>
        </div>
      </div>
    </div>
  );
};

/** Profil in the iPhone app: the account and settings, as in the Settings app. */
const NativeProfile = () => {
  useSEO({ title: 'Profil | CrimeAlert', description: 'Ditt konto.', noindex: true });
  const navigate = useNavigate();
  const { user, subscription, signOut } = useAuth();
  const { isPremium } = useIsPremium();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle().then(({ data }) => setName(data?.display_name ?? ''));
  }, [user]);

  const leave = async () => {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
    navigate('/karta');
  };

  const about = (
    <>
      <Section header="Hjälp">
        <Row icon={Mail} iconBg="#0a84ff" label="Kontakta oss" href={`mailto:${CONTACT_EMAIL}?subject=CrimeAlert`} />
        <Row icon={Star} iconBg="#ff9f0a" label="Betygsätt CrimeAlert" href={TRUSTPILOT_REVIEW_URL} />
      </Section>
      <Section header="Om CrimeAlert">
        <Row icon={Info} iconBg="#8e8e93" label="Om oss" to="/om-oss" />
        <Row icon={FileText} iconBg="#8e8e93" label="Användarvillkor" to="/villkor" />
        <Row icon={Shield} iconBg="#8e8e93" label="Sekretesspolicy" to="/sekretesspolicy" />
      </Section>
    </>
  );

  if (!user) {
    return (
      <Screen title="Profil">
        <Section footer="Med ett gratis konto väljer du kommuner att bevaka och får notiser.">
          <Row icon={LogIn} label="Logga in eller skapa konto" to="/auth" />
        </Section>
        <Section>
          <Row icon={Zap} label="CrimeAlert Pro" to="/prisplan" />
        </Section>
        {about}
      </Screen>
    );
  }

  const shown = name || user.email?.split('@')[0] || 'Ditt konto';

  return (
    <Screen title="Profil">
      <Section>
        <div className="flex items-center gap-3.5 px-4 py-3">
          <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#8e8e93] to-[#636366] text-[26px] font-semibold">
            {shown.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[20px] font-semibold">{shown}</span>
            <span className="block truncate text-[15px] text-[rgba(235,235,245,0.6)]">{user.email}</span>
          </span>
        </div>
      </Section>

      <Section>
        <Row icon={Zap} label="CrimeAlert Pro" value={isPremium ? planLabel(true, subscription).replace(/^Pro /, '') : 'Skaffa'} to="/prisplan" />
      </Section>

      <Section header="Konto">
        <Row icon={UserRound} iconBg="#5e5ce6" label="Användarnamn" value={name || 'Inget'} onClick={() => setEditing(true)} />
      </Section>

      <Section header="Integritet">
        <BlockedUsers userId={user.id} />
      </Section>

      {about}

      <Section>
        <Row label={signingOut ? 'Loggar ut…' : 'Logga ut'} destructive center onClick={leave} />
      </Section>
      <div className="mt-6"><DeleteAccount /></div>

      {editing && <NameSheet userId={user.id} current={name} onDone={(n) => { if (n !== null) setName(n); setEditing(false); }} />}
    </Screen>
  );
};

export default NativeProfile;
