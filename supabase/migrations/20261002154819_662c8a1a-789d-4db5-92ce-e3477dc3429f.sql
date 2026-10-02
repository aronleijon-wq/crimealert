CREATE POLICY "Service role manages ingest state" ON public.ingest_state
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);