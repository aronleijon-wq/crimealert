import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_NOTIFY_SETTINGS,
  settingsFromRow,
  type NotifySettings,
} from '../../supabase/functions/_shared/notifications';

/**
 * The user's choice of what to get push notifications about. `available` is false when the
 * settings can't be read (e.g. before the table exists), and the page then hides the choice.
 */
export function useNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotifySettings>(DEFAULT_NOTIFY_SETTINGS);
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_NOTIFY_SETTINGS);
      setAvailable(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('notification_settings')
      .select('types, min_risk')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setAvailable(!error);
        setSettings(settingsFromRow(data));
      });
    return () => { cancelled = true; };
  }, [user]);

  /** Saves the new settings; returns false (and restores the old ones) if that failed. */
  const save = useCallback(async (next: NotifySettings) => {
    if (!user) return false;
    const previous = settings;
    setSettings(next);
    setSaving(true);
    const { error } = await supabase.from('notification_settings').upsert({
      user_id: user.id,
      types: next.types,
      min_risk: next.minRisk,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) setSettings(previous);
    return !error;
  }, [settings, user]);

  return { settings, available, saving, save };
}
