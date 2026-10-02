-- Collect all sources every 5 minutes, independent of visitors. ingest-sources also calls
-- police-events, which archives new police events and sends push notifications.
-- The bearer token is the project's public anon key, the same one the web app ships with.
SELECT cron.schedule(
  'crimealert-ingest-sources',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pqoiwiiydtikouzjrllx.supabase.co/functions/v1/ingest-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxb2l3aWl5ZHRpa291empybGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQzMTEsImV4cCI6MjA4NzAxMDMxMX0._hZ5CWcDEpWPgk6hSUBHbsbA1ymu7LYfXkFUxgACohk'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
