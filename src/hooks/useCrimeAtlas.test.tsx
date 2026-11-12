import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Two full pages and a short one: the database answers at most 1000 rows at a time
const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ area: 'Nacka', category: `Typ ${from + i}`, now_count: 1, before_count: 0 }));
const range = vi.fn((from: number) => Promise.resolve({ data: from < 2000 ? page(from, 1000) : page(from, 3), error: null }));
const order = vi.fn(() => query);
const query = { order, range };
const rpc = vi.fn(() => query);
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import { useCrimeAtlas } from './useCrimeAtlas';

describe('useCrimeAtlas', () => {
  it('fetches every page, in a steady order, until a short one', async () => {
    const { result } = renderHook(() => useCrimeAtlas(30));
    await waitFor(() => expect(result.current.atlas).not.toBeNull());
    expect(range.mock.calls.map((c) => c[0])).toEqual([0, 1000, 2000]);
    expect(order).toHaveBeenCalledWith('area');
    expect(order).toHaveBeenCalledWith('category');
    expect(result.current.atlas!.byKommun.get('Nacka')!.get('alla')!.now).toBe(2003);
  });

  it('falls back to crime_atlas until crime_atlas_places exists', async () => {
    range.mockReset();
    rpc.mockClear();
    range
      .mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function' } } as never)
      .mockResolvedValueOnce({ data: page(0, 2), error: null } as never);
    const { result } = renderHook(() => useCrimeAtlas(7));
    await waitFor(() => expect(result.current.atlas).not.toBeNull());
    expect(rpc.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['crime_atlas_places', 'crime_atlas']);
    expect(result.current.atlas!.byKommun.get('Nacka')!.get('alla')!.now).toBe(2);
  });
});
