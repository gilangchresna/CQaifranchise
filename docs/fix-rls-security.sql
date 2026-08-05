-- =============================================================================
-- RLS SECURITY FIX - Run in Supabase Dashboard → SQL Editor
-- Date: July 16, 2026
-- =============================================================================

-- =============================================================================
-- STEP 1: Helper Functions (SECURITY DEFINER - bypass RLS)
-- =============================================================================

-- get_user_role: Get user's role from user_profiles
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM user_profiles WHERE id = p_user_id;
  RETURN COALESCE(user_role, 'AUTHENTICATED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_hq_admin: Check if current user is HQ_ADMIN
CREATE OR REPLACE FUNCTION is_hq_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(auth.uid()) = 'HQ_ADMIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_regional_manager: Check if current user is REGIONAL_MANAGER
CREATE OR REPLACE FUNCTION is_regional_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(auth.uid()) IN ('REGIONAL_MANAGER', 'HQ_ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_franchise_owner: Check if current user is franchise owner
CREATE OR REPLACE FUNCTION is_franchise_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(auth.uid()) IN ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF', 'REGIONAL_MANAGER', 'HQ_ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- user_owns_outlet: Check if user owns the outlet
CREATE OR REPLACE FUNCTION user_owns_outlet(p_outlet_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  user_outlet_id INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT outlet_id INTO user_outlet_id FROM user_profiles WHERE id = auth.uid();
  RETURN p_outlet_id = user_outlet_id OR is_hq_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- user_in_outlet_region: Check if user is in the outlet's region
CREATE OR REPLACE FUNCTION user_in_outlet_region(p_outlet_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  user_region_id INTEGER;
  outlet_region_id INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF is_hq_admin() THEN RETURN TRUE; END IF;
  IF is_regional_manager() THEN
    SELECT region_id INTO user_region_id FROM user_profiles WHERE id = auth.uid();
    SELECT region_id INTO outlet_region_id FROM outlets WHERE id = p_outlet_id;
    RETURN user_region_id = outlet_region_id;
  END IF;
  RETURN user_owns_outlet(p_outlet_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 2: Enable RLS on all tables
-- =============================================================================
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_versions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: Create RLS Policies
-- =============================================================================

-- ALERTS Policies
DROP POLICY IF EXISTS alerts_select_hq ON alerts;
CREATE POLICY alerts_select_hq ON alerts FOR SELECT USING (is_hq_admin());

DROP POLICY IF EXISTS alerts_select_regional ON alerts;
CREATE POLICY alerts_select_regional ON alerts FOR SELECT 
  USING (is_regional_manager() AND region_id IN (SELECT region_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS alerts_select_owner ON alerts;
CREATE POLICY alerts_select_owner ON alerts FOR SELECT 
  USING (user_owns_outlet(outlet_id));

DROP POLICY IF EXISTS alerts_insert_hq ON alerts;
CREATE POLICY alerts_insert_hq ON alerts FOR INSERT WITH CHECK (is_hq_admin() OR is_regional_manager());

DROP POLICY IF EXISTS alerts_update_hq ON alerts;
CREATE POLICY alerts_update_hq ON alerts FOR UPDATE USING (is_hq_admin() OR is_regional_manager()) WITH CHECK (is_hq_admin() OR is_regional_manager());

-- CASES Policies
DROP POLICY IF EXISTS cases_select_hq ON cases;
CREATE POLICY cases_select_hq ON cases FOR SELECT USING (is_hq_admin());

DROP POLICY IF EXISTS cases_select_regional ON cases;
CREATE POLICY cases_select_regional ON cases FOR SELECT USING (is_regional_manager());

DROP POLICY IF EXISTS cases_select_assigned ON cases;
CREATE POLICY cases_select_assigned ON cases FOR SELECT USING (assigned_to_id = auth.uid());

DROP POLICY IF EXISTS cases_insert_hq ON cases;
CREATE POLICY cases_insert_hq ON cases FOR INSERT WITH CHECK (is_hq_admin() OR is_regional_manager());

DROP POLICY IF EXISTS cases_update_assigned ON cases;
CREATE POLICY cases_update_assigned ON cases FOR UPDATE 
  USING (assigned_to_id = auth.uid() OR is_hq_admin()) 
  WITH CHECK (assigned_to_id = auth.uid() OR is_hq_admin());

-- OUTLETS Policies
DROP POLICY IF EXISTS outlets_select_hq ON outlets;
CREATE POLICY outlets_select_hq ON outlets FOR SELECT USING (is_hq_admin());

DROP POLICY IF EXISTS outlets_select_regional ON outlets;
CREATE POLICY outlets_select_regional ON outlets FOR SELECT 
  USING (is_regional_manager() AND region_id IN (SELECT region_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS outlets_select_owner ON outlets;
CREATE POLICY outlets_select_owner ON outlets FOR SELECT USING (user_owns_outlet(id));

-- SALES_TRANSACTIONS Policies
DROP POLICY IF EXISTS sales_select_hq ON sales_transactions;
CREATE POLICY sales_select_hq ON sales_transactions FOR SELECT USING (is_hq_admin());

DROP POLICY IF EXISTS sales_select_regional ON sales_transactions;
CREATE POLICY sales_select_regional ON sales_transactions FOR SELECT USING (user_in_outlet_region(outlet_id));

DROP POLICY IF EXISTS sales_select_owner ON sales_transactions;
CREATE POLICY sales_select_owner ON sales_transactions FOR SELECT USING (user_owns_outlet(outlet_id));

-- INVENTORY Policies
DROP POLICY IF EXISTS inventory_select_hq ON inventory;
CREATE POLICY inventory_select_hq ON inventory FOR SELECT USING (is_hq_admin());

DROP POLICY IF EXISTS inventory_select_regional ON inventory;
CREATE POLICY inventory_select_regional ON inventory FOR SELECT USING (is_regional_manager());

DROP POLICY IF EXISTS inventory_select_owner ON inventory;
CREATE POLICY inventory_select_owner ON inventory FOR SELECT USING (user_owns_outlet(outlet_id));

-- USER_PROFILES Policies
DROP POLICY IF EXISTS user_profiles_select_own ON user_profiles;
CREATE POLICY user_profiles_select_own ON user_profiles FOR SELECT USING (id = auth.uid() OR is_hq_admin());

DROP POLICY IF EXISTS user_profiles_update_own ON user_profiles;
CREATE POLICY user_profiles_update_own ON user_profiles FOR UPDATE USING (id = auth.uid() OR is_hq_admin());

-- REGIONS Policies
DROP POLICY IF EXISTS regions_select_hq ON regions;
CREATE POLICY regions_select_hq ON regions FOR SELECT USING (is_hq_admin() OR is_regional_manager());

DROP POLICY IF EXISTS regions_select_franchise ON regions;
CREATE POLICY regions_select_franchise ON regions FOR SELECT USING (is_franchise_owner());

-- =============================================================================
-- STEP 4: Verify
-- =============================================================================
SELECT 'Functions created:' as info, COUNT(*) as count FROM pg_proc WHERE proname LIKE 'is_%' OR proname LIKE 'user_%'
UNION ALL
SELECT 'Policies created:', COUNT(*) FROM pg_policies WHERE schemaname = 'public';
