-- Drop all existing policies
DROP POLICY IF EXISTS "Service role full access regions" ON public.regions;
DROP POLICY IF EXISTS "Service role full access outlets" ON public.outlets;
DROP POLICY IF EXISTS "Service role full access user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access sales_transactions" ON public.sales_transactions;
DROP POLICY IF EXISTS "Service policy for sales_transactions" ON public.sales_transactions;
DROP POLICY IF EXISTS "Service role full access alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role full access pilot_outreach" ON public.pilot_outreach;

-- Disable RLS on all tables
ALTER TABLE public.regions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_outreach DISABLE ROW LEVEL SECURITY;
