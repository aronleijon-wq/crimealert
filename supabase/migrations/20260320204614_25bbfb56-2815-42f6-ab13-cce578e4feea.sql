
-- Incident comments table
CREATE TABLE public.incident_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments" ON public.incident_comments FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.incident_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.incident_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Incident reactions table (emoji reactions per incident)
CREATE TABLE public.incident_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (incident_id, user_id, reaction_type)
);

ALTER TABLE public.incident_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions" ON public.incident_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert reactions" ON public.incident_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.incident_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comment likes table
CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.incident_comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON public.comment_likes FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert likes" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for comments and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;

-- Create indexes for performance
CREATE INDEX idx_incident_comments_incident_id ON public.incident_comments(incident_id);
CREATE INDEX idx_incident_reactions_incident_id ON public.incident_reactions(incident_id);
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);
