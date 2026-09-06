-- Fix RLS: ensure service_role can bypass all policies
-- Run via Supabase Dashboard SQL Editor

-- regions: allow service_role full access
DROP POLICY IF EXISTS "Allow service_role all on regions" ON regions;
CREATE POLICY "Allow service_role all on regions"
  ON regions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- outlets: allow service_role full access  
DROP POLICY IF EXISTS "Allow service_role all on outlets" ON outlets;
CREATE POLICY "Allow service_role all on outlets"
  ON outlets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- user_profiles: allow service_role full access
DROP POLICY IF EXISTS "Allow service_role all on user_profiles" ON user_profiles;
CREATE POLICY "Allow service_role all on user_profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ml_anomaly_scores: add id PK and allow service_role
ALTER TABLE ml_anomaly_scores ADD COLUMN IF NOT EXISTS id BIGSERIAL PRIMARY KEY;
DROP POLICY IF EXISTS "Allow service_role all on ml_anomaly_scores" ON ml_anomaly_scores;
CREATE POLICY "Allow service_role all on ml_anomaly_scores"
  ON ml_anomaly_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ml_stockout_risk: add id PK and allow service_role
ALTER TABLE ml_stockout_risk ADD COLUMN IF NOT EXISTS id BIGSERIAL PRIMARY KEY;
DROP POLICY IF EXISTS "Allow service_role all on ml_stockout_risk" ON ml_stockout_risk;
CREATE POLICY "Allow service_role all on ml_stockout_risk"
  ON ml_stockout_risk FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant usage on sequences
GRANT USAGE ON SEQUENCE ml_anomaly_scores_id_seq TO service_role;
GRANT USAGE ON SEQUENCE ml_stockout_risk_id_seq TO service_role;
