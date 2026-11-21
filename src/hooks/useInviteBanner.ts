import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMyInvite } from '@/hooks/useMyInvite';
import { daysLeftToEarn } from '@/lib/invite';

// A new key for the strip at the top, so it shows once to those who closed the old banner at the bottom
const DISMISS_KEY = 'ca-invite-strip-closed';
/** Height of the strip, so the page below can make room for it */
export const INVITE_BANNER_HEIGHT = 44;

/**
 * Whether the invite strip shows: signed in on the web, with friends left to invite, and not
 * closed on this device. Where it shows, it takes the iPhone banner's place at the top.
 */
export function useInviteBanner(enabled = true) {
  const { toast } = useToast();
  const { invite, loading, share } = useMyInvite();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode: closes on this page only */ }
    setDismissed(true);
  }, []);
  const onShare = useCallback(async () => {
    const result = await share();
    if (result === 'copied') toast({ title: 'Länken är kopierad', description: 'Skicka den till dina vänner.' });
    else if (result === 'failed') toast({ title: 'Kunde inte dela', description: 'Försök igen.', variant: 'destructive' });
  }, [share, toast]);
  const visible = enabled && !dismissed && !loading && !!invite && daysLeftToEarn(invite.rewarded) > 0;
  return { visible, rewarded: invite?.rewarded ?? 0, share: onShare, dismiss };
}
