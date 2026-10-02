import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { REACTION_TYPES, type ReactionCount } from '@/hooks/useIncidentReactions';

export interface Engagement {
  reactions: ReactionCount[];
  commentCount: number;
}

const CHUNK_SIZE = 100;

const emptyReactions = (): ReactionCount[] => REACTION_TYPES.map((r) => ({ type: r.type, count: 0, userReacted: false }));

/**
 * Reactions and comment counts for many posts with two queries per batch of new ids,
 * instead of two queries per post. Only for signed-in users: the tables are not readable
 * without an account.
 */
export function useEngagementCounts(ids: string[]) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [engagement, setEngagement] = useState<Record<string, Engagement>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    requested.current = new Set();
    setEngagement({});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const missing = ids.filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));

    (async () => {
      for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
        const chunk = missing.slice(i, i + CHUNK_SIZE);
        const [{ data: reactions }, { data: comments }] = await Promise.all([
          supabase.from('incident_reactions').select('incident_id, reaction_type, user_id').in('incident_id', chunk),
          supabase.from('incident_comments').select('incident_id').in('incident_id', chunk),
        ]);
        const next: Record<string, Engagement> = {};
        chunk.forEach((id) => { next[id] = { reactions: emptyReactions(), commentCount: 0 }; });
        (reactions ?? []).forEach((r) => {
          const entry = next[r.incident_id]?.reactions.find((x) => x.type === r.reaction_type);
          if (!entry) return;
          entry.count++;
          if (r.user_id === userId) entry.userReacted = true;
        });
        (comments ?? []).forEach((c) => {
          if (next[c.incident_id]) next[c.incident_id].commentCount++;
        });
        setEngagement((prev) => ({ ...prev, ...next }));
      }
    })();
  }, [ids, userId]);

  const toggleReaction = useCallback(async (id: string, type: string) => {
    if (!userId) return;
    const current = engagement[id]?.reactions.find((r) => r.type === type);
    const reacted = !!current?.userReacted;
    // Optimistic update
    setEngagement((prev) => {
      const entry = prev[id] ?? { reactions: emptyReactions(), commentCount: 0 };
      return {
        ...prev,
        [id]: {
          ...entry,
          reactions: entry.reactions.map((r) => r.type === type
            ? { ...r, count: Math.max(0, r.count + (reacted ? -1 : 1)), userReacted: !reacted }
            : r),
        },
      };
    });
    if (reacted) {
      await supabase.from('incident_reactions').delete()
        .eq('incident_id', id).eq('user_id', userId).eq('reaction_type', type);
    } else {
      await supabase.from('incident_reactions').insert({ incident_id: id, user_id: userId, reaction_type: type });
    }
  }, [engagement, userId]);

  const setCommentCount = useCallback((id: string, commentCount: number) => {
    setEngagement((prev) => ({
      ...prev,
      [id]: { reactions: prev[id]?.reactions ?? emptyReactions(), commentCount },
    }));
  }, []);

  return { engagement, toggleReaction, setCommentCount };
}
