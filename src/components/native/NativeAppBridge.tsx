import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { nativePush, nativePushTurnedOff, saveDeviceToken } from '@/lib/nativeApp';

/**
 * In the iPhone app: opens the page a tapped notification is about, and keeps this phone's
 * device token saved while notifications are on (Apple can change it, e.g. after a restore).
 */
const NativeAppBridge = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

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
