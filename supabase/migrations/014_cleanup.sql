-- Drop old policies first
DROP POLICY IF EXISTS "Service role full access pilot_outreach" ON public.pilot_outreach;
DROP POLICY IF EXISTS "anon_insert" ON public.pilot_outreach;
DROP POLICY IF EXISTS "anon_select" ON public.pilot_outreach;

-- Now disable RLS
ALTER TABLE public.regions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_outreach DISABLE ROW LEVEL SECURITY;
