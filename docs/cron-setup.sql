-- =============================================================================
-- IMPORTANT SECURITY NOTE
-- =============================================================================
-- All secrets (SERVICE_ROLE_KEY, GEMINI_API_KEY, etc.) must be configured via:
-- Supabase Dashboard → Project Settings → Edge Functions → Secrets
--
-- DO NOT hardcode JWT tokens or API keys in SQL files.
-- The pg_cron extension uses service_role by default when calling Edge Functions.
-- =============================================================================

-- STEP 1: Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres, service_role;
GRANT ALL ON TABLE cron.job TO postgres, service_role;
GRANT ALL ON TABLE cron.job_run_details TO postgres, service_role;

-- =============================================================================
-- STEP 2: Schedule ML Anomaly Check (every 15 minutes)
-- =============================================================================
SELECT cron.schedule(
  'ml-anomaly-check',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url:='https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-anomaly-score',
      headers:= '{"Content-Type": "application/json"}',
      body:= '{"outlet_id": 37}'
    );
  $$
);

-- =============================================================================
-- STEP 3: Schedule Stockout Risk Check (every hour)
-- =============================================================================
SELECT cron.schedule(
  'ml-stockout-check',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url:='https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-stockout-risk',
      headers:= '{"Content-Type": "application/json"}',
      body:= '{"outlet_id": 37}'
    );
  $$
);

-- =============================================================================
-- STEP 4: Schedule ML Batch Score (every 6 hours)
-- =============================================================================
SELECT cron.schedule(
  'ml-batch-score',
  '0 */6 * * *',
  $$
    SELECT net.http_post(
      url:='https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-batch-score',
      headers:= '{"Content-Type": "application/json"}',
      body:= '{}'
    );
  $$
);

-- =============================================================================
-- STEP 5: Alert Cleanup (daily at midnight - delete resolved alerts > 30 days)
-- =============================================================================
SELECT cron.schedule(
  'alert-cleanup',
  '0 0 * * *',
  $$
    DELETE FROM public.alerts 
    WHERE status = 'RESOLVED' 
    AND resolved_at < NOW() - INTERVAL '30 days';
  $$
);

-- =============================================================================
-- STEP 6: Verify scheduled jobs
-- =============================================================================
SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname;
