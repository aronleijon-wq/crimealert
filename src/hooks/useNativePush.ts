import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { testFailureReason, type TestAnswer } from '@/lib/pushDiagnostics';
import { forgetDeviceToken, nativePush, nativePushTurnedOff, saveDeviceToken } from '@/lib/nativeApp';

const toPermission = (p: string): NotificationPermission => (p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default');

/**
 * Notifications in the iPhone app, through Apple: the same shape as usePushNotifications so the
 * notifications page can use either. `available` is false in app versions without the plugin.
 */
export function useNativePush(enabled = true) {
  const { user } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const userId = user?.id;

  const refreshStatus = useCallback(async () => {
    const push = await nativePush();
    setAvailable(Boolean(push));
    if (!push) return;
    const next = toPermission((await push.checkPermission()).permission);
    setPermission(next);
    if (next === 'granted' && userId && !nativePushTurnedOff()) {
      try {
        await saveDeviceToken(userId);
        setIsSubscribed(true);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Kunde inte spara enheten.');
        setIsSubscribed(false);
      }
    } else {
      setIsSubscribed(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    refreshStatus().catch(() => setAvailable(false)).finally(() => setChecked(true));
  }, [enabled, refreshStatus]);

  const subscribe = useCallback(async () => {
    const push = await nativePush();
    if (!push || !userId) return false;
    setLoading(true);
    setLastError(null);
    try {
      const next = toPermission((await push.requestPermission()).permission);
      setPermission(next);
      if (next !== 'granted') return false;
      await saveDeviceToken(userId);
      setIsSubscribed(true);
      return true;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Kunde inte slå på notiser.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await forgetDeviceToken(userId, true);
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const sendTestNotification = useCallback(async (url = '/alerts') => {
    setLoading(true);
    setLastError(null);
    try {
      const { data, error } = await supabase.functions.invoke<TestAnswer>('send-push-notifications', {
        body: { mode: 'test', url },
      });
      // A refusal (no device saved) comes as an error with the answer in its response
      let answer: TestAnswer | null = data;
      const context = (error as { context?: Response } | null)?.context;
      if (!answer && context?.json) answer = await context.json().catch(() => null);
      const reason = testFailureReason(answer);
      if (reason) throw new Error(reason);
      return answer ?? {};
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte skicka testnotis.';
      setLastError(message);
      return { error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { available, checked, permission, isSubscribed, loading, lastError, subscribe, unsubscribe, sendTestNotification };
}
