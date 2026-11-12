import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Two full pages and a short one: the database answers at most 1000 rows at a time
const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ area: 'Nacka', category: `Typ ${from + i}`, now_count: 1, before_count: 0 }));
const range = vi.fn((from: number) => Promise.resolve({ data: from < 2000 ? page(from, 1000) : page(from, 3), error: null }));
const order = vi.fn(() => query);
const query = { order, range };
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: () => query } }));

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
});
