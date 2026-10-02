import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const calls: { table: string; ids: string[] }[] = [];
const inserts: unknown[] = [];

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        in: async (_column: string, ids: string[]) => {
          calls.push({ table, ids });
          if (table === 'incident_reactions') {
            return { data: [
              { incident_id: 'a', reaction_type: 'thumbsup', user_id: 'me' },
              { incident_id: 'a', reaction_type: 'thumbsup', user_id: 'other' },
              { incident_id: 'b', reaction_type: 'worried', user_id: 'other' },
            ].filter((r) => ids.includes(r.incident_id)) };
          }
          return { data: [{ incident_id: 'b' }, { incident_id: 'b' }].filter((c) => ids.includes(c.incident_id)) };
        },
      }),
      insert: async (row: unknown) => { inserts.push(row); return { error: null }; },
      delete: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }),
    }),
  },
}));

beforeEach(() => {
  calls.length = 0;
  inserts.length = 0;
});

describe('useEngagementCounts', () => {
  it('loads reactions and comment counts for all posts with one query per table', async () => {
    const { useEngagementCounts } = await import('./useEngagementCounts');
    const { result } = renderHook(() => useEngagementCounts(['a', 'b', 'c']));

    await waitFor(() => expect(result.current.engagement.b).toBeDefined());
    expect(calls).toEqual([
      { table: 'incident_reactions', ids: ['a', 'b', 'c'] },
      { table: 'incident_comments', ids: ['a', 'b', 'c'] },
    ]);
    expect(result.current.engagement.a.reactions.find((r) => r.type === 'thumbsup')).toEqual({ type: 'thumbsup', count: 2, userReacted: true });
    expect(result.current.engagement.b.commentCount).toBe(2);
    expect(result.current.engagement.c.commentCount).toBe(0);
  });

  it('only queries posts it has not loaded yet when more are shown', async () => {
    const { useEngagementCounts } = await import('./useEngagementCounts');
    const { result, rerender } = renderHook(({ ids }) => useEngagementCounts(ids), { initialProps: { ids: ['a'] } });
    await waitFor(() => expect(result.current.engagement.a).toBeDefined());

    rerender({ ids: ['a', 'b'] });
    await waitFor(() => expect(result.current.engagement.b).toBeDefined());

    expect(calls.map((c) => c.ids)).toEqual([['a'], ['a'], ['b'], ['b']]);
  });

  it('toggles a reaction optimistically and saves it', async () => {
    const { useEngagementCounts } = await import('./useEngagementCounts');
    const { result } = renderHook(() => useEngagementCounts(['b']));
    await waitFor(() => expect(result.current.engagement.b).toBeDefined());

    await act(() => result.current.toggleReaction('b', 'thumbsup'));

    expect(result.current.engagement.b.reactions.find((r) => r.type === 'thumbsup')).toEqual({ type: 'thumbsup', count: 1, userReacted: true });
    expect(inserts).toEqual([{ incident_id: 'b', user_id: 'me', reaction_type: 'thumbsup' }]);
  });
});
