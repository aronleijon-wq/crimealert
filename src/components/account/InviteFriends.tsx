import { useState } from 'react';
import { Copy, Gift, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMyInvite } from '@/hooks/useMyInvite';
import { daysLeftToEarn, friendsLabel, INVITE_DAYS, INVITE_MAX_FRIENDS, inviteUrl, redeemMessage } from '@/lib/invite';

/** Eight bars, one per friend, filled for those who joined */
export const InviteProgress = ({ rewarded, className = '' }: { rewarded: number; className?: string }) => (
  <div className={`flex gap-1 ${className}`} role="img" aria-label={friendsLabel(rewarded)}>
    {Array.from({ length: INVITE_MAX_FRIENDS }, (_, i) => (
      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < rewarded ? 'bg-primary' : 'bg-[hsl(var(--ca-panel-3))]'}`} />
    ))}
  </div>
);

/** "Bjud in vänner" on the website's Profil page (Installningar) */
const InviteFriends = () => {
  const { toast } = useToast();
  const { invite, loading, failed, share, redeem } = useMyInvite();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const onShare = async () => {
    const result = await share();
    if (result === 'copied') toast({ title: 'Länken är kopierad', description: 'Skicka den till dina vänner.' });
    else if (result === 'failed') toast({ title: 'Kunde inte dela', description: 'Försök igen.', variant: 'destructive' });
  };
  const onCopy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.code));
      toast({ title: 'Länken är kopierad' });
    } catch {
      toast({ title: 'Kunde inte kopiera', variant: 'destructive' });
    }
  };
  const onRedeem = async () => {
    setBusy(true);
    const result = await redeem(typed);
    setBusy(false);
    setAnswer(redeemMessage(result));
    if (result === 'ok') setTyped('');
  };

  const until = invite?.proUntil && Date.parse(invite.proUntil) > Date.now() ? invite.proUntil.slice(0, 10) : null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-foreground">Få {INVITE_DAYS} dagar Pro per vän</p>
          <p className="mt-0.5 text-[13px] leading-snug text-[hsl(var(--ca-text-2))]">
            Varje vän som skapar ett konto via din länk ger dig {INVITE_DAYS} dagar Pro, för upp till {INVITE_MAX_FRIENDS} vänner. Dagarna läggs ihop och Pro tar slut av sig själv.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--ca-panel-2))]" aria-hidden />
      ) : failed || !invite ? (
        <p className="text-[13px] text-[hsl(var(--ca-text-2))]">Din länk kunde inte hämtas just nu. Försök igen senare.</p>
      ) : (
        <>
          <div>
            <InviteProgress rewarded={invite.rewarded} />
            <p className="mt-2 text-[13px] text-[hsl(var(--ca-text-2))]">
              {friendsLabel(invite.rewarded)}
              {until ? ` · Pro t.o.m. ${until}` : ''}
              {daysLeftToEarn(invite.rewarded) > 0 ? ` · ${daysLeftToEarn(invite.rewarded)} dagar kvar att få` : ' · Alla dagar intjänade, tack!'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-[hsl(var(--ca-line-strong))] bg-[hsl(var(--ca-panel-2))] px-3 py-2.5 text-[13px] text-foreground">
              {inviteUrl(invite.code).replace('https://', '')}
            </code>
            <button type="button" onClick={onCopy} aria-label="Kopiera länken" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--ca-line-strong))] text-foreground transition hover:border-primary/50">
              <Copy className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" onClick={onShare} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
              <Share2 className="h-4 w-4" aria-hidden /> Dela
            </button>
          </div>

          {invite.canRedeem && (
            <form className="border-t border-[hsl(var(--ca-line))] pt-4" onSubmit={(e) => { e.preventDefault(); onRedeem(); }}>
              <label htmlFor="invite-code" className="block text-[13px] font-medium text-foreground">Fick du en inbjudan? Ange koden</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="invite-code"
                  value={typed}
                  onChange={(e) => { setTyped(e.target.value.slice(0, 12)); setAnswer(null); }}
                  placeholder="ABCD2345"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-[hsl(var(--ca-line-strong))] bg-background px-3 font-mono text-sm uppercase tracking-widest text-foreground outline-none focus:border-primary/60"
                />
                <button type="submit" disabled={busy || typed.trim().length < 8} className="h-10 rounded-xl border border-[hsl(var(--ca-line-strong))] px-4 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:opacity-50">
                  {busy ? 'Vänta…' : 'Använd'}
                </button>
              </div>
              {answer && <p role="status" className="mt-2 text-[13px] text-[hsl(var(--ca-text-2))]">{answer}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default InviteFriends;
