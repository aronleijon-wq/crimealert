// The CrimeAlert iPhone app (ios/, capacitor.config.ts) is a native shell around crimealert.se.
// The site knows it runs there by Capacitor's bridge, or by "CrimeAlertApp" in the user agent,
// which is there from the first request. Inside the app the site follows Apple's rules: no
// AdSense, no Pro sales outside Apple's own payments, no Google sign-in in an embedded web view.

type CapacitorWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as CapacitorWindow).Capacitor?.isNativePlatform?.()) return true;
  return typeof navigator !== 'undefined' && /\bCrimeAlertApp\b/.test(navigator.userAgent);
}

/** Pro is sold with Stripe on the web only; the app neither sells it nor points to where it is sold. */
export const canSellPro = () => !isNativeApp();
