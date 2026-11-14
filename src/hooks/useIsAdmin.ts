import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/** Whether the signed-in user has the admin role (user_roles). False while unknown or signed out. */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let live = true;
    Promise.resolve()
      .then(() => supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle())
      .then(({ data }) => { if (live) setIsAdmin(!!data); })
      .catch(() => { if (live) setIsAdmin(false); });
    return () => { live = false; };
  }, [user]);

  return isAdmin;
}
