// What only the iPhone app can do, through its own plugins (ios/App/App/AppDelegate.swift):
// notifications through Apple (APNs), and signing in with Google or Apple in Apple's sign-in
// sheet. App versions from before the plugins report them unavailable, and the site falls back.
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/lib/native';

export type NativePermission = 'granted' | 'denied' | 'prompt';

interface PushPlugin {
  checkPermission(): Promise<{ permission: NativePermission }>;
  requestPermission(): Promise<{ permission: NativePermission }>;
  register(): Promise<{ token: string; environment: 'sandbox' | 'production' }>;
  addListener(event: 'opened', listener: (data: { url?: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

interface AuthPlugin {
  signIn(options: { url: string }): Promise<{ url: string }>;
}

const plugins = new Map<string, Promise<unknown>>();

// @capacitor/core is loaded only in the app, so the website doesn't carry it
function plugin<T>(name: string): Promise<T | null> {
  if (!isNativeApp()) return Promise.resolve(null);
  if (!plugins.has(name)) {
    plugins.set(name, import('@capacitor/core')
      .then(({ Capacitor, registerPlugin }) => (Capacitor.isPluginAvailable(name) ? registerPlugin<T>(name) : null))
      .catch(() => null));
  }
  return plugins.get(name) as Promise<T | null>;
}

export const nativePush = () => plugin<PushPlugin>('CrimeAlertPush');
export const nativeAuth = () => plugin<AuthPlugin>('CrimeAlertAuth');

// The app's device tokens live with the web push subscriptions, as "apns:<environment>:<token>",
// so every notification the site sends reaches the app too (send-push-notifications)
export const apnsEndpoint = (token: string, environment: string) => `apns:${environment}:${token}`;

const ENDPOINT_KEY = 'ca-apns-endpoint';
const OFF_KEY = 'ca-native-push-off';

const read = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* private mode: the device is asked again next time */ }
};

/** Whether the user turned notifications off on this phone (iOS permission aside) */
export const nativePushTurnedOff = () => read(OFF_KEY) === '1';

/** Saves this phone's device token for the user; asks iOS for it, which needs permission. */
export async function saveDeviceToken(userId: string) {
  const push = await nativePush();
  if (!push) throw new Error('Appen saknar stöd för notiser.');
  const { token, environment } = await push.register();
  const endpoint = apnsEndpoint(token, environment);
  const previous = read(ENDPOINT_KEY);
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: '', auth: '' },
    { onConflict: 'user_id,endpoint' },
  );
  if (error) throw error;
  // A new token replaces the old one; the old one would only fail
  if (previous && previous !== endpoint) await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', previous);
  write(ENDPOINT_KEY, endpoint);
  write(OFF_KEY, null);
}

/** Stops notifications to this phone for the user, until they turn them on again. */
export async function forgetDeviceToken(userId: string, turnedOff: boolean) {
  const endpoint = read(ENDPOINT_KEY);
  if (turnedOff) write(OFF_KEY, '1');
  if (!endpoint) return;
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}

/** The address the app's sign-in sheet opens; the page signs in and returns to the app */
export const appLoginUrl = (provider: 'google' | 'apple') => `https://crimealert.se/app-login?provider=${provider}`;

/**
 * Signs in with Google or Apple in Apple's sign-in sheet, then here. Returns false when the
 * user closed the sheet.
 */
export async function signInInApp(provider: 'google' | 'apple'): Promise<boolean> {
  const auth = await nativeAuth();
  if (!auth) throw new Error('Uppdatera appen för att logga in med Google eller Apple.');
  let callback: string;
  try {
    ({ url: callback } = await auth.signIn({ url: appLoginUrl(provider) }));
  } catch (error) {
    if ((error as { code?: string }).code === 'CANCELLED') return false;
    throw error;
  }
  const params = new URLSearchParams(callback.split('#')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error(params.get('error') ?? 'Inloggningen misslyckades.');
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
}
