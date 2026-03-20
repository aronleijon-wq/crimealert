import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const REACTION_TYPES = [
  { type: 'worried', emoji: '😰' },
  { type: 'thumbsup', emoji: '👍' },
  { type: 'alert', emoji: '🚨' },
  { type: 'pray', emoji: '🙏' },
] as const;

export interface ReactionCount {
  type: string;
  count: number;
  userReacted: boolean;
}

export function useIncidentReactions(incidentId: string | null, enabled = true) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<ReactionCount[]>(
    REACTION_TYPES.map(r => ({ type: r.type, count: 0, userReacted: false }))
  );

  const fetchReactions = useCallback(async () => {
    if (!incidentId || !enabled) return;
    const { data } = await supabase
      .from('incident_reactions')
      .select('reaction_type, user_id')
      .eq('incident_id', incidentId);

    const counts = new Map<string, { count: number; userReacted: boolean }>();
    REACTION_TYPES.forEach(r => counts.set(r.type, { count: 0, userReacted: false }));

    (data || []).forEach(r => {
      const existing = counts.get(r.reaction_type) || { count: 0, userReacted: false };
      existing.count++;
      if (user && r.user_id === user.id) existing.userReacted = true;
      counts.set(r.reaction_type, existing);
    });

    setReactions(REACTION_TYPES.map(r => ({
      type: r.type,
      count: counts.get(r.type)?.count || 0,
      userReacted: counts.get(r.type)?.userReacted || false,
    })));
  }, [incidentId, user, enabled]);

  useEffect(() => { if (enabled) fetchReactions(); }, [fetchReactions, enabled]);

  const toggleReaction = useCallback(async (reactionType: string) => {
    if (!user || !incidentId) return;
    const existing = reactions.find(r => r.type === reactionType);
    if (existing?.userReacted) {
      // Optimistic update
      setReactions(prev => prev.map(r => r.type === reactionType ? { ...r, count: r.count - 1, userReacted: false } : r));
      await supabase.from('incident_reactions').delete()
        .eq('incident_id', incidentId)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType);
    } else {
      setReactions(prev => prev.map(r => r.type === reactionType ? { ...r, count: r.count + 1, userReacted: true } : r));
      await supabase.from('incident_reactions').insert({
        incident_id: incidentId,
        user_id: user.id,
        reaction_type: reactionType,
      });
    }
  }, [user, incidentId, reactions]);

  return { reactions, toggleReaction };
}
