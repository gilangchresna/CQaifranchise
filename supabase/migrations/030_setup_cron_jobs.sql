-- IMPORTANT: Configure the service role key in Supabase Dashboard → Project Settings → Edge Functions → Secrets
-- The key should be named: SUPABASE_SERVICE_ROLE_KEY
-- DO NOT hardcode JWTs in migrations. Instead, use pg_net with service_role auth via the extension.

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule: ML anomaly detection every 15 minutes
SELECT cron.schedule(
  'ml-anomaly-check',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-anomaly-score',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{"outlet_id": 37}'
  )$$
);

-- Schedule: Stockout risk check every hour
SELECT cron.schedule(
  'ml-stockout-check',
  '0 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-stockout-risk',
    headers=>'{"Content-Type": "application/json"}',
    body=>'{"outlet_id": 37}'
  )$$
);

-- Schedule: Alert cleanup every day at midnight
SELECT cron.schedule(
  'alert-cleanup',
  '0 0 * * *',
  $$DELETE FROM public.alerts WHERE status = 'RESOLVED' AND resolved_at < NOW() - INTERVAL '30 days'$$
);

-- Verify schedules
SELECT jobname, schedule, command FROM cron.job;
