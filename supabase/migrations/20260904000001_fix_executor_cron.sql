-- Fix executor-cron pg_cron job
-- Problem: The previous migration had a stub/fake JWT that doesn't match the real service role key
-- Solution: pg_cron doesn't need auth because the function allows no-auth calls from pg_cron
--           (authenticateRequest returns true when no headers are present)

-- Unschedule existing broken job
SELECT cron.unschedule('executor-cron');

-- executor-cron: Process pending tasks - every 5 min
-- No auth needed - the edge function allows no-auth calls from pg_cron
SELECT cron.schedule(
  'executor-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/executor-cron',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{"triggered_by":"cron"}'
  )$$
);

-- Verify all cron schedules
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
