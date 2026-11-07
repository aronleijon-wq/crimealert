// The CrimeAlert iPhone app (ios/, capacitor.config.ts) is a native shell around crimealert.se.
// The site knows it runs there by Capacitor's bridge, or by "CrimeAlertApp" in the user agent,
// which is there from the first request. Inside the app the site follows Apple's rules: no
// AdSense, Pro sold only through Apple, no Google sign-in in an embedded web view.

type CapacitorWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean } };

/**
 * The app's version, from "CrimeAlertApp/1.3" in its user agent (capacitor.config.ts). Null on
 * the web and in app versions up to 1.2, which only say "CrimeAlertApp".
 */
export function nativeAppVersion(): number[] | null {
  if (typeof navigator === 'undefined') return null;
  const match = /\bCrimeAlertApp\/(\d+(?:\.\d+)*)/.exec(navigator.userAgent);
  return match ? match[1].split('.').map(Number) : null;
}

/** Whether this is the app at the given version or later ("1.3") */
export function appVersionAtLeast(version: string): boolean {
  const have = nativeAppVersion();
  if (!have) return false;
  const want = version.split('.').map(Number);
  for (let i = 0; i < Math.max(have.length, want.length); i++) {
    const a = have[i] ?? 0;
    const b = want[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/**
 * The app's own iPhone design from version 1.3 (src/native): a full-screen map with a sheet, a
 * new welcome and haptics. Older app versions keep the look they were reviewed with.
 */
export const hasAppDesign13 = () => isNativeApp() && appVersionAtLeast('1.3');

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
