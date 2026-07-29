-- Re-enable RLS for production
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.user_profiles;
CREATE POLICY "Service role full access profiles"
    ON public.user_profiles FOR ALL
    TO service_role
    USING (true);
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
