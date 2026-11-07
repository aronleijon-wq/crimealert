import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { forgetInvite, inviteShareText, inviteUrl, loadMyInvite, normalizeInviteCode, redeemInvite, type MyInvite, type RedeemResult } from '@/lib/invite';
import { copyLink } from '@/lib/share';

export type InviteShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The signed-in user's own invite link, and using a friend's code (lib/invite) */
export function useMyInvite() {
  const { user, checkSubscription } = useAuth();
  const [invite, setInvite] = useState<MyInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setInvite(null); setLoading(false); return; }
    setLoading(true);
    const mine = await loadMyInvite().catch(() => null);
    setInvite(mine);
    setFailed(!mine);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  /** The share sheet with the link, or the link copied where there is none */
  const share = useCallback(async (): Promise<InviteShareResult> => {
    if (!invite) return 'failed';
    const url = inviteUrl(invite.code);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'CrimeAlert', text: inviteShareText, url });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      }
    }
    return (await copyLink(url)) ? 'copied' : 'failed';
  }, [invite]);

  /** Using a friend's code, typed in */
  const redeem = useCallback(async (typed: string): Promise<RedeemResult> => {
    const code = normalizeInviteCode(typed);
    if (!code) return 'invalid';
    const result = await redeemInvite(code);
    if (result === 'ok') {
      forgetInvite();
      await reload();
    }
    // Your own Pro may have changed if you were the one who invited
    checkSubscription().catch(() => {});
    return result;
  }, [reload, checkSubscription]);

  return { invite, loading, failed, reload, share, redeem };
}
