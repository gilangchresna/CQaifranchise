-- Register executor-cron pg_cron job
-- Runs every 5 minutes to process pending agent_tasks

-- executor-cron: Process pending tasks - every 5 min
SELECT cron.schedule(
  'executor-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/executor-cron',
    headers=>'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbG...B_pk"}',
    body=>'{"triggered_by":"cron"}'
  )$$
);

-- Verify all schedules
SELECT jobname, schedule FROM cron.job;
