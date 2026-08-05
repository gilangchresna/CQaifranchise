-- ============================================================================
-- PRODUCTION RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- OUTLETS POLICIES
CREATE POLICY "Service role full access outlets"
    ON public.outlets FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can view outlets"
    ON public.outlets FOR SELECT
    TO authenticated
    USING (true);

-- SALES TRANSACTIONS POLICIES
CREATE POLICY "Service role full access sales"
    ON public.sales_transactions FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can view sales"
    ON public.sales_transactions FOR SELECT
    TO authenticated
    USING (true);

-- ALERTS POLICIES
CREATE POLICY "Service role full access alerts"
    ON public.alerts FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can view alerts"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated can update alerts"
    ON public.alerts FOR UPDATE
    TO authenticated
    USING (true);

-- NOTIFICATIONS POLICIES
CREATE POLICY "Service role full access notifications"
    ON public.notifications FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can view notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (true);

-- USER PROFILES POLICIES
CREATE POLICY "Service role full access profiles"
    ON public.user_profiles FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- CASES POLICIES
CREATE POLICY "Service role full access cases"
    ON public.cases FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can view cases"
    ON public.cases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated can insert cases"
    ON public.cases FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- INVENTORY POLICIES
CREATE POLICY "Service role full access inventory"
    ON public.inventory FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Authenticated can view inventory"
    ON public.inventory FOR SELECT
    TO authenticated
    USING (true);

-- REGIONS POLICIES
CREATE POLICY "Authenticated can view regions"
    ON public.regions FOR SELECT
    TO authenticated
    USING (true);
