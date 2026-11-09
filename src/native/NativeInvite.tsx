import { useEffect, useState } from 'react';
import { Check, Gift, Link2, Share } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMyInvite } from '@/hooks/useMyInvite';
import { useSEO } from '@/hooks/useSEO';
import { daysLeftToEarn, friendsLabel, INVITE_DAYS, INVITE_MAX_FRIENDS, inviteUrl, redeemMessage } from '@/lib/invite';
import { copyLink } from '@/lib/share';
import { haptics } from './haptics';
import { NEVER, readNudges, saveNudges } from './nudges';
import { Row, Screen, Section } from './ui';

/** Bjud in vänner in the iPhone app (from 1.3), under Profil */
const NativeInvite = () => {
  useSEO({ title: 'Bjud in vänner | CrimeAlert', description: 'Få Pro genom att bjuda in vänner.', noindex: true });
  const { user } = useAuth();
  const { invite, loading, failed, share, redeem } = useMyInvite();
  const [copied, setCopied] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);

  // Here already: the card in Flöde waits its weeks, and once every friend has counted it stays away
  const maxed = (invite?.rewarded ?? 0) >= INVITE_MAX_FRIENDS;
  useEffect(() => {
    saveNudges({ ...readNudges(), inviteClosedAt: maxed ? NEVER : Date.now() });
  }, [maxed]);

  if (!user) {
    return (
      <Screen title="Bjud in vänner">
        <Section footer="Med ett konto får du en egen länk att bjuda in med.">
          <Row label="Logga in eller skapa konto" to="/auth" />
        </Section>
      </Screen>
    );
  }

  const onShare = async () => {
    haptics.impact('medium');
    const result = await share();
    if (result === 'copied') { setCopied(true); haptics.success(); }
  };
  const onCopy = async () => {
    if (!invite) return;
    if (await copyLink(inviteUrl(invite.code))) { setCopied(true); haptics.success(); }
  };
  const onRedeem = async () => {
    setBusy(true);
    const result = await redeem(typed);
    setBusy(false);
    setAnswer({ ok: result === 'ok', text: redeemMessage(result) });
    if (result === 'ok') { haptics.success(); setTyped(''); } else haptics.error();
  };

  const rewarded = invite?.rewarded ?? 0;
  const until = invite?.proUntil && Date.parse(invite.proUntil) > Date.now()
    ? new Date(invite.proUntil).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
    : null;

  return (
    <Screen title="Bjud in vänner">
      <div className="mx-4 mt-4 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#3a0d0b] via-[#1c1c1e] to-[#1c1c1e] p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#ff453a]">
          <Gift className="h-6 w-6 text-white" aria-hidden />
        </span>
        <p className="mt-4 text-[22px] font-bold leading-tight tracking-[-0.01em]">{INVITE_DAYS} dagar Pro för varje vän</p>
        <p className="mt-1.5 text-[15px] leading-snug text-[rgba(235,235,245,0.6)]">
          När en vän skapar ett konto via din länk får du {INVITE_DAYS} dagar Pro. Upp till {INVITE_MAX_FRIENDS} vänner, {INVITE_DAYS * INVITE_MAX_FRIENDS} dagar.
        </p>
        <div className="mt-5 flex gap-1" role="img" aria-label={friendsLabel(rewarded)}>
          {Array.from({ length: INVITE_MAX_FRIENDS }, (_, i) => (
            <span key={i} className={`h-[5px] flex-1 rounded-full transition-colors ${i < rewarded ? 'bg-[#ff453a]' : 'bg-white/15'}`} />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-[rgba(235,235,245,0.6)]">
          {friendsLabel(rewarded)}{until ? ` · Pro t.o.m. ${until}` : ''}
        </p>
        <button
          type="button"
          onClick={onShare}
          disabled={loading || !invite}
          className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff453a] text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          <Share className="h-5 w-5" aria-hidden /> Dela din länk
        </button>
      </div>

      {failed && !loading && <p className="mx-8 mt-3 text-[13px] text-[rgba(235,235,245,0.6)]">Din länk kunde inte hämtas just nu. Försök igen senare.</p>}

      {invite && (
        <Section header="Din länk" footer={daysLeftToEarn(rewarded) > 0 ? `${daysLeftToEarn(rewarded)} dagar kvar att få. Pro från inbjudningar tar slut av sig själv.` : 'Du har fått alla dagar. Tack för att du sprider CrimeAlert!'}>
          <Row
            icon={copied ? Check : Link2}
            iconBg={copied ? '#30d158' : '#0a84ff'}
            label={copied ? 'Kopierad' : 'Kopiera länken'}
            detail={<span className="block truncate">{inviteUrl(invite.code).replace('https://', '')}</span>}
            onClick={onCopy}
          />
        </Section>
      )}

      {invite?.canRedeem && (
        <Section header="Fick du en inbjudan?" footer={answer ? <span className={answer.ok ? 'text-[#30d158]' : undefined}>{answer.text}</span> : 'Ange koden från din väns länk, så får din vän sina dagar.'}>
          <form className="flex items-center gap-2 py-1.5 pl-4 pr-2" onSubmit={(e) => { e.preventDefault(); onRedeem(); }}>
            <input
              value={typed}
              onChange={(e) => { setTyped(e.target.value.slice(0, 12)); setAnswer(null); }}
              placeholder="Kod, t.ex. ABCD2345"
              aria-label="Inbjudningskod"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              className="h-9 min-w-0 flex-1 bg-transparent text-[17px] uppercase tracking-wider text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[rgba(235,235,245,0.3)]"
            />
            <button type="submit" disabled={busy || typed.trim().length < 8} className="h-9 rounded-full px-3 text-[15px] font-semibold text-[#ff453a] disabled:opacity-40">
              {busy ? 'Vänta…' : 'Använd'}
            </button>
          </form>
        </Section>
      )}
    </Screen>
  );
};

export default NativeInvite;
