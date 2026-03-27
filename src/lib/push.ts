export interface ServiceWorkerDebugStatus {
  supported: boolean;
  registered: boolean;
  controller: boolean;
  scope: string | null;
  active: boolean;
  waiting: boolean;
  installing: boolean;
  scriptURL: string | null;
  state: string | null;
}

export interface DevicePushInfo {
  isIos: boolean;
  isStandalone: boolean;
}

export const PUSH_ICON_PATH = '/pwa-192x192.png';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function uint8ArrayToBase64url(array: Uint8Array): string {
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getDevicePushInfo(): DevicePushInfo {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = /iPad|iPhone|iPod/i.test(userAgent);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  return { isIos, isStandalone };
}

export async function getServiceWorkerDebugStatus(): Promise<ServiceWorkerDebugStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return {
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
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.active ?? registration?.waiting ?? registration?.installing ?? null;

  return {
    supported: true,
    registered: Boolean(registration),
    controller: Boolean(navigator.serviceWorker.controller),
    scope: registration?.scope ?? null,
    active: Boolean(registration?.active),
    waiting: Boolean(registration?.waiting),
    installing: Boolean(registration?.installing),
    scriptURL: worker?.scriptURL ?? null,
    state: worker?.state ?? null,
  };
}

export function serializePushSubscription(subscription: PushSubscription | null) {
  return subscription?.toJSON() ?? null;
}

export async function waitForServiceWorkerReady(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const existingRegistration = await navigator.serviceWorker.getRegistration();

  if (existingRegistration?.active) {
    return existingRegistration;
  }

  return await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      window.setTimeout(() => reject(new Error('Service worker blev inte aktiv i tid.')), timeoutMs);
    }),
  ]);
}
