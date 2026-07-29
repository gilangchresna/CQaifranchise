-- =============================================================================
-- CyberQuote ML Batch Scoring - Nightly Cron Jobs
-- 
-- Configure the service role key in Supabase Dashboard → Project Settings → 
-- Edge Functions → Secrets. The key should be named: SUPABASE_SERVICE_ROLE_KEY
-- =============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests (required for calling edge functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- IMPORTANT: Grant necessary permissions for pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- =============================================================================
-- Nightly Batch Scoring Schedule
-- The ml-scheduler is the orchestrator that:
-- 1. Calls ml-batch-score to process all outlets
-- 2. Generates alerts for high-risk items
-- =============================================================================

-- ML Scheduler: Every night at 2 AM (off-peak hours)
-- This processes ALL active outlets and persists scores to ml_scores table
SELECT cron.schedule(
  'ml-scheduler-nightly',
  '0 2 * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-scheduler',
    headers=>'{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
    body=>'{"force": false}'
  )$$
);

-- ML Scheduler: Every 6 hours for freshness (optional mid-day refresh)
-- Uncomment below if you want more frequent updates during business hours
-- SELECT cron.schedule(
--   'ml-scheduler-6hours',
--   '0 8,14,20 * * *',
--   $$SELECT net.http_post(
--     url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ml-scheduler',
--     headers=>'{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
--     body=>'{"force": false}'
--   )$$
-- );

-- =============================================================================
-- Alert Cleanup Schedule
-- =============================================================================

-- Clean up old resolved alerts (keep for 30 days)
SELECT cron.schedule(
  'alert-cleanup',
  '0 3 * * *',
  $$DELETE FROM public.alerts WHERE status IN ('RESOLVED', 'CLOSED') AND updated_at < NOW() - INTERVAL '30 days'$$
);

-- =============================================================================
-- Cleanup Old ML Scores (keep last 90 days)
-- =============================================================================

-- Clean up old ml_scores to prevent table bloat
SELECT cron.schedule(
  'ml-scores-cleanup',
  '0 4 * * 0',
  $$DELETE FROM public.ml_scores WHERE scored_at < NOW() - INTERVAL '90 days'$$
);

-- =============================================================================
-- Verify schedules are active
-- =============================================================================

-- View all scheduled jobs
-- SELECT jobname, schedule, command, active FROM cron.job WHERE jobname LIKE '%ml%' OR jobname LIKE '%alert%';

-- Drop schedules (run if needed to disable)
-- SELECT cron.unschedule('ml-scheduler-nightly');
-- SELECT cron.unschedule('alert-cleanup');
-- SELECT cron.unschedule('ml-scores-cleanup');
