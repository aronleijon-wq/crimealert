import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { accountCountLabel, loadAccountCount } = await import('./accountCount');

describe('the number of accounts', () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockReset();
  });

  it('is only mentioned from a hundred', () => {
    expect(accountCountLabel(null)).toBeNull();
    expect(accountCountLabel(0)).toBeNull();
    expect(accountCountLabel(100)).toBe('över 100 användare');
    expect(accountCountLabel(1200)).toBe('över 1 200 användare');
  });

  it('is asked for once and then remembered for six hours', async () => {
    rpc.mockResolvedValue({ data: 500, error: null });
    const now = Date.parse('2026-10-07T10:00:00Z');
    expect(await loadAccountCount(now)).toBe(500);
    expect(await loadAccountCount(now + 5 * 60 * 60 * 1000)).toBe(500);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('account_count');

    rpc.mockResolvedValue({ data: 600, error: null });
    expect(await loadAccountCount(now + 7 * 60 * 60 * 1000)).toBe(600);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('is left out when it can not be had', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    expect(await loadAccountCount()).toBeNull();
    expect(localStorage.getItem('crimealert-account-count')).toBeNull();
  });
});
