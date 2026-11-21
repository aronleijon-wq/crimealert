import { useState } from 'react';
import { Gift, Share2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMyInvite } from '@/hooks/useMyInvite';
import { daysLeftToEarn, INVITE_DAYS } from '@/lib/invite';

const DISMISS_KEY = 'ca-invite-banner-dismissed';

/**
 * "Få 7 dagar Pro per vän" over the bottom of the map, for signed-in users who still
 * have days to earn. Closing it with X keeps it away on this device (localStorage).
 */
const InviteBanner = () => {
  const { toast } = useToast();
  const { invite, loading, share } = useMyInvite();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
    setDismissed(true);
  };

  const onShare = async () => {
    const result = await share();
    if (result === 'copied') toast({ title: 'Länken är kopierad', description: 'Skicka den till dina vänner.' });
    else if (result === 'failed') toast({ title: 'Kunde inte dela', description: 'Försök igen.', variant: 'destructive' });
  };

  if (dismissed || loading || !invite || daysLeftToEarn(invite.rewarded) <= 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[1100] flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Gift className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-foreground">Få {INVITE_DAYS} dagar Pro per vän</p>
          <p className="truncate text-[11px] text-muted-foreground">Dela din länk – varje vän som går med ger dig Pro</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Share2 className="h-4 w-4" aria-hidden /> Dela
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Stäng"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default InviteBanner;
