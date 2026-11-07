import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_NOTIFY_SETTINGS,
  settingsFromRow,
  settingsToRow,
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
  // The Sunday summary has its own column; hidden until its migration has run
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [weeklyAvailable, setWeeklyAvailable] = useState(false);
  // Kinds of crime, quiet hours and the circle have columns of their own; hidden until they exist
  const [moreAvailable, setMoreAvailable] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_NOTIFY_SETTINGS);
      setAvailable(false);
      setWeeklyAvailable(false);
      setMoreAvailable(false);
      return;
    }
    let cancelled = false;
    const table = () => supabase.from('notification_settings') as unknown as {
      select(columns: string): { eq(c: string, v: string): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }> } };
    };
    table()
      .select('types, min_risk, themes, quiet_start, quiet_end, near_lat, near_lng, near_radius_km')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (!error) {
          setAvailable(true);
          setMoreAvailable(true);
          setSettings(settingsFromRow(data));
          return;
        }
        // Before the newer columns exist: the types and risk only
        const basic = await table().select('types, min_risk').eq('user_id', user.id).maybeSingle();
        if (cancelled) return;
        setAvailable(!basic.error);
        setSettings(settingsFromRow(basic.data));
      });
    supabase
      .from('notification_settings')
      .select('weekly_summary')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setWeeklyAvailable(!error);
        setWeeklySummary(data?.weekly_summary !== false);
      });
    return () => { cancelled = true; };
  }, [user]);

  /** Saves the new settings; returns false (and restores the old ones) if that failed. */
  const save = useCallback(async (next: NotifySettings) => {
    if (!user) return false;
    const previous = settings;
    setSettings(next);
    setSaving(true);
    const row = settingsToRow(next);
    const { error } = await supabase.from('notification_settings').upsert({
      user_id: user.id,
      ...(moreAvailable ? row : { types: row.types, min_risk: row.min_risk }),
      updated_at: new Date().toISOString(),
    } as never);
    setSaving(false);
    if (error) setSettings(previous);
    return !error;
  }, [settings, user, moreAvailable]);

  /** Turns the Sunday summary on or off; returns false (and restores it) if that failed. */
  const saveWeekly = useCallback(async (next: boolean) => {
    if (!user) return false;
    setWeeklySummary(next);
    setSaving(true);
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: user.id, weekly_summary: next, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) setWeeklySummary(!next);
    return !error;
  }, [user]);

  return { settings, available, moreAvailable, saving, save, weeklySummary, weeklyAvailable, saveWeekly };
}
