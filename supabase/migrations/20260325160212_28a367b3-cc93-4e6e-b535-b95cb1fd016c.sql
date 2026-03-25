CREATE POLICY "Users can read own push log"
ON public.sent_push_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);