-- Fix RLS for cases table
-- Allow service role full access, authenticated users read access

-- Drop existing policies if any (to recreate cleanly)
DROP POLICY IF EXISTS "Service role full access cases" ON public.cases;
DROP POLICY IF EXISTS "Allow read cases" ON public.cases;
DROP POLICY IF EXISTS "Allow read" ON public.cases FOR SELECT TO authenticated USING (true);

-- Enable RLS
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access cases"
    ON public.cases
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "Allow read cases authenticated"
    ON public.cases
    FOR SELECT
    TO authenticated
    USING (true);

-- Verification
SELECT 'cases' as table, count(*) as policies_count FROM pg_policies WHERE tablename = 'cases';
