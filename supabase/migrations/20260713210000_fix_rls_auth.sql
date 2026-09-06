-- Fix RLS Policies for CyberQuote
-- Allow authenticated users to read all data

-- Enable RLS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Regions: allow authenticated users to read
CREATE POLICY "Authenticated users can read regions"
  ON public.regions FOR SELECT
  TO authenticated
  USING (true);

-- Outlets: allow authenticated users to read
CREATE POLICY "Authenticated users can read outlets"
  ON public.outlets FOR SELECT
  TO authenticated
  USING (true);

-- User profiles: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Alerts: allow authenticated users to read
CREATE POLICY "Authenticated users can read alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (true);

-- Allow inserts/updates for service role only
CREATE POLICY "Service role full access regions"
  ON public.regions FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access outlets"
  ON public.outlets FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access user_profiles"
  ON public.user_profiles FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access alerts"
  ON public.alerts FOR ALL
  TO service_role
  USING (true);
