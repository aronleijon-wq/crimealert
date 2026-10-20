// The CrimeAlert iPhone app (ios/, capacitor.config.ts) is a native shell around crimealert.se.
// The site knows it runs there by Capacitor's bridge, or by "CrimeAlertApp" in the user agent,
// which is there from the first request. Inside the app the site follows Apple's rules: no
// AdSense, Pro sold only through Apple, no Google sign-in in an embedded web view.

type CapacitorWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean } };

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as CapacitorWindow).Capacitor?.isNativePlatform?.()) return true;
  return typeof navigator !== 'undefined' && /\bCrimeAlertApp\b/.test(navigator.userAgent);
}

/** Whether this app version can buy Pro through the App Store (CrimeAlertStorePlugin, lib/appStore). */
export const appStoreAvailable = () =>
  isNativeApp() && typeof window !== 'undefined' && !!(window as CapacitorWindow).Capacitor?.isPluginAvailable?.('CrimeAlertStore');

/**
 * Whether to offer Pro: on the web with Stripe, in the app through Apple (/prisplan is Apple's
 * purchase there). App versions from before that neither sell it nor point to where it is sold.
 */
export const canSellPro = () => !isNativeApp() || appStoreAvailable();
