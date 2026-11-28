import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';
import { FREE_KOMMUN_LIMIT } from '../../supabase/functions/_shared/planFacts';

/** What addKommun gives back when a free account already watches as many kommuner as it may */
export const KOMMUN_LIMIT_ERROR = 'kommun_limit';
export const isKommunLimit = (error: { message?: string } | null | undefined) => !!error?.message?.includes(KOMMUN_LIMIT_ERROR);

export function useNotificationPreferences() {
  const { user, subscriptionChecked } = useAuth();
  const { isPremium } = useIsPremium();
  const [kommuner, setKommuner] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // Free accounts watch up to FREE_KOMMUN_LIMIT kommuner (the database holds to it too); while the
  // plan is not known yet nothing is stopped here, and the database decides
  const limit = isPremium ? null : FREE_KOMMUN_LIMIT;
  const atLimit = subscriptionChecked && limit !== null && kommuner.length >= limit;

  const fetchPreferences = useCallback(async () => {
    if (!user) { setKommuner([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('notification_preferences')
      .select('kommun')
      .eq('user_id', user.id);
    setKommuner(data?.map((d) => d.kommun) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

  const addKommun = async (kommun: string): Promise<{ message: string } | null | undefined> => {
    if (!user) return;
    if (atLimit) return { message: KOMMUN_LIMIT_ERROR };
    const { error } = await supabase
      .from('notification_preferences')
      .insert({ user_id: user.id, kommun });
    if (!error) setKommuner((prev) => [...prev, kommun]);
    return error;
  };

  const removeKommun = async (kommun: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', user.id)
      .eq('kommun', kommun);
    if (!error) setKommuner((prev) => prev.filter((k) => k !== kommun));
    return error;
  };

  return { kommuner, loading, addKommun, removeKommun, refetch: fetchPreferences, limit, atLimit };
}
