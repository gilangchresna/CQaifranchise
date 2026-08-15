-- RBAC Scoped Alerts + ml_anomaly_scores + cases
-- Phase: Alerts filtered by role/region
-- Date: 2026-08-15

-- ============================================================
-- 1. alerts table — scoped RLS
-- ============================================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can read alerts" ON public.alerts;

-- HQ_ADMIN: see all
CREATE POLICY "HQ sees all alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- REGIONAL_MANAGER: see alerts for outlets in their region
CREATE POLICY "Regional sees region alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'REGIONAL_MANAGER'
        AND o.id = alerts.outlet_id
    )
  );

-- FRANCHISEE_OWNER: see alerts for outlets in their region
CREATE POLICY "Franchisee sees region alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_OWNER'
        AND o.id = alerts.outlet_id
    )
  );

-- FRANCHISEE_STAFF: see alerts for outlets in their region
CREATE POLICY "Staff sees region alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_STAFF'
        AND o.id = alerts.outlet_id
    )
  );

-- ============================================================
-- 2. ml_anomaly_scores — scoped RLS
-- ============================================================

-- Drop existing
DROP POLICY IF EXISTS "Authenticated users can read ml_anomaly_scores" ON public.ml_anomaly_scores;

-- HQ_ADMIN: see all
CREATE POLICY "HQ sees all anomaly scores"
  ON public.ml_anomaly_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- REGIONAL_MANAGER: see scores for outlets in their region
CREATE POLICY "Regional sees region anomaly scores"
  ON public.ml_anomaly_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'REGIONAL_MANAGER'
        AND o.id = ml_anomaly_scores.outlet_id
    )
  );

-- FRANCHISEE_OWNER: see scores for outlets in their region
CREATE POLICY "Franchisee sees region anomaly scores"
  ON public.ml_anomaly_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_OWNER'
        AND o.id = ml_anomaly_scores.outlet_id
    )
  );

-- FRANCHISEE_STAFF: see scores for outlets in their region
CREATE POLICY "Staff sees region anomaly scores"
  ON public.ml_anomaly_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_STAFF'
        AND o.id = ml_anomaly_scores.outlet_id
    )
  );

-- ============================================================
-- 3. cases — scoped RLS
-- ============================================================

-- Drop existing
DROP POLICY IF EXISTS "Authenticated can view cases" ON public.cases;

-- HQ_ADMIN: see all
CREATE POLICY "HQ sees all cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- REGIONAL_MANAGER: see cases for outlets in their region
CREATE POLICY "Regional sees region cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'REGIONAL_MANAGER'
        AND o.id = cases.outlet_id
    )
  );

-- FRANCHISEE_OWNER: see cases for outlets in their region
CREATE POLICY "Franchisee sees region cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_OWNER'
        AND o.id = cases.outlet_id
    )
  );

-- FRANCHISEE_STAFF: see cases for outlets in their region
CREATE POLICY "Staff sees region cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.region_id IS NOT NULL
        AND o.id = cases.outlet_id
    )
  );

-- ============================================================
-- 4. inventory — scoped RLS (for stockout)
-- ============================================================

-- Drop existing
DROP POLICY IF EXISTS "Authenticated users can read inventory" ON public.inventory;

-- HQ_ADMIN: see all
CREATE POLICY "HQ sees all inventory"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'HQ_ADMIN'
    )
  );

-- REGIONAL_MANAGER: see inventory for outlets in their region
CREATE POLICY "Regional sees region inventory"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'REGIONAL_MANAGER'
        AND o.id = inventory.outlet_id
    )
  );

-- FRANCHISEE_OWNER: see inventory for outlets in their region
CREATE POLICY "Franchisee sees region inventory"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_OWNER'
        AND o.id = inventory.outlet_id
    )
  );

-- FRANCHISEE_STAFF: see inventory for outlets in their region
CREATE POLICY "Staff sees region inventory"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
        AND up.role = 'FRANCHISEE_STAFF'
        AND o.id = inventory.outlet_id
    )
  );

-- ============================================================
-- 5. Verify all policies
-- ============================================================
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename IN ('alerts', 'ml_anomaly_scores', 'cases', 'inventory')
ORDER BY tablename, policyname;
