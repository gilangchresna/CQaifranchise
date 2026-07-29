-- =====================================================
-- Peer Benchmarking Tables
-- Outlet classification and peer group definitions
-- =====================================================

-- 1. Outlet Classification (Peer Groups)
CREATE TABLE IF NOT EXISTS outlet_classifications (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL UNIQUE,
  outlet_code VARCHAR(50) NOT NULL,
  
  -- Classification dimensions
  region VARCHAR(100),
  outlet_type VARCHAR(50) DEFAULT 'standard',  -- standard, premium, express
  location_type VARCHAR(50) DEFAULT 'mall',    -- mall, residential, office, street
  size_category VARCHAR(20) DEFAULT 'medium',   -- small, medium, large
  outlet_age VARCHAR(20) DEFAULT 'established', -- new, growing, established, mature
  
  -- Operating hours
  operating_hours_start TIME DEFAULT '09:00',
  operating_hours_end TIME DEFAULT '21:00',
  
  -- Capacity
  seating_capacity INTEGER,
  staff_count INTEGER,
  
  -- Peer comparison settings
  comparison_weight_revenue DECIMAL(3,2) DEFAULT 0.4,
  comparison_weight_staff DECIMAL(3,2) DEFAULT 0.3,
  comparison_weight_inventory DECIMAL(3,2) DEFAULT 0.3,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for peer group lookups
CREATE INDEX IF NOT EXISTS idx_outlet_class_region ON outlet_classifications(region);
CREATE INDEX IF NOT EXISTS idx_outlet_class_type ON outlet_classifications(outlet_type);
CREATE INDEX IF NOT EXISTS idx_outlet_class_location ON outlet_classifications(location_type);

-- 2. Peer Benchmark Metrics (calculated periodically)
CREATE TABLE IF NOT EXISTS peer_metrics (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL,
  outlet_code VARCHAR(50) NOT NULL,
  
  -- Peer group definition
  peer_region VARCHAR(100),
  peer_type VARCHAR(50),
  peer_location VARCHAR(50),
  peer_size VARCHAR(20),
  
  -- Time period
  metric_date DATE NOT NULL,
  period_type VARCHAR(20) DEFAULT 'daily',  -- daily, weekly, monthly
  
  -- Metrics (outlet vs peer)
  revenue DECIMAL(12,2),
  peer_avg_revenue DECIMAL(12,2),
  revenue_vs_peer_pct DECIMAL(6,2),
  revenue_rank INTEGER,
  revenue_percentile DECIMAL(5,2),
  
  staff_productivity DECIMAL(8,2),
  peer_avg_staff_productivity DECIMAL(8,2),
  staff_vs_peer_pct DECIMAL(6,2),
  
  inventory_turnover DECIMAL(8,2),
  peer_avg_inventory_turnover DECIMAL(8,2),
  inventory_vs_peer_pct DECIMAL(6,2),
  
  customer_satisfaction DECIMAL(5,2),
  peer_avg_satisfaction DECIMAL(5,2),
  
  -- Composite peer score (0-100)
  peer_score DECIMAL(5,2),
  peer_avg_score DECIMAL(5,2),
  
  -- Flags
  is_above_peer BOOLEAN,
  is_top_performer BOOLEAN,
  is_underperformer BOOLEAN,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_peer_metrics_outlet ON peer_metrics(outlet_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_peer_metrics_group ON peer_metrics(peer_region, peer_type, metric_date);

-- 3. Peer Benchmark Snapshots (historical comparison)
CREATE TABLE IF NOT EXISTS peer_snapshots (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Previous period comparison
  prev_revenue DECIMAL(12,2),
  prev_peer_rank INTEGER,
  
  -- Trend indicators
  revenue_trend VARCHAR(20) DEFAULT 'stable',  -- improving, stable, declining
  rank_change INTEGER DEFAULT 0,
  
  -- Best practices from top performers
  best_practice_tips JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(outlet_id, snapshot_date)
);

-- =====================================================
-- SAMPLE DATA: Outlet Classifications
-- =====================================================
INSERT INTO outlet_classifications (outlet_id, outlet_code, region, outlet_type, location_type, size_category, outlet_age, operating_hours_start, operating_hours_end, seating_capacity, staff_count) VALUES
(1, 'WKN-001', 'Singapore', 'standard', 'mall', 'medium', 'established', '10:00', '22:00', 40, 8),
(2, 'MYB-002', 'Singapore', 'standard', 'mall', 'small', 'new', '10:00', '21:00', 25, 5),
(3, 'SAP-003', 'Singapore', 'premium', 'mall', 'large', 'mature', '09:00', '22:00', 80, 15),
(4, 'JKT-004', 'Jakarta', 'standard', 'residential', 'medium', 'growing', '08:00', '20:00', 35, 6),
(5, 'BDG-005', 'Bandung', 'standard', 'street', 'small', 'new', '09:00', '21:00', 20, 4),
(6, 'SBY-006', 'Surabaya', 'standard', 'office', 'medium', 'established', '07:00', '19:00', 30, 7),
(7, 'BKK-007', 'Bangkok', 'premium', 'mall', 'large', 'mature', '10:00', '22:00', 60, 12),
(8, 'KUL-008', 'Kuala Lumpur', 'standard', 'mall', 'medium', 'growing', '10:00', '21:00', 45, 9)
ON CONFLICT (outlet_id) DO NOTHING;

-- =====================================================
-- SAMPLE DATA: Peer Metrics (today)
-- =====================================================
INSERT INTO peer_metrics (outlet_id, outlet_code, peer_region, peer_type, peer_location, metric_date, period_type, revenue, peer_avg_revenue, revenue_vs_peer_pct, revenue_rank, revenue_percentile, staff_productivity, peer_avg_staff_productivity, staff_vs_peer_pct, inventory_turnover, peer_avg_inventory_turnover, inventory_vs_peer_pct, peer_score, is_above_peer, is_top_performer, is_underperformer) VALUES
(1, 'WKN-001', 'Singapore', 'standard', 'mall', CURRENT_DATE, 'daily', 2847.50, 2342.00, 21.6, 2, 85.5, 355.94, 312.27, 14.0, 4.2, 3.8, 10.5, 82.3, true, false, false),
(2, 'MYB-002', 'Singapore', 'standard', 'mall', CURRENT_DATE, 'daily', 1923.00, 2342.00, -17.9, 4, 42.0, 384.60, 312.27, 23.2, 3.8, 3.8, 0.0, 68.5, false, false, true),
(3, 'SAP-003', 'Singapore', 'premium', 'mall', CURRENT_DATE, 'daily', 3156.00, 2890.00, 9.2, 1, 92.0, 210.40, 195.50, 7.6, 3.5, 3.2, 9.4, 88.7, true, true, false),
(4, 'JKT-004', 'Jakarta', 'standard', 'residential', CURRENT_DATE, 'daily', 1445.00, 1680.00, -14.0, 2, 35.0, 240.83, 280.00, -14.0, 3.0, 3.5, -14.3, 58.2, false, false, true),
(5, 'BDG-005', 'Bandung', 'standard', 'street', CURRENT_DATE, 'daily', 1234.00, 1680.00, -26.5, 4, 22.0, 308.50, 280.00, 10.2, 4.5, 3.5, 28.6, 55.8, false, false, true),
(6, 'SBY-006', 'Surabaya', 'standard', 'office', CURRENT_DATE, 'daily', 2156.00, 1900.00, 13.5, 1, 88.0, 308.00, 285.00, 8.1, 4.0, 3.7, 8.1, 79.5, true, false, false),
(7, 'BKK-007', 'Bangkok', 'premium', 'mall', CURRENT_DATE, 'daily', 3420.00, 2890.00, 18.3, 1, 95.0, 285.00, 195.50, 45.8, 3.8, 3.2, 18.8, 92.1, true, true, false),
(8, 'KUL-008', 'Kuala Lumpur', 'standard', 'mall', CURRENT_DATE, 'daily', 2280.00, 2342.00, -2.6, 3, 55.0, 253.33, 312.27, -18.9, 3.3, 3.8, -13.2, 62.4, false, false, false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Peer Benchmarking Setup Complete!' as status;
SELECT count(*) as outlet_classifications FROM outlet_classifications;
SELECT count(*) as peer_metrics_today FROM peer_metrics WHERE metric_date = CURRENT_DATE;
