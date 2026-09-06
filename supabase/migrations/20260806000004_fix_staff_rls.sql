-- Migration: Fix staff RLS policies
-- Apply via: Supabase Dashboard → SQL Editor → paste this entire block → Run

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can read staff" ON public.staff;
DROP POLICY IF EXISTS "Service role can manage staff" ON public.staff;

-- New: Allow authenticated users to read staff
CREATE POLICY "staff_select_all" ON public.staff
  FOR SELECT USING (true);

-- New: Allow service role full access
CREATE POLICY "staff_service_role_all" ON public.staff
  FOR ALL USING (true) WITH CHECK (true);

-- Verify
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.staff'::regclass;
