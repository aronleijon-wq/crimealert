import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { nativeStore, syncApplePurchases } from '@/lib/appStore';
import { nativePush, nativePushTurnedOff, saveDeviceToken } from '@/lib/nativeApp';

/**
 * In the iPhone app: opens the page a tapped notification is about, keeps this phone's device
 * token saved while notifications are on (Apple can change it, e.g. after a restore), and has
 * the server check the Pro subscriptions the phone holds: at start, and when one renews.
 */
const START_SYNC_KEY = 'ca-apple-sync-at';
const START_SYNC_EVERY_MS = 12 * 60 * 60 * 1000;

const startSyncDue = () => {
  try {
    if (Date.now() - Number(localStorage.getItem(START_SYNC_KEY) ?? 0) < START_SYNC_EVERY_MS) return false;
    localStorage.setItem(START_SYNC_KEY, String(Date.now()));
  } catch { /* no storage: check each start */ }
  return true;
};

const NativeAppBridge = () => {
  const navigate = useNavigate();
  const { user, checkSubscription } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    let remove: (() => void) | undefined;
    const sync = (ids: string[]) =>
      syncApplePurchases(ids).then(() => live && checkSubscription()).catch(() => {});
    nativeStore()
      .then(async (store) => {
        if (!store) return;
        // Apple's notices keep the server current; this is a check now and then, not every start
        const { transactionIds } = await store.entitlements();
        if (transactionIds.length && startSyncDue()) sync(transactionIds);
        const handle = await store.addListener('transaction', ({ transactionId }) => sync([transactionId]));
        if (live) remove = () => { handle.remove(); };
        else handle.remove();
      })
      .catch(() => {});
    return () => { live = false; remove?.(); };
    // checkSubscription changes on every render of the auth provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    let live = true;
    let remove: (() => void) | undefined;
    nativePush()
      .then((push) => push?.addListener('opened', ({ url }) => {
        if (url?.startsWith('/') && !url.startsWith('//')) navigate(url);
      }))
      .then((handle) => {
        if (!handle) return;
        if (live) remove = () => { handle.remove(); };
        else handle.remove();
      })
      .catch(() => {});
    return () => { live = false; remove?.(); };
  }, [navigate]);

  useEffect(() => {
    if (!userId || nativePushTurnedOff()) return;
    nativePush()
      .then(async (push) => {
        if (push && (await push.checkPermission()).permission === 'granted') await saveDeviceToken(userId);
      })
      .catch(() => {});
  }, [userId]);

  return null;
};

export default NativeAppBridge;
