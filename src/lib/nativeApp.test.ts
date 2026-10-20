import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  upsert: vi.fn(async (_row: unknown, _opts?: unknown) => ({ error: null })),
  deleted: [] as string[],
  setSession: vi.fn(async (_tokens: unknown) => ({ error: null })),
}));
const native = vi.hoisted(() => ({
  push: { register: vi.fn(), checkPermission: vi.fn(), requestPermission: vi.fn(), addListener: vi.fn() },
  auth: { signIn: vi.fn() },
  available: true,
}));

vi.mock('@/lib/native', () => ({ isNativeApp: () => true }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: () => native.available },
  registerPlugin: (name: string) => (name === 'CrimeAlertPush' ? native.push : native.auth),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (row: unknown, opts: unknown) => db.upsert(row, opts),
      delete: () => ({ eq: () => ({ eq: async (_c: string, endpoint: string) => { db.deleted.push(endpoint); return { error: null }; } }) }),
    }),
    auth: { setSession: (tokens: unknown) => db.setSession(tokens) },
  },
}));

const { apnsEndpoint, forgetDeviceToken, nativePushTurnedOff, saveDeviceToken, signInInApp } = await import('./nativeApp');
const { appCallbackUrl } = await import('./appLogin');

beforeEach(() => {
  localStorage.clear();
  db.upsert.mockClear();
  db.setSession.mockClear();
  db.deleted = [];
});

describe('the iPhone app', () => {
  it('saves the device token with the push subscriptions, and replaces an old one', async () => {
    native.push.register.mockResolvedValueOnce({ token: 'aa', environment: 'production' });
    await saveDeviceToken('u1');
    expect(db.upsert).toHaveBeenCalledWith({ user_id: 'u1', endpoint: 'apns:production:aa', p256dh: '', auth: '' }, { onConflict: 'user_id,endpoint' });
    expect(db.deleted).toEqual([]);

    native.push.register.mockResolvedValueOnce({ token: 'bb', environment: 'production' });
    await saveDeviceToken('u1');
    expect(db.deleted).toEqual([apnsEndpoint('aa', 'production')]);
  });

  it('forgets the device on sign-out, and remembers when notifications were turned off', async () => {
    native.push.register.mockResolvedValueOnce({ token: 'cc', environment: 'sandbox' });
    await saveDeviceToken('u1');
    await forgetDeviceToken('u1', false);
    expect(db.deleted).toEqual(['apns:sandbox:cc']);
    expect(nativePushTurnedOff()).toBe(false);
    await forgetDeviceToken('u1', true);
    expect(nativePushTurnedOff()).toBe(true);
    native.push.register.mockResolvedValueOnce({ token: 'cc', environment: 'sandbox' });
    await saveDeviceToken('u1');
    expect(nativePushTurnedOff()).toBe(false);
  });

  it('signs in with the session the sign-in sheet hands back', async () => {
    native.auth.signIn.mockResolvedValueOnce({ url: appCallbackUrl('acc ess', 'ref/resh') });
    await expect(signInInApp('apple')).resolves.toBe(true);
    expect(native.auth.signIn).toHaveBeenCalledWith({ url: 'https://crimealert.se/app-login?provider=apple' });
    expect(db.setSession).toHaveBeenCalledWith({ access_token: 'acc ess', refresh_token: 'ref/resh' });

    native.auth.signIn.mockRejectedValueOnce(Object.assign(new Error('Avbrutet'), { code: 'CANCELLED' }));
    await expect(signInInApp('google')).resolves.toBe(false);
    native.auth.signIn.mockResolvedValueOnce({ url: 'crimealert://auth#error=nope' });
    await expect(signInInApp('google')).rejects.toThrow('nope');
  });
});
