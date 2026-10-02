import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [kommuner, setKommuner] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

  const addKommun = async (kommun: string) => {
    if (!user) return;
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

  return { kommuner, loading, addKommun, removeKommun, refetch: fetchPreferences };
}
