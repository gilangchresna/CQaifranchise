-- Final RLS Fix v2 - Drop all existing and create simple allow-all for authenticated
-- This ensures all authenticated users can read data

-- Drop existing policies on critical tables
DROP POLICY IF EXISTS "Authenticated users can read regions" ON public.regions;
DROP POLICY IF EXISTS "Authenticated users can read outlets" ON public.outlets;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can read alerts" ON public.alerts;
DROP POLICY IF EXISTS "Authenticated users can read sales" ON public.sales_transactions;
DROP POLICY IF EXISTS "Authenticated users can read pilot" ON public.pilot_outreach;
DROP POLICY IF EXISTS "Authenticated users can read cases" ON public.cases;

-- Create simple allow-all policies for authenticated users
CREATE POLICY "auth_read_regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_outlets" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_sales" ON public.sales_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_pilot" ON public.pilot_outreach FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_cases" ON public.cases FOR SELECT TO authenticated USING (true);

-- Allow inserts for authenticated users (for future use)
CREATE POLICY "auth_insert_alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert_cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (true);

-- Service role can do everything
CREATE POLICY "service_all_regions" ON public.regions FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_outlets" ON public.outlets FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_user_profiles" ON public.user_profiles FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_alerts" ON public.alerts FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_sales" ON public.sales_transactions FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_pilot" ON public.pilot_outreach FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_cases" ON public.cases FOR ALL TO service_role USING (true);
