-- =============================================================================
-- Migration: 20260801000000_enable_missing_rls.sql
--
-- BUG FIX: tracing the full migration history in true apply order (see
-- supabase/migrations/RENAME_MAP.md for how that order was preserved) shows
-- several tables were left with Row Level Security OFF, despite having
-- policies defined for them elsewhere in this same history. A policy has no
-- effect at all while RLS is disabled on its table - so these tables are
-- currently open to full read/write via any role with default table grants
-- (i.e. any authenticated Supabase user), regardless of the policies that
-- look like they protect them.
--
-- Root cause: 013_fix_rls.sql / 014_cleanup.sql (temporary "fix" migrations)
-- disabled RLS on regions/outlets/user_profiles/sales_transactions/alerts/
-- pilot_outreach, and 015_fix_rls_auth.sql only re-enabled regions, outlets,
-- alerts, and user_profiles afterwards - sales_transactions and
-- pilot_outreach were never re-enabled. Separately, 004_disable_user_rls.sql
-- disabled RLS on user_profiles/regions/cases/ai_explanations/
-- ml_model_versions/webhook_secrets, and while 006_production_rls.sql
-- re-enabled most of those, it did not cover ai_explanations,
-- ml_model_versions, or webhook_secrets. And several tables created later
-- (outlet_classifications, peer_metrics, peer_snapshots, approval_requests,
-- approval_history, approval_rules, plus a handful of ML/ops logging tables)
-- never had RLS enabled at all in any migration.
--
-- This migration is idempotent (ENABLE ROW LEVEL SECURITY is a no-op if
-- already enabled) and safe to run regardless of the table's current state.
-- =============================================================================

-- Tables that already have real policies defined (in 016_final_rls_fix /
-- 032_fix_rls) but where RLS itself was left disabled, so those policies
-- were never actually being enforced:
ALTER TABLE IF EXISTS public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pilot_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ml_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_secrets ENABLE ROW LEVEL SECURITY;

-- Tables that have never had RLS enabled or any policy defined for them.
-- Enable RLS with a service-role-only policy so edge functions (which use
-- the service role key and bypass RLS anyway) keep working, while locking
-- out anon/authenticated access by default until real per-role policies are
-- designed for these. This is a deliberate "closed by default" choice -
-- if the frontend or an edge function needs authenticated-user access to
-- any of these tables, add a specific SELECT/INSERT/UPDATE policy for it
-- rather than reverting to no RLS.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'outlet_classifications', 'peer_metrics', 'peer_snapshots',
    'approval_requests', 'approval_history', 'approval_rules',
    'alert_thresholds', 'alert_generation_metrics', 'anomaly_labels',
    'function_execution_logs', 'ml_error_logs', 'outlet_features',
    'sla_breach_events', 'threshold_violations'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format(
        'DROP POLICY IF EXISTS "Service role full access" ON public.%I;', t
      );
      EXECUTE format(
        'CREATE POLICY "Service role full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', t
      );
    END IF;
  END LOOP;
END $$;

-- Verification: list any public table that still has RLS disabled. Should
-- return zero rows once this migration and 20260713*_*.sql have all run.
SELECT relname AS table_still_without_rls
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relrowsecurity = false;
