import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAppleSubscription, subscriptionFromStatus, transactionInNotice } from './appStore';

const jws = (claims: unknown) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const NOW = Date.UTC(2026, 9, 21);
const DAY = 24 * 60 * 60 * 1000;
const USER = '6f1c2a3b-0000-4000-8000-000000000001';

const tx = (over: Record<string, unknown> = {}) => jws({
  originalTransactionId: '1000', transactionId: '1005', bundleId: 'se.crimealert.app', productId: 'crimealert.pro.monthly',
  expiresDate: NOW + 10 * DAY, appAccountToken: USER.toUpperCase(), ...over,
});
const status = (code: number, signedTransactionInfo = tx(), signedRenewalInfo?: string) =>
  ({ data: [{ lastTransactions: [{ originalTransactionId: '1000', status: code, signedTransactionInfo, signedRenewalInfo }] }] });

afterEach(() => vi.unstubAllGlobals());

describe('App Store subscriptions', () => {
  it('gives Pro while Apple says it is active, until it expires', () => {
    expect(subscriptionFromStatus(status(1), 'production', NOW)).toEqual({
      originalTransactionId: '1000', productId: 'crimealert.pro.monthly', expiresAt: new Date(NOW + 10 * DAY).toISOString(),
      accountId: USER, environment: 'production',
    });
  });

  it('gives none when expired, refunded or in billing retry, but keeps the grace period', () => {
    expect(subscriptionFromStatus(status(2), 'production', NOW)?.expiresAt).toBeNull();
    expect(subscriptionFromStatus(status(3), 'production', NOW)?.expiresAt).toBeNull();
    expect(subscriptionFromStatus(status(1, tx({ revocationDate: NOW - DAY })), 'production', NOW)?.expiresAt).toBeNull();
    const grace = subscriptionFromStatus(status(4, tx({ expiresDate: NOW - DAY }), jws({ gracePeriodExpiresDate: NOW + 3 * DAY })), 'sandbox', NOW);
    expect(grace?.expiresAt).toBe(new Date(NOW + 3 * DAY).toISOString());
  });

  it('ignores other apps and other products', () => {
    expect(subscriptionFromStatus(status(1, tx({ bundleId: 'com.other.app' })), 'production', NOW)).toBeNull();
    expect(subscriptionFromStatus(status(1, tx({ productId: 'se.crimealert.coins' })), 'production', NOW)).toBeNull();
  });

  it('asks production first and the sandbox when production has never heard of it', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('{"errorCode":4040010}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(status(1)), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const pem = Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64');
    const sub = await fetchAppleSubscription('1005', { issuerId: 'issuer', keyId: 'KEY', privateKey: pem }, NOW);
    expect(sub?.environment).toBe('sandbox');
    expect(fetch.mock.calls[0][0]).toBe('https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/1005');
    expect(fetch.mock.calls[1][0]).toBe('https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/1005');
    const auth = (fetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const claims = JSON.parse(Buffer.from(auth.authorization.split(' ')[1].split('.')[1], 'base64url').toString());
    expect(claims).toMatchObject({ iss: 'issuer', aud: 'appstoreconnect-v1', bid: 'se.crimealert.app' });
    // Only transaction ids are passed on to Apple
    await expect(fetchAppleSubscription('../x', { issuerId: 'i', keyId: 'k', privateKey: pem }, NOW)).resolves.toBeNull();
  });

  it('finds which transaction a notice is about', () => {
    expect(transactionInNotice(jws({ notificationType: 'DID_RENEW', data: { signedTransactionInfo: tx() } }))).toBe('1005');
    expect(transactionInNotice(jws({ notificationType: 'TEST', data: {} }))).toBeNull();
    expect(transactionInNotice('garbage')).toBeNull();
  });
});
