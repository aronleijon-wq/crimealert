// Google Ads tag + conversions, gated on the visitor's choice in CrimeAlert's own cookie box
// (components/CookieBanner), and only in the EU and the other regions that need consent.
//
// Off for now. To run Google Ads: set GOOGLE_ADS_ENABLED to true here and CA_GOOGLE_ADS to true in
// index.html. Then the cookie box asks visitors, and the tag loads for those who say yes.
declare global {
  interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }
}

export const GOOGLE_ADS_ENABLED = false;
export const GOOGLE_ADS_ID = "AW-18563415709";
export const SEND_TO_SIGNUP = "AW-18563415709/mDXdCMDxubQdEJ393JNF";
export const SEND_TO_PURCHASE = "AW-18563415709/47RHCN7iubQdEJ393JNF";
export const STORAGE_KEY = "cookie_consent";
export const CONSENT_RECORD_KEY = "cookie_consent_record";
export const CONSENT_NOTICE_VERSION = "2026-11-18-v2";
export const CONSENT_EVENT = "ca-consent-change";
/** Opens the cookie box again, from the cookie page */
export const COOKIE_SETTINGS_EVENT = "ca-open-cookie-settings";

const CONSENT_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH','CA'];
let consentRegion: Promise<boolean> | undefined;

export function isConsentRequiredRegion(): Promise<boolean> {
  return consentRegion ??= lookupConsentRegion();
}

async function lookupConsentRegion(): Promise<boolean> {
  try {
    const res = await fetch("/cdn-cgi/trace", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return true;
    const trace = await res.text();
    const host = trace.match(/^h=(.+)$/m)?.[1]?.trim().toLowerCase();
    if (host !== location.hostname) return true;
    const country = trace.match(/^loc=([A-Z0-9]{2})$/m)?.[1];
    if (!country || country === "XX" || country === "T1") return true;
    return CONSENT_COUNTRIES.includes(country);
  } catch {
    return true;
  }
}

function currentAdChoice(): string | null {
  if (typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return "denied";
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function storedChoice(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export async function canTrackAds(): Promise<boolean> {
  const choice = currentAdChoice();
  if (choice !== null) return choice === "granted";
  const required = await isConsentRequiredRegion();
  const latest = currentAdChoice();
  return latest !== null ? latest === "granted" : !required;
}

export function updateConsent(decision: "granted" | "denied") {
  if (currentAdChoice() === "denied") decision = "denied";
  if (decision === "denied") window.gtag?.("set", "user_data", null);
  window.gtag?.("consent", "update", {
    ad_storage: decision, ad_user_data: decision, ad_personalization: decision,
  });
}

/** Saves the visitor's choice with when and which notice they saw, then applies it. */
export function saveChoice(decision: "granted" | "denied") {
  try {
    localStorage.setItem(STORAGE_KEY, decision);
    localStorage.setItem(CONSENT_RECORD_KEY, JSON.stringify({
      decision, at: new Date().toISOString(), notice: CONSENT_NOTICE_VERSION,
      purposes: ["ad_measurement"], recipient: "Google Ads",
    }));
  } catch { /* storage blocked */ }
  updateConsent(decision);
  if (decision === "granted") void loadGoogleAds();
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Loads the Google Ads tag, when Google Ads is on and the visitor may be measured */
export async function loadGoogleAds() {
  if (typeof window === "undefined" || !GOOGLE_ADS_ENABLED) return;
  if (!(await canTrackAds())) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments); };
  if (document.querySelector("script[data-google-ads]")) return;
  window.gtag("set", "developer_id.dZjgwMW", true);
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  script.async = true;
  script.setAttribute("data-google-ads", "");
  document.head.appendChild(script);
}

export async function reportConversion(sendTo: string, extra: Record<string, unknown> = {}) {
  if (!GOOGLE_ADS_ENABLED) return;
  await loadGoogleAds();
  // Consent Mode (set by the cookie box) decides what Google may store or use.
  window.gtag?.("event", "conversion", { send_to: sendTo, ...extra });
}

/** Counts a new account once, for accounts created in the last 10 minutes. */
export function reportSignupIfNew(user: { id: string; created_at?: string } | null) {
  if (!user?.created_at) return;
  const age = Date.now() - new Date(user.created_at).getTime();
  if (age < 0 || age > 10 * 60 * 1000) return;
  const key = `ca-ads-signup-${user.id}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
  void reportConversion(SEND_TO_SIGNUP, { value: 1.0, currency: "SEK" });
}
