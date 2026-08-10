-- Register pg_cron jobs for coordinator-pipeline and sla-escalator
-- No auth header needed: Edge Functions use SERVICE_ROLE_KEY env var internally

-- coordinator-pipeline: ML anomaly + stockout + alert creation — every 15 min
SELECT cron.schedule(
  'coordinator-pipeline',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/coordinator-pipeline',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{}'
  )$$
);

-- sla-escalator: SLA check + escalation — every 15 min
SELECT cron.schedule(
  'sla-escalator',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sla-escalator',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{}'
  )$$
);

-- Verify all schedules
SELECT jobname, schedule, command FROM cron.job;
