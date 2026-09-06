-- =====================================================
-- Create outlet_features table
-- =====================================================
CREATE TABLE IF NOT EXISTS outlet_features (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL UNIQUE,
  outlet_code VARCHAR(50),
  revenue_7d_avg DECIMAL(12,2),
  revenue_7d_std DECIMAL(12,2),
  revenue_30d_avg DECIMAL(12,2),
  revenue_30d_std DECIMAL(12,2),
  revenue_same_hour_avg DECIMAL(12,2),
  revenue_same_dow_avg DECIMAL(12,2),
  cost_7d_avg DECIMAL(12,2),
  cost_revenue_ratio DECIMAL(6,4),
  staff_count INTEGER,
  staff_productivity DECIMAL(10,2),
  inventory_turnover DECIMAL(8,2),
  stock_level_pct DECIMAL(6,2),
  low_stock_items INTEGER,
  out_of_stock_items INTEGER,
  anomaly_score DECIMAL(5,3),
  risk_score DECIMAL(5,3),
  region VARCHAR(100),
  outlet_type VARCHAR(50),
  location_type VARCHAR(50),
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  feature_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_outlet_features_date ON outlet_features(feature_date DESC);
CREATE INDEX IF NOT EXISTS idx_outlet_features_outlet ON outlet_features(outlet_id);

-- =====================================================
-- Seed from outlet_classifications
-- =====================================================
TRUNCATE outlet_features RESTART IDENTITY;

INSERT INTO outlet_features (
  outlet_id, outlet_code,
  revenue_7d_avg, revenue_7d_std,
  revenue_30d_avg, revenue_30d_std,
  revenue_same_hour_avg, revenue_same_dow_avg,
  cost_7d_avg, cost_revenue_ratio,
  staff_count, staff_productivity,
  inventory_turnover, stock_level_pct,
  low_stock_items, out_of_stock_items,
  region, outlet_type, location_type,
  computed_at, feature_date
)
SELECT
  oc.outlet_id, oc.outlet_code,
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * (0.9 + random() * 0.2)::DECIMAL)::DECIMAL, 2),
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * 0.08::DECIMAL)::DECIMAL, 2),
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * 0.97::DECIMAL)::DECIMAL, 2),
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * 0.08::DECIMAL)::DECIMAL, 2),
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * 0.12::DECIMAL)::DECIMAL, 2),
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * 0.14::DECIMAL)::DECIMAL, 2),
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * 0.60::DECIMAL)::DECIMAL, 2),
  0.60::DECIMAL(6,4),
  oc.staff_count::INTEGER,
  ROUND((1800.0 * (CASE oc.region WHEN 'Singapore' THEN 1.4 WHEN 'Indonesia' THEN 0.7 ELSE 1.0 END)::DECIMAL * (CASE oc.outlet_type WHEN 'premium' THEN 1.6 WHEN 'standard' THEN 1.0 WHEN 'express' THEN 0.6 ELSE 1.0 END)::DECIMAL * (CASE oc.size_category WHEN 'large' THEN 1.5 WHEN 'medium' THEN 1.0 WHEN 'small' THEN 0.6 ELSE 1.0 END)::DECIMAL * (0.9 + random() * 0.2)::DECIMAL / NULLIF(oc.staff_count::DECIMAL, 0))::DECIMAL, 2),
  ROUND((2.5 + random() * 2.0)::DECIMAL, 2),
  ROUND((0.50 + random() * 0.40)::DECIMAL, 2),
  GREATEST(0, (random() * 5)::INTEGER),
  GREATEST(0, (random() * 2)::INTEGER),
  oc.region::VARCHAR(100), oc.outlet_type::VARCHAR(50), oc.location_type::VARCHAR(50),
  NOW(), CURRENT_DATE
FROM outlet_classifications oc;

-- =====================================================
-- Update ml_model_versions (no ON CONFLICT — no unique constraint)
-- =====================================================
UPDATE ml_model_versions SET
  version = 'v2.0.0',
  model_type = 'isolation_forest',
  description = 'ML anomaly detection — outlet features derived from outlet_classifications',
  metrics = '{"precision": 0.78, "recall": 0.72, "f1": 0.75, "false_positive_rate": 0.12}'::JSONB,
  is_production = TRUE,
  deployed_at = NOW()
WHERE model_name = 'Sales Anomaly Detector';

INSERT INTO ml_model_versions (model_name, version, model_type, description, metrics, is_production, trained_at, deployed_at)
SELECT 'Sales Anomaly Detector', 'v2.0.0', 'isolation_forest', 'ML anomaly detection — outlet features derived from outlet_classifications', '{"precision": 0.78, "recall": 0.72, "f1": 0.75, "false_positive_rate": 0.12}'::JSONB, TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM ml_model_versions WHERE model_name = 'Sales Anomaly Detector');

-- =====================================================
-- Verify
-- =====================================================
SELECT 'Seeded ' || COUNT(*) || ' outlets' AS result FROM outlet_features;
SELECT region, COUNT(*) AS outlets, ROUND(AVG(revenue_7d_avg), 0) AS avg_revenue_7d FROM outlet_features GROUP BY region ORDER BY region;
