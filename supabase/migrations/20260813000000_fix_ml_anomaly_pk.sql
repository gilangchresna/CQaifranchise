-- Fix ml_anomaly_scores: add BIGINT id PK and unique constraint for upsert
-- No data loss: adds id column, backfills from sequence, sets PK

-- Step 1: Add id column as BIGINT (nullable, will be set by sequence)
ALTER TABLE ml_anomaly_scores
  ADD COLUMN IF NOT EXISTS id BIGSERIAL PRIMARY KEY;

-- Step 2: For any existing rows with NULL id (should be none), assign from sequence
UPDATE ml_anomaly_scores
  SET id = nextval(pg_get_serial_sequence('ml_anomaly_scores', 'id'))
  WHERE id IS NULL;

-- Step 3: Ensure uniqueness constraint for upsert per outlet+recorded_at
ALTER TABLE ml_anomaly_scores
  DROP CONSTRAINT IF EXISTS ml_anomaly_scores_outlet_time_unique;

ALTER TABLE ml_anomaly_scores
  ADD CONSTRAINT ml_anomaly_scores_outlet_time_unique
  UNIQUE (outlet_id, recorded_at);

-- Step 4: Ensure ml_stockout_risk also has id
ALTER TABLE ml_stockout_risk
  ADD COLUMN IF NOT EXISTS id BIGSERIAL PRIMARY KEY;

ALTER TABLE ml_stockout_risk
  DROP CONSTRAINT IF EXISTS ml_stockout_risk_outlet_time_unique;

ALTER TABLE ml_stockout_risk
  ADD CONSTRAINT ml_stockout_risk_outlet_time_unique
  UNIQUE (outlet_id, recorded_at);

-- Step 5: Grant service role permissions
GRANT USAGE ON SEQUENCE ml_anomaly_scores_id_seq TO authenticated, anon, service_role;
GRANT USAGE ON SEQUENCE ml_stockout_risk_id_seq TO authenticated, anon, service_role;
