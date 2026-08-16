-- ============================================================
-- Data Retention Cleanup - Simple SQL Version
-- Date: 2026-08-16
-- Simpler approach: direct DELETE statements per table
-- ============================================================

-- Step 1: Create retention_cleanup function using simple SQL
CREATE OR REPLACE FUNCTION public.retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if retention is enabled
  IF EXISTS (SELECT 1 FROM public.settings WHERE key = 'retention_enabled' AND value != 'true') THEN
    RAISE NOTICE 'Retention cleanup is disabled';
    RETURN;
  END IF;

  -- Check dry run mode
  IF EXISTS (SELECT 1 FROM public.settings WHERE key = 'retention_dry_run' AND value = 'true') THEN
    RAISE NOTICE '[DRY RUN] Retention cleanup would run but dry_run=true, skipping actual deletes';
    RETURN;
  END IF;

  -- 1. Alerts (RESOLVED/CLOSED older than retention_days_alerts days)
  DELETE FROM public.alerts
  WHERE status IN ('RESOLVED', 'CLOSED')
    AND updated_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 30) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_alerts'
    );

  -- 2. Cases (CLOSED older than retention_days_cases days)
  DELETE FROM public.cases
  WHERE status = 'CLOSED'
    AND closed_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 730) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_cases'
    );

  -- 3. AI audit log (older than retention_days_ai_audit_log days)
  DELETE FROM public.ai_audit_log
  WHERE created_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 365) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_ai_audit_log'
    );

  -- 4. Notification logs (older than retention_days_notification_logs days)
  DELETE FROM public.notification_logs
  WHERE created_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 365) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_notification_logs'
    );

  -- 5. Lender webhook events (older than retention_days_lender_webhook_events days)
  DELETE FROM public.lender_webhook_events
  WHERE created_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 365) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_lender_webhook_events'
    );

  -- 6. Function execution logs (older than retention_days_function_execution_logs days)
  DELETE FROM public.function_execution_logs
  WHERE created_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 90) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_function_execution_logs'
    );

  -- 7. ML error logs (older than retention_days_ml_error_logs days)
  DELETE FROM public.ml_error_logs
  WHERE created_at < NOW() - (
      SELECT COALESCE(value::INTEGER, 90) * INTERVAL '1 day'
      FROM public.settings WHERE key = 'retention_days_ml_error_logs'
    );

  RAISE NOTICE 'Retention cleanup completed successfully';
END;
$$;

-- Step 2: Safely unschedule old cron jobs (ignore if not exist)
DO $$
BEGIN
  PERFORM cron.unschedule('alert-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('ml-scores-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

-- Step 3: Register new dynamic retention-cleanup cron (daily at 2 AM)
SELECT cron.schedule(
  'retention-cleanup',
  '0 2 * * *',
  'SELECT public.retention_cleanup()'
);

-- Step 4: Verify
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'retention-cleanup';
