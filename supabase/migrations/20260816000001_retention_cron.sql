-- ============================================================
-- Data Retention Cleanup - Dynamic Settings-Based Cron
-- Date: 2026-08-16
-- Purpose: Update existing cron jobs to read retention days from settings table
-- ============================================================

-- Step 1: Create a PostgreSQL function that reads from settings and does cleanup
CREATE OR REPLACE FUNCTION public.retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  retention_enabled_val TEXT;
  retention_dry_run_val TEXT;
  days_alerts INTEGER;
  days_cases INTEGER;
  days_ml_scores INTEGER;
  days_ml_anomaly INTEGER;
  days_ai_audit INTEGER;
  days_notifications INTEGER;
  days_lender_webhook INTEGER;
  days_function_logs INTEGER;
  days_ml_errors INTEGER;
  days_sales INTEGER;
  days_repayment INTEGER;
  cutoff_date TIMESTAMPTZ;
  deleted_count INTEGER;
BEGIN
  -- Check if retention is enabled
  SELECT value INTO retention_enabled_val
  FROM public.settings WHERE key = 'retention_enabled';

  IF retention_enabled_val != 'true' THEN
    RAISE NOTICE 'Retention cleanup is disabled';
    RETURN;
  END IF;

  -- Check dry run mode
  SELECT value INTO retention_dry_run_val
  FROM public.settings WHERE key = 'retention_dry_run';

  -- Get retention days from settings (with fallbacks)
  SELECT COALESCE(value::INTEGER, 30) INTO days_alerts
  FROM public.settings WHERE key = 'retention_days_alerts';

  SELECT COALESCE(value::INTEGER, 730) INTO days_cases
  FROM public.settings WHERE key = 'retention_days_cases';

  SELECT COALESCE(value::INTEGER, 90) INTO days_ml_scores
  FROM public.settings WHERE key = 'retention_days_ml_scores';

  SELECT COALESCE(value::INTEGER, 90) INTO days_ml_anomaly
  FROM public.settings WHERE key = 'retention_days_ml_anomaly_scores';

  SELECT COALESCE(value::INTEGER, 365) INTO days_ai_audit
  FROM public.settings WHERE key = 'retention_days_ai_audit_log';

  SELECT COALESCE(value::INTEGER, 365) INTO days_notifications
  FROM public.settings WHERE key = 'retention_days_notification_logs';

  SELECT COALESCE(value::INTEGER, 365) INTO days_lender_webhook
  FROM public.settings WHERE key = 'retention_days_lender_webhook_events';

  SELECT COALESCE(value::INTEGER, 90) INTO days_function_logs
  FROM public.settings WHERE key = 'retention_days_function_execution_logs';

  SELECT COALESCE(value::INTEGER, 90) INTO days_ml_errors
  FROM public.settings WHERE key = 'retention_days_ml_error_logs';

  SELECT COALESCE(value::INTEGER, 2555) INTO days_sales
  FROM public.settings WHERE key = 'retention_days_sales_transactions';

  SELECT COALESCE(value::INTEGER, 1825) INTO days_repayment
  FROM public.settings WHERE key = 'retention_days_repayment_events';

  -- Log what we're doing
  RAISE NOTICE 'Retention cleanup starting (dry_run=%)', retention_dry_run_val;
  RAISE NOTICE '  alerts: %, cases: %, ml_scores: %', days_alerts, days_cases, days_ml_scores;

  -- Dry run mode: just report counts, don't delete
  IF retention_dry_run_val = 'true' THEN
    RAISE NOTICE '[DRY RUN] Would delete alerts older than % days', days_alerts;
    RAISE NOTICE '[DRY RUN] Would delete cases older than % days', days_cases;
    RETURN;
  END IF;

  -- Execute cleanups
  -- 1. Alerts (RESOLVED/CLOSED only)
  EXECUTE format(
    'DELETE FROM public.alerts WHERE status IN (%L, %L) AND updated_at < NOW() - ($1 || '' days'')::INTERVAL',
    'RESOLVED', 'CLOSED'
  ) USING days_alerts::TEXT;

  -- 2. Cases (CLOSED only)
  EXECUTE format(
    'DELETE FROM public.cases WHERE status = %L AND closed_at < NOW() - ($1 || '' days'')::INTERVAL',
    'CLOSED'
  ) USING days_cases::TEXT;

  -- 3. AI audit log
  EXECUTE format(
    'DELETE FROM public.ai_audit_log WHERE created_at < NOW() - ($1 || '' days'')::INTERVAL'
  ) USING days_ai_audit::TEXT;

  -- 4. Notification logs
  EXECUTE format(
    'DELETE FROM public.notification_logs WHERE created_at < NOW() - ($1 || '' days'')::INTERVAL'
  ) USING days_notifications::TEXT;

  -- 5. Lender webhook events
  EXECUTE format(
    'DELETE FROM public.lender_webhook_events WHERE created_at < NOW() - ($1 || '' days'')::INTERVAL'
  ) USING days_lender_webhook::TEXT;

  -- 6. Function execution logs
  EXECUTE format(
    'DELETE FROM public.function_execution_logs WHERE created_at < NOW() - ($1 || '' days'')::INTERVAL'
  ) USING days_function_logs::TEXT;

  -- 7. ML error logs
  EXECUTE format(
    'DELETE FROM public.ml_error_logs WHERE created_at < NOW() - ($1 || '' days'')::INTERVAL'
  ) USING days_ml_errors::TEXT;

  RAISE NOTICE 'Retention cleanup completed';
END;
$$;

-- Step 2: Unschedule old static cron jobs (ignore if not exists)
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
  $$SELECT public.retention_cleanup()$$
);

-- Step 4: Verify the new schedule
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'retention-cleanup';
