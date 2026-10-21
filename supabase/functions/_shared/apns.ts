// Notifications to the iPhone app go through Apple (APNs). The app saves its device token with
// the web push subscriptions, as "apns:<sandbox|production>:<token>" (src/lib/nativeApp.ts), so
// everything send-push-notifications sends reaches the app too. Needs the secrets APNS_KEY_ID,
// APNS_TEAM_ID and APNS_PRIVATE_KEY (the .p8 key from developer.apple.com, Keys).
import { signAppleJwt } from './appleJwt.ts';

export interface ApnsTarget {
  environment: 'sandbox' | 'production';
  token: string;
}

export interface ApnsKey {
  keyId: string;
  teamId: string;
  /** The .p8 file's contents, with or without its header lines and line breaks */
  privateKey: string;
}

export interface PushResult {
  ok: boolean;
  status: number | null;
  expired: boolean;
  error?: string;
}

export function parseApnsEndpoint(endpoint: string): ApnsTarget | null {
  const match = /^apns:(sandbox|production):([0-9a-f]{64,200})$/i.exec(endpoint);
  return match ? { environment: match[1] as ApnsTarget['environment'], token: match[2].toLowerCase() } : null;
}

/** The site's web push message (title, body, tag, data.url) as Apple's */
export function apnsMessage(webPayload: string): { body: string; collapseId: string | null } {
  const p = JSON.parse(webPayload) as { title?: string; body?: string; tag?: string; data?: { url?: string } };
  const aps: Record<string, unknown> = { alert: { title: p.title ?? 'CrimeAlert', body: p.body ?? '' }, sound: 'default' };
  if (p.tag) aps['thread-id'] = p.tag;
  return {
    body: JSON.stringify({ aps, url: p.data?.url ?? '/karta' }),
    // Like the web's tag: a newer notification about the same thing replaces the older one
    collapseId: p.tag ? p.tag.slice(0, 64) : null,
  };
}

// Apple refuses tokens renewed more often than every 20 minutes, and old ones after an hour.
// Every run in the same half hour signs with the same issue time, however many runs there are.
const WINDOW_SECONDS = 30 * 60;

/** The signed token (ES256) Apple takes in place of a certificate */
export function apnsJwt(key: ApnsKey, now: number): Promise<string> {
  const issuedAt = Math.floor(now / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;
  return signAppleJwt({ kid: key.keyId }, { iss: key.teamId, iat: issuedAt }, key.privateKey);
}

// A token Apple no longer delivers to (app removed, or not this app's): it is deleted
const GONE = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);

export async function sendApns(target: ApnsTarget, webPayload: string, jwt: string, bundleId: string, now: number): Promise<PushResult> {
  const { body, collapseId } = apnsMessage(webPayload);
  const host = target.environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    'apns-topic': bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-expiration': String(Math.floor(now / 1000) + 24 * 60 * 60),
  };
  if (collapseId) headers['apns-collapse-id'] = collapseId;
  const response = await fetch(`${host}/3/device/${target.token}`, { method: 'POST', headers, body });
  if (response.ok) return { ok: true, status: response.status, expired: false };
  const reason = ((await response.json().catch(() => ({}))) as { reason?: string }).reason ?? `HTTP ${response.status}`;
  return { ok: false, status: response.status, expired: response.status === 410 || GONE.has(reason), error: reason };
}
