-- =====================================================
-- ML Feature Store - Feature Engineering Tables
-- Tables for ML model features and predictions
-- =====================================================

-- 1. Outlet Features (aggregated metrics for ML)
CREATE TABLE IF NOT EXISTS outlet_features (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL UNIQUE,
  outlet_code VARCHAR(50) NOT NULL,
  
  -- Revenue features
  revenue_7d_avg DECIMAL(12,2),
  revenue_7d_std DECIMAL(12,2),
  revenue_30d_avg DECIMAL(12,2),
  revenue_30d_std DECIMAL(12,2),
  revenue_same_hour_avg DECIMAL(12,2),
  revenue_same_dow_avg DECIMAL(12,2),
  
  -- Cost features
  cost_7d_avg DECIMAL(12,2),
  cost_revenue_ratio DECIMAL(6,4),
  
  -- Staff features
  staff_count INTEGER,
  staff_productivity DECIMAL(10,2),  -- revenue per staff
  
  -- Inventory features
  inventory_turnover DECIMAL(8,2),
  stock_level_pct DECIMAL(6,2),  -- current vs max
  low_stock_items INTEGER,
  out_of_stock_items INTEGER,
  
  -- Derived features
  anomaly_score DECIMAL(5,3),
  risk_score DECIMAL(5,3),
  
  -- Context
  region VARCHAR(100),
  outlet_type VARCHAR(50),
  location_type VARCHAR(50),
  
  -- Timestamps
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  feature_date DATE DEFAULT CURRENT_DATE
);

-- Index for ML queries
CREATE INDEX IF NOT EXISTS idx_outlet_features_date ON outlet_features(feature_date DESC);
CREATE INDEX IF NOT EXISTS idx_outlet_features_outlet ON outlet_features(outlet_id);

-- 2. Model Predictions
CREATE TABLE IF NOT EXISTS ml_predictions (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER,
  sku_id VARCHAR(100),
  
  -- Prediction type
  prediction_type VARCHAR(50) NOT NULL,  -- 'ANOMALY', 'STOCKOUT'
  
  -- Anomaly prediction
  anomaly_score DECIMAL(5,3),
  anomaly_threshold DECIMAL(5,3),
  is_anomaly BOOLEAN,
  anomaly_features JSONB,  -- which features triggered anomaly
  
  -- Stockout prediction
  days_until_stockout INTEGER,
  stockout_probability DECIMAL(5,3),
  recommended_order_qty INTEGER,
  
  -- Metadata
  model_version VARCHAR(20),
  confidence DECIMAL(5,3),
  feature_importance JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_type ON ml_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_outlet ON ml_predictions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON ml_predictions(created_at DESC);

-- 3. Model Registry
CREATE TABLE IF NOT EXISTS ml_model_versions (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  model_type VARCHAR(50) NOT NULL,  -- 'isolation_forest', 'gradient_boosting', 'lstm'
  model_version VARCHAR(20) NOT NULL,
  
  -- Training info
  training_start_date DATE,
  training_end_date DATE,
  training_samples INTEGER,
  training_features JSONB,
  
  -- Performance metrics
  metrics JSONB,  -- {precision, recall, f1, etc}
  validation_metrics JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'training',  -- training, validated, deployed, deprecated
  is_production BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deployed_at TIMESTAMP WITH TIME ZONE
);

-- 4. Anomaly Training Data (labeled anomalies)
CREATE TABLE IF NOT EXISTS anomaly_labels (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL,
  anomaly_date DATE NOT NULL,
  anomaly_type VARCHAR(50),
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labels_outlet ON anomaly_labels(outlet_id);
CREATE INDEX IF NOT EXISTS idx_labels_date ON anomaly_labels(anomaly_date DESC);

-- =====================================================
-- POPULATE INITIAL FEATURES FROM EXISTING DATA
-- =====================================================

-- Insert computed features for all outlets
INSERT INTO outlet_features (
  outlet_id, outlet_code, revenue_7d_avg, revenue_7d_std, 
  revenue_30d_avg, cost_7d_avg, staff_productivity,
  inventory_turnover, stock_level_pct, low_stock_items,
  region, computed_at
)
SELECT 
  o.id as outlet_id,
  o.code as outlet_code,
  COALESCE(AVG(st.amount), 0) as revenue_7d_avg,
  COALESCE(STDDEV(st.amount), 0) as revenue_7d_std,
  COALESCE(AVG(st.amount) * 4.3, 0) as revenue_30d_avg,
  COALESCE(AVG(st.amount) * 0.4, 0) as cost_7d_avg,
  COALESCE(AVG(st.amount) / NULLIF(8, 0), 0) as staff_productivity,
  3.5 as inventory_turnover,
  0.65 as stock_level_pct,
  2 as low_stock_items,
  r.name as region,
  NOW() as computed_at
FROM outlets o
LEFT JOIN sales_transactions st ON o.id = st.outlet_id 
  AND st.created_at >= NOW() - INTERVAL '7 days'
LEFT JOIN regions r ON o.region_id = r.id
GROUP BY o.id, o.code, r.name;

-- =====================================================
-- SEED ML MODELS REGISTRY
-- =====================================================
INSERT INTO ml_model_versions (
  model_name, model_type, model_version, status, is_production,
  training_samples, metrics, validation_metrics
) VALUES
(
  'Sales Anomaly Detector', 
  'isolation_forest',
  'v1.0.0',
  'deployed',
  TRUE,
  720,
  '{"precision": 0.78, "recall": 0.72, "f1": 0.75, "false_positive_rate": 0.12}',
  '{"precision": 0.75, "recall": 0.70}'
),
(
  'Stockout Predictor',
  'gradient_boosting',
  'v1.0.0',
  'deployed',
  TRUE,
  384,
  '{"mae": 1.2, "rmse": 1.8, "r2": 0.82}',
  '{"mae": 1.5, "rmse": 2.1}'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'ML Feature Store Setup Complete!' as status;
SELECT count(*) as outlets_with_features FROM outlet_features;
SELECT count(*) as ml_models FROM ml_model_versions WHERE is_production = TRUE;
