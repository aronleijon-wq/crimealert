import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({
  purchase: vi.fn(),
  restore: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@/lib/nativeApp', () => ({ nativePlugin: async () => ({ purchase: store.purchase, restore: store.restore }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (name: string, opts: unknown) => store.invoke(name, opts) } },
}));

const { buyPro, periodLabel, restorePro } = await import('./appStore');

beforeEach(() => {
  store.purchase.mockReset();
  store.restore.mockReset();
  store.invoke.mockReset().mockResolvedValue({ data: { pro: true, other_account: false }, error: null });
});

describe('Pro through Apple', () => {
  it('names periods in Swedish', () => {
    expect(periodLabel('1 month')).toBe('månad');
    expect(periodLabel('1 year')).toBe('år');
    expect(periodLabel('1 week', true)).toBe('1 vecka');
    expect(periodLabel('7 day', true)).toBe('7 dagar');
    expect(periodLabel(undefined)).toBe('');
  });

  it('buys for the signed-in account and has the server check it with Apple', async () => {
    store.purchase.mockResolvedValue({ transactionId: '1005' });
    await expect(buyPro('se.crimealert.pro.yearly', 'u1')).resolves.toBe('pro');
    expect(store.purchase).toHaveBeenCalledWith({ productId: 'se.crimealert.pro.yearly', accountId: 'u1' });
    expect(store.invoke).toHaveBeenCalledWith('apple-subscription', { body: { transactionIds: ['1005'] } });
  });

  it('knows a cancelled, waiting or someone else’s purchase', async () => {
    store.purchase.mockRejectedValueOnce(Object.assign(new Error('Avbrutet'), { code: 'CANCELLED' }));
    await expect(buyPro('p', 'u1')).resolves.toBe('cancelled');
    store.purchase.mockResolvedValueOnce({ pending: true });
    await expect(buyPro('p', 'u1')).resolves.toBe('pending');
    expect(store.invoke).not.toHaveBeenCalled();
    store.purchase.mockResolvedValueOnce({ transactionId: '9' });
    store.invoke.mockResolvedValueOnce({ data: { pro: false, other_account: true }, error: null });
    await expect(buyPro('p', 'u1')).resolves.toBe('other_account');
  });

  it('restores what the Apple ID has, or says there is nothing', async () => {
    store.restore.mockResolvedValueOnce({ transactionIds: [] });
    await expect(restorePro()).resolves.toEqual({ pro: false, otherAccount: false, found: false });
    store.restore.mockResolvedValueOnce({ transactionIds: ['1005'] });
    await expect(restorePro()).resolves.toEqual({ pro: true, otherAccount: false, found: true });
  });
});
