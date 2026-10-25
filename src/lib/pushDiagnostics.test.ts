import { describe, it, expect } from 'vitest';
import { registerFailureReason, testFailureReason } from './pushDiagnostics';

const apns = (error?: string) => ({ endpoint: 'apns:production:abcd', ok: !error, error });

describe('push diagnostics', () => {
  it('is quiet when the test notification was sent', () => {
    expect(testFailureReason({ sent: 1, results: [apns()] })).toBeNull();
  });

  it('names what to fix on the server', () => {
    expect(testFailureReason({ sent: 0, results: [apns('APNS_KEY_ID, APNS_TEAM_ID eller APNS_PRIVATE_KEY saknas.')] })).toMatch(/Apple-nyckeln saknas/);
    expect(testFailureReason({ sent: 0, results: [apns('InvalidProviderToken')] })).toMatch(/Key ID, Team ID/);
    expect(testFailureReason({ sent: 0, results: [apns('DeviceTokenNotForTopic')] })).toMatch(/se\.crimealert\.app/);
  });

  it('knows when the phone was never saved', () => {
    expect(testFailureReason({ sent: 0, error: 'Ingen sparad push subscription hittades.' })).toMatch(/inte registrerad/);
    expect(testFailureReason({ sent: 0, results: [{ endpoint: 'https://web.push.apple.com/x', ok: true }] })).toMatch(/inte registrerad/);
  });

  it('passes on what Apple said otherwise', () => {
    expect(testFailureReason({ sent: 0, results: [apns('TooManyRequests')] })).toBe('Apple svarade: TooManyRequests');
  });

  it('explains a build without the notification permission', () => {
    expect(registerFailureReason('no valid "aps-environment" entitlement string found for application')).toMatch(/Push Notifications/);
    expect(registerFailureReason(null)).toBeNull();
  });
});
