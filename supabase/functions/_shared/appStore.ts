// Pro bought in the iPhone app, through Apple. The app hands over a transaction id after a
// purchase (or at start, for what the phone already owns); apple-subscription asks Apple's App
// Store Server API about it and stores the answer in apple_subscriptions. Apple's renewal and
// refund notices (apple-notifications) only say which subscription to ask about again, so
// nothing is believed that didn't come from Apple. Needs the secrets APPSTORE_ISSUER_ID,
// APPSTORE_KEY_ID and APPSTORE_PRIVATE_KEY (an In-App Purchase key from App Store Connect).
import { decodeJws, signAppleJwt } from './appleJwt.ts';

export const APP_BUNDLE_ID = 'se.crimealert.app';

/** Must match the subscriptions in App Store Connect (and src/lib/appStore.ts) */
export const APPLE_PRO_PRODUCTS: readonly string[] = ['se.crimealert.pro.monthly', 'se.crimealert.pro.yearly'];

export interface AppStoreKey {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export type AppStoreEnvironment = 'production' | 'sandbox';

const HOSTS: Record<AppStoreEnvironment, string> = {
  production: 'https://api.storekit.itunes.apple.com',
  sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
};

export function appStoreJwt(key: AppStoreKey, now: number): Promise<string> {
  const iat = Math.floor(now / 1000);
  return signAppleJwt(
    { kid: key.keyId, typ: 'JWT' },
    { iss: key.issuerId, iat, exp: iat + 20 * 60, aud: 'appstoreconnect-v1', bid: APP_BUNDLE_ID },
    key.privateKey,
  );
}

interface TransactionPayload {
  originalTransactionId: string;
  transactionId: string;
  bundleId: string;
  productId: string;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
}

interface RenewalPayload {
  gracePeriodExpiresDate?: number;
}

interface StatusResponse {
  data?: {
    lastTransactions?: { originalTransactionId: string; status: number; signedTransactionInfo: string; signedRenewalInfo?: string }[];
  }[];
}

/** What Apple says about one subscription */
export interface AppleSubscription {
  originalTransactionId: string;
  productId: string;
  /** Pro until then; null when it gives no Pro now (expired, refunded, payment failed) */
  expiresAt: string | null;
  /** The CrimeAlert account it was bought for (the purchase's appAccountToken), if known */
  accountId: string | null;
  environment: AppStoreEnvironment;
}

// Apple's status codes: 1 active, 2 expired, 3 billing retry, 4 grace period, 5 revoked
const ACTIVE = 1;
const GRACE = 4;

/** The subscription a status answer describes, for this app's Pro products only */
export function subscriptionFromStatus(response: StatusResponse, environment: AppStoreEnvironment, now: number): AppleSubscription | null {
  let best: AppleSubscription | null = null;
  for (const group of response.data ?? []) {
    for (const last of group.lastTransactions ?? []) {
      const tx = decodeJws<TransactionPayload>(last.signedTransactionInfo);
      if (tx.bundleId !== APP_BUNDLE_ID || !APPLE_PRO_PRODUCTS.includes(tx.productId)) continue;
      let until = tx.expiresDate ?? null;
      if (last.status === GRACE && last.signedRenewalInfo) {
        const grace = decodeJws<RenewalPayload>(last.signedRenewalInfo).gracePeriodExpiresDate;
        if (grace && (!until || grace > until)) until = grace;
      }
      const gives = (last.status === ACTIVE || last.status === GRACE) && !tx.revocationDate && until !== null && until > now;
      const candidate: AppleSubscription = {
        originalTransactionId: tx.originalTransactionId,
        productId: tx.productId,
        expiresAt: gives ? new Date(until!).toISOString() : null,
        accountId: tx.appAccountToken?.toLowerCase() ?? null,
        environment,
      };
      if (!best || (candidate.expiresAt ?? '') > (best.expiresAt ?? '')) best = candidate;
    }
  }
  return best;
}

/**
 * Asks Apple about the subscription a transaction belongs to: in production first, then in the
 * sandbox (TestFlight and App Review), as Apple recommends. Null when Apple knows of none.
 */
export async function fetchAppleSubscription(transactionId: string, key: AppStoreKey, now: number): Promise<AppleSubscription | null> {
  if (!/^\d{1,30}$/.test(transactionId)) return null;
  const jwt = await appStoreJwt(key, now);
  for (const environment of ['production', 'sandbox'] as const) {
    const response = await fetch(`${HOSTS[environment]}/inApps/v1/subscriptions/${transactionId}`, {
      headers: { authorization: `Bearer ${jwt}` },
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`App Store Server API ${response.status}: ${await response.text()}`);
    return subscriptionFromStatus((await response.json()) as StatusResponse, environment, now);
  }
  return null;
}

/** The transaction a notice from Apple is about (unchecked: it is only used to ask Apple) */
export function transactionInNotice(signedPayload: string): string | null {
  try {
    const notice = decodeJws<{ data?: { signedTransactionInfo?: string } }>(signedPayload);
    if (!notice.data?.signedTransactionInfo) return null;
    return decodeJws<TransactionPayload>(notice.data.signedTransactionInfo).transactionId ?? null;
  } catch {
    return null;
  }
}
