import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface IncidentComment {
  id: string;
  incident_id: string;
  user_id: string;
  text: string;
  created_at: string;
  likes_count: number;
  user_has_liked: boolean;
}

export function useIncidentComments(incidentId: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const { data: commentsData } = await supabase
        .from('incident_comments')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true });

      if (!commentsData) { setComments([]); return; }

      // Fetch likes counts
      const commentIds = commentsData.map(c => c.id);
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds.length > 0 ? commentIds : ['__none__']);

      const likesMap = new Map<string, { count: number; userLiked: boolean }>();
      (likesData || []).forEach(l => {
        const existing = likesMap.get(l.comment_id) || { count: 0, userLiked: false };
        existing.count++;
        if (user && l.user_id === user.id) existing.userLiked = true;
        likesMap.set(l.comment_id, existing);
      });

      setComments(commentsData.map(c => ({
        ...c,
        likes_count: likesMap.get(c.id)?.count || 0,
        user_has_liked: likesMap.get(c.id)?.userLiked || false,
      })));
    } finally {
      setLoading(false);
    }
  }, [incidentId, user]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!incidentId) return;
    const channel = supabase
      .channel(`comments-${incidentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incident_comments',
        filter: `incident_id=eq.${incidentId}`,
      }, () => { fetchComments(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comment_likes',
      }, () => { fetchComments(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [incidentId, fetchComments]);

  const addComment = useCallback(async (text: string) => {
    if (!user || !incidentId || !text.trim()) return;
    await supabase.from('incident_comments').insert({
      incident_id: incidentId,
      user_id: user.id,
      text: text.trim(),
    });
  }, [user, incidentId]);

  const toggleLike = useCallback(async (commentId: string, hasLiked: boolean) => {
    if (!user) return;
    if (hasLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
    }
  }, [user]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!user) return;
    await supabase.from('incident_comments').delete().eq('id', commentId).eq('user_id', user.id);
  }, [user]);

  return { comments, loading, addComment, toggleLike, deleteComment };
}
