-- RBAC Policies for Staff Table
-- Fix: Staff should be filtered by user's outlet access

-- Drop existing permissive policies (allow all)
DROP POLICY IF EXISTS "Allow all" ON staff;
DROP POLICY IF EXISTS "Staff all for service_role" ON staff;
DROP POLICY IF EXISTS "Staff can be read by anyone" ON staff;
DROP POLICY IF EXISTS "Staff read for authenticated" ON staff;
DROP POLICY IF EXISTS "Staff read for public" ON staff;
DROP POLICY IF EXISTS "staff_select_all" ON staff;
DROP POLICY IF EXISTS "staff_service_role_all" ON staff;

-- Ensure RLS is enabled
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- HQ_ADMIN: can see all staff
CREATE POLICY "staff_hq_all" ON staff
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'HQ_ADMIN'
    )
  );

-- REGIONAL_MANAGER: can see staff in their region
CREATE POLICY "staff_regional_select" ON staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
      AND up.role = 'REGIONAL_MANAGER'
      AND o.id = staff.outlet_id
    )
  );

-- REGIONAL_MANAGER: can insert/update staff
CREATE POLICY "staff_regional_insert" ON staff
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
      AND up.role = 'REGIONAL_MANAGER'
      AND o.id = staff.outlet_id
    )
  );

CREATE POLICY "staff_regional_update" ON staff
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN outlets o ON o.region_id = up.region_id
      WHERE up.id = auth.uid()
      AND up.role = 'REGIONAL_MANAGER'
      AND o.id = staff.outlet_id
    )
  );

-- FRANCHISEE_OWNER & STAFF: can see staff in their outlets
CREATE POLICY "staff_franchisee_select" ON staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_outlets
      WHERE user_outlets.user_id = auth.uid()
      AND user_outlets.outlet_id = staff.outlet_id
    )
  );

-- SERVICE_ROLE: bypass RLS
CREATE POLICY "staff_service_role_all" ON staff
  FOR ALL
  USING (auth.role() = 'service_role');

-- Verify policies
SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'staff';
