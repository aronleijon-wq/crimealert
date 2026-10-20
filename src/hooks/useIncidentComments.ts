import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BLOCKED_WORDS_MESSAGE, blockUser, hasBlockedWords, refusalMessage, reportContent, type ReportReason } from '@/lib/moderation';

export interface IncidentComment {
  id: string;
  incident_id: string;
  user_id: string;
  text: string;
  created_at: string;
  likes_count: number;
  user_has_liked: boolean;
}

export function useIncidentComments(incidentId: string | null, enabled = false) {
  const { user } = useAuth();
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

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

      const commentIds = commentsData.map(c => c.id);
      const { data: likesData } = commentIds.length > 0
        ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
        : { data: [] };

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
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [incidentId, user]);

  // Only fetch when enabled (user opened comments)
  useEffect(() => {
    if (enabled && !hasFetched) fetchComments();
  }, [enabled, hasFetched, fetchComments]);

  // Reset on incident change
  useEffect(() => {
    setHasFetched(false);
    setComments([]);
  }, [incidentId]);

  /** Posts a comment; returns why it wasn't posted, or null */
  const addComment = useCallback(async (text: string): Promise<string | null> => {
    if (!user || !incidentId || !text.trim()) return null;
    const sanitized = text.replace(/<[^>]*>/g, '').trim().slice(0, 500);
    if (!sanitized) return null;
    if (hasBlockedWords(sanitized)) return BLOCKED_WORDS_MESSAGE;
    const { data, error } = await supabase.from('incident_comments').insert({
      incident_id: incidentId,
      user_id: user.id,
      text: sanitized,
    }).select().single();
    if (error) return refusalMessage(error) ?? 'Kommentaren kunde inte skickas just nu.';
    if (data) {
      setComments(prev => [...prev, { ...data, likes_count: 0, user_has_liked: false }]);
    }
    return null;
  }, [user, incidentId]);

  /** Reports a comment; it disappears for the reporter at once */
  const reportComment = useCallback(async (commentId: string, reason: ReportReason) => {
    if (!user) return;
    await reportContent(user.id, 'comment', commentId, reason);
    setComments(prev => prev.filter(c => c.id !== commentId));
  }, [user]);

  /** Blocks a comment's author; their comments disappear for the blocker */
  const blockAuthor = useCallback(async (authorId: string) => {
    if (!user) return;
    await blockUser(user.id, authorId);
    setComments(prev => prev.filter(c => c.user_id !== authorId));
  }, [user]);

  const toggleLike = useCallback(async (commentId: string, hasLiked: boolean) => {
    if (!user) return;
    // Optimistic
    setComments(prev => prev.map(c => c.id === commentId ? {
      ...c,
      likes_count: hasLiked ? c.likes_count - 1 : c.likes_count + 1,
      user_has_liked: !hasLiked,
    } : c));
    if (hasLiked) {
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
    }
  }, [user]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!user) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    await supabase.from('incident_comments').delete().eq('id', commentId).eq('user_id', user.id);
  }, [user]);

  return { comments, loading, addComment, toggleLike, deleteComment, reportComment, blockAuthor };
}
