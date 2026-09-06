-- Run this SQL in Supabase Dashboard → SQL Editor
-- Creates ML pipeline tables

CREATE TABLE IF NOT EXISTS ml_anomaly_scores (
  outlet_id BIGINT PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  anomaly_score FLOAT DEFAULT 0,
  percentile SMALLINT CHECK (percentile BETWEEN 0 AND 100),
  is_anomaly BOOLEAN DEFAULT FALSE,
  status TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_stockout_risk (
  outlet_id BIGINT PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  risk_level TEXT,
  days_remaining SMALLINT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
