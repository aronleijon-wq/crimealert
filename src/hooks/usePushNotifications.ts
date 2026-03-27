import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  getDevicePushInfo,
  getServiceWorkerDebugStatus,
  serializePushSubscription,
  uint8ArrayToBase64url,
  urlBase64ToUint8Array,
  waitForServiceWorkerReady,
  type DevicePushInfo,
  type ServiceWorkerDebugStatus,
} from '@/lib/push';

interface BackendPushConfig {
  vapidPublicKey: string | null;
  hasPublicKey: boolean;
  hasPrivateKey: boolean;
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
}

interface DatabaseSubscriptionRow {
  endpoint: string;
  created_at: string;
}

interface TestNotificationResult {
  sent?: number;
  subscriptionCount?: number;
  expired_cleaned?: number;
  results?: Array<{
    endpoint: string;
    ok: boolean;
    status: number | null;
    expired: boolean;
    error?: string;
  }>;
  error?: string;
}

const defaultServiceWorkerStatus: ServiceWorkerDebugStatus = {
  supported: false,
  registered: false,
  controller: false,
  scope: null,
  active: false,
  waiting: false,
  installing: false,
  scriptURL: null,
  state: null,
};

const defaultDeviceInfo: DevicePushInfo = {
  isIos: false,
  isStandalone: false,
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<ServiceWorkerDebugStatus>(defaultServiceWorkerStatus);
  const [deviceInfo, setDeviceInfo] = useState<DevicePushInfo>(defaultDeviceInfo);
  const [backendConfig, setBackendConfig] = useState<BackendPushConfig | null>(null);
  const [subscription, setSubscription] = useState<ReturnType<typeof serializePushSubscription> | null>(null);
  const [databaseSubscriptions, setDatabaseSubscriptions] = useState<DatabaseSubscriptionRow[]>([]);
  const [serviceWorkerMessages, setServiceWorkerMessages] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<TestNotificationResult | null>(null);

  const log = useCallback((message: string, details?: unknown) => {
    console.info(`[Push] ${message}`, details ?? '');
  }, []);

  const fetchBackendConfig = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-config`, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte hämta push-konfiguration.');
      }

      setBackendConfig(data);
      log('Hämtade push-konfiguration', data);
      return data as BackendPushConfig;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Okänt fel vid hämtning av push-konfiguration.';
      setLastError(message);
      console.error('[Push] Backend config error:', error);
      return null;
    }
  }, [log]);

  const fetchDatabaseSubscriptions = useCallback(async () => {
    if (!user) {
      setDatabaseSubscriptions([]);
      return [];
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Push] Database subscription fetch failed:', error);
      setLastError(error.message);
      return [];
    }

    setDatabaseSubscriptions(data ?? []);
    return data ?? [];
  }, [user]);

  const syncSubscriptionToDatabase = useCallback(async (activeUserId: string, activeSubscription: PushSubscription) => {
    const p256dh = activeSubscription.getKey('p256dh');
    const auth = activeSubscription.getKey('auth');

    if (!p256dh || !auth) {
      throw new Error('Push subscription saknar krypteringsnycklar.');
    }

    const payload = {
      user_id: activeUserId,
      endpoint: activeSubscription.endpoint,
      p256dh: uint8ArrayToBase64url(new Uint8Array(p256dh)),
      auth: uint8ArrayToBase64url(new Uint8Array(auth)),
    };

    log('Sparar subscription i databasen', {
      endpoint: payload.endpoint,
      hasP256dh: Boolean(payload.p256dh),
      hasAuth: Boolean(payload.auth),
    });

    const { error } = await supabase.from('push_subscriptions').upsert(payload, {
      onConflict: 'user_id,endpoint',
    });

    if (error) {
      throw error;
    }

    await fetchDatabaseSubscriptions();
    log('Subscription sparad i databasen', { endpoint: payload.endpoint });
  }, [fetchDatabaseSubscriptions, log]);

  const refreshStatus = useCallback(async () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    setDeviceInfo(getDevicePushInfo());
    setPermission(supported ? Notification.permission : 'default');
    setLastError(null);

    const config = await fetchBackendConfig();

    if (!supported) {
      setIsSubscribed(false);
      setSubscription(null);
      setServiceWorkerStatus(defaultServiceWorkerStatus);
      return;
    }

    const status = await getServiceWorkerDebugStatus();
    setServiceWorkerStatus(status);
    log('Service worker status', status);

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      setIsSubscribed(false);
      setSubscription(null);
      await fetchDatabaseSubscriptions();
      return;
    }

    const activeSubscription = await registration.pushManager.getSubscription();
    const serialized = serializePushSubscription(activeSubscription);

    setSubscription(serialized);
    setIsSubscribed(Boolean(activeSubscription));

    if (serialized) {
      log('Aktiv browser subscription hittad', serialized);
    } else {
      log('Ingen aktiv browser subscription hittad');
    }

    if (user && activeSubscription) {
      try {
        if (!config?.vapidPublicKey) {
          throw new Error('VAPID_PUBLIC_KEY saknas i backend-konfigurationen.');
        }

        await syncSubscriptionToDatabase(user.id, activeSubscription);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Kunde inte synka subscription.';
        setLastError(message);
        console.error('[Push] Sync error:', error);
      }
    } else {
      await fetchDatabaseSubscriptions();
    }
  }, [fetchBackendConfig, fetchDatabaseSubscriptions, log, syncSubscriptionToDatabase, user]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload?.source || payload.source !== 'sw-push') return;

      const line = `${payload.type}${payload.payload?.state ? ` — ${payload.payload.state}` : ''}`;
      log('Meddelande från service worker', payload);
      setServiceWorkerMessages((prev) => [line, ...prev].slice(0, 8));
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [log]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    setLoading(true);
    setLastError(null);

    try {
      const info = getDevicePushInfo();
      setDeviceInfo(info);

      if (info.isIos && !info.isStandalone) {
        throw new Error('På iPhone/iPad fungerar push bara i installerad app via “Lägg till på hemskärmen”.');
      }

      const config = backendConfig ?? await fetchBackendConfig();
      if (!config?.vapidPublicKey) {
        throw new Error('VAPID_PUBLIC_KEY saknas eller kunde inte hämtas från backend.');
      }

      const registration = await waitForServiceWorkerReady();
      log('Service worker redo för subscription', {
        scope: registration.scope,
        active: Boolean(registration.active),
      });

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      log('Notification permission', { permission: nextPermission });

      if (nextPermission !== 'granted') {
        return false;
      }

      // Always unsubscribe existing subscription and create a fresh one with current VAPID key
      // This fixes 403 errors when VAPID keys have been rotated
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        log('Avregistrerar gammal subscription för att säkerställa korrekt VAPID-nyckel');
        await existingSubscription.unsubscribe();
        // Clean up old DB entry
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', existingSubscription.endpoint);
      }

      const activeSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
      });

      log('Subscription-objekt skapat', activeSubscription.toJSON());
      await syncSubscriptionToDatabase(user.id, activeSubscription);
      await refreshStatus();

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte aktivera push-notiser.';
      setLastError(message);
      console.error('[Push] Subscribe error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [backendConfig, fetchBackendConfig, isSupported, log, refreshStatus, syncSubscriptionToDatabase, user]);

  const unsubscribe = useCallback(async () => {
    if (!user || !isSupported) return;

    setLoading(true);
    setLastError(null);

    try {
      const registration = await waitForServiceWorkerReady();
      const activeSubscription = await registration.pushManager.getSubscription();

      if (activeSubscription) {
        await activeSubscription.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', activeSubscription.endpoint);

        log('Subscription borttagen', { endpoint: activeSubscription.endpoint });
      }

      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte stänga av push-notiser.';
      setLastError(message);
      console.error('[Push] Unsubscribe error:', error);
    } finally {
      setLoading(false);
    }
  }, [isSupported, log, refreshStatus, user]);

  const sendTestNotification = useCallback(async () => {
    if (!user) {
      const result = { error: 'Du måste vara inloggad för att skicka en testnotis.' };
      setLastTestResult(result);
      return result;
    }

    setLoading(true);
    setLastError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Ingen aktiv session hittades.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: 'test' }),
      });

      const result = await response.json();
      setLastTestResult(result);
      log('Resultat från testnotis', result);

      if (!response.ok) {
        throw new Error(result.error || 'Testnotisen misslyckades.');
      }

      return result as TestNotificationResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte skicka testnotis.';
      setLastError(message);
      const result = { error: message };
      setLastTestResult(result);
      console.error('[Push] Test notification error:', error);
      return result;
    } finally {
      setLoading(false);
    }
  }, [log, user]);

  return {
    isSubscribed,
    isSupported,
    loading,
    permission,
    subscribe,
    unsubscribe,
    refreshStatus,
    serviceWorkerStatus,
    deviceInfo,
    backendConfig,
    subscription,
    databaseSubscriptions,
    serviceWorkerMessages,
    lastError,
    lastTestResult,
    sendTestNotification,
  };
}
