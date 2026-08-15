-- Clean up old/permissive policies for alerts, cases, inventory, ml_anomaly_scores
-- Run this BEFORE the scoped policies

-- ============================================================
-- alerts — drop old/permissive
-- ============================================================
DROP POLICY IF EXISTS "Allow all" ON public.alerts;
DROP POLICY IF EXISTS "Authenticated can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Authenticated can update alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can view alerts for their outlets" ON public.alerts;
DROP POLICY IF EXISTS "Service role can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role full access alerts" ON public.alerts;
DROP POLICY IF EXISTS "auth_insert_alerts" ON public.alerts;
DROP POLICY IF EXISTS "auth_read_alerts" ON public.alerts;
DROP POLICY IF EXISTS "service_all_alerts" ON public.alerts;

-- ============================================================
-- cases — drop old/permissive
-- ============================================================
DROP POLICY IF EXISTS "Allow all" ON public.cases;
DROP POLICY IF EXISTS "Assigned users can view cases" ON public.cases;
DROP POLICY IF EXISTS "Assigned users can update cases" ON public.cases;
DROP POLICY IF EXISTS "Authenticated can insert cases" ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can create cases" ON public.cases;
DROP POLICY IF EXISTS "Service role full access cases" ON public.cases;
DROP POLICY IF EXISTS "auth_insert_cases" ON public.cases;
DROP POLICY IF EXISTS "auth_read_cases" ON public.cases;
DROP POLICY IF EXISTS "service_all_cases" ON public.cases;

-- ============================================================
-- inventory — drop old/permissive
-- ============================================================
DROP POLICY IF EXISTS "Allow all" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Service role full access inventory" ON public.inventory;

-- ============================================================
-- ml_anomaly_scores — drop old/permissive
-- ============================================================
DROP POLICY IF EXISTS "Allow all" ON public.ml_anomaly_scores;
DROP POLICY IF EXISTS "Authenticated can view ml_anomaly_scores" ON public.ml_anomaly_scores;
DROP POLICY IF EXISTS "Service role full access ml_anomaly_scores" ON public.ml_anomaly_scores;

-- Verify remaining
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies
WHERE tablename IN ('alerts', 'cases', 'inventory', 'ml_anomaly_scores')
ORDER BY tablename, policyname;
