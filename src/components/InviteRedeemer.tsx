import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { forgetInvite, pendingInvite, redeemInvite, redeemIsFinal } from '@/lib/invite';

/**
 * Uses a friend's code remembered from their link (pages/Inbjudan) once there is an account
 * with a confirmed e-mail: at sign-in, and at every start until then. Draws nothing.
 */
const InviteRedeemer = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const tried = useRef<string | null>(null);
  // The invite page uses the code itself, and shows the answer
  const onInvitePage = pathname.startsWith('/inbjudan/');

  useEffect(() => {
    const code = pendingInvite();
    if (!user || !code || onInvitePage) return;
    // Once per account and start; a new e-mail confirmation comes with a new start or sign-in
    const key = `${user.id}:${code}:${user.email_confirmed_at ?? ''}`;
    if (tried.current === key) return;
    tried.current = key;
    redeemInvite(code).then((result) => {
      if (redeemIsFinal(result)) forgetInvite();
      if (result === 'ok') {
        toast({ title: 'Välkommen till CrimeAlert', description: 'Din vän fick 7 dagar Pro tack vare dig. Under Profil hittar du en egen länk att bjuda in med.' });
      }
    });
  }, [user, onInvitePage]);

  return null;
};

export default InviteRedeemer;
