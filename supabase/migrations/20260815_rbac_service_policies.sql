-- Service role INSERT/UPDATE policies (after scoped SELECT policies)
-- Append to 20260815_rbac_alerts_scoped.sql

-- ============================================================
-- alerts: service role INSERT/UPDATE
-- ============================================================
CREATE POLICY "service_insert_alerts"
  ON public.alerts FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_alerts"
  ON public.alerts FOR UPDATE
  TO service_role
  USING (true);

-- ============================================================
-- cases: service role INSERT/UPDATE
-- ============================================================
CREATE POLICY "service_insert_cases"
  ON public.cases FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_cases"
  ON public.cases FOR UPDATE
  TO service_role
  USING (true);

-- ============================================================
-- ml_anomaly_scores: service role INSERT/UPDATE
-- ============================================================
CREATE POLICY "service_insert_ml_anomaly_scores"
  ON public.ml_anomaly_scores FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_ml_anomaly_scores"
  ON public.ml_anomaly_scores FOR UPDATE
  TO service_role
  USING (true);

-- ============================================================
-- inventory: service role INSERT/UPDATE
-- ============================================================
CREATE POLICY "service_insert_inventory"
  ON public.inventory FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_update_inventory"
  ON public.inventory FOR UPDATE
  TO service_role
  USING (true);

-- Verify
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('alerts', 'cases', 'inventory', 'ml_anomaly_scores')
ORDER BY tablename, cmd;
