-- =============================================================================
-- CyberQuote ML Feature Engineering SQL Views & Functions
-- Feature Store for Sales Forecasting & Stockout Prediction
-- =============================================================================

-- =============================================================================
-- VIEW: Daily Sales Aggregates (Base Feature Table)
-- =============================================================================
CREATE OR REPLACE VIEW v_daily_sales_features AS
SELECT 
    outlet_id,
    date,
    
    -- Basic aggregates
    SUM(amount) AS daily_total_sales,
    COUNT(*) AS transaction_count,
    AVG(amount) AS avg_transaction_value,
    
    -- Time-based features
    MAX(hour) AS last_transaction_hour,
    COUNT(DISTINCT hour) AS hours_active,
    
    -- Anomaly data
    AVG(anomaly_score) AS avg_anomaly_score,
    MAX(is_anomaly) AS has_anomaly,
    
    -- Day of week (extracted from date)
    EXTRACT(DOW FROM date) AS day_of_week,
    
    -- Week number for seasonality
    EXTRACT(WEEK FROM date) AS week_number,
    
    -- Metadata
    MIN(created_at) AS first_transaction_at,
    MAX(created_at) AS last_transaction_at
FROM sales_transactions
GROUP BY outlet_id, date;

-- =============================================================================
-- VIEW: Rolling Window Features (7-day, 30-day)
-- =============================================================================
CREATE OR REPLACE VIEW v_rolling_sales_features AS
WITH daily_features AS (
    SELECT * FROM v_daily_sales_features
),
outlet_dates AS (
    SELECT DISTINCT outlet_id, date 
    FROM sales_transactions
)
SELECT 
    od.outlet_id,
    od.date,
    
    -- 7-day rolling aggregates
    COALESCE(
        (SELECT SUM(dsf.daily_total_sales) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '7 days' AND od.date
        ), 0
    ) AS rolling_7d_total,
    
    COALESCE(
        (SELECT AVG(dsf.daily_total_sales) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '7 days' AND od.date
        ), 0
    ) AS rolling_7d_avg,
    
    COALESCE(
        (SELECT STDDEV(dsf.daily_total_sales) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '7 days' AND od.date
        ), 0
    ) AS rolling_7d_std,
    
    -- 30-day rolling aggregates
    COALESCE(
        (SELECT SUM(dsf.daily_total_sales) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '30 days' AND od.date
        ), 0
    ) AS rolling_30d_total,
    
    COALESCE(
        (SELECT AVG(dsf.daily_total_sales) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '30 days' AND od.date
        ), 0
    ) AS rolling_30d_avg,
    
    COALESCE(
        (SELECT STDDEV(dsf.daily_total_sales) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '30 days' AND od.date
        ), 0
    ) AS rolling_30d_std,
    
    -- Transaction counts
    COALESCE(
        (SELECT SUM(dsf.transaction_count) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '7 days' AND od.date
        ), 0
    ) AS rolling_7d_txn_count,
    
    COALESCE(
        (SELECT SUM(dsf.transaction_count) 
         FROM daily_features dsf 
         WHERE dsf.outlet_id = od.outlet_id 
           AND dsf.date BETWEEN od.date - INTERVAL '30 days' AND od.date
        ), 0
    ) AS rolling_30d_txn_count

FROM outlet_dates od;

-- =============================================================================
-- VIEW: Day-of-Week Historical Pattern
-- =============================================================================
CREATE OR REPLACE VIEW v_dow_pattern_features AS
SELECT 
    outlet_id,
    day_of_week,
    COUNT(*) AS data_points,
    AVG(daily_total_sales) AS avg_daily_sales,
    STDDEV(daily_total_sales) AS std_daily_sales,
    MIN(daily_total_sales) AS min_daily_sales,
    MAX(daily_total_sales) AS max_daily_sales,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_total_sales) AS median_daily_sales
FROM v_daily_sales_features
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY outlet_id, day_of_week;

-- =============================================================================
-- VIEW: Hourly Pattern Features
-- =============================================================================
CREATE OR REPLACE VIEW v_hourly_pattern_features AS
SELECT 
    outlet_id,
    hour,
    COUNT(*) AS data_points,
    AVG(amount) AS avg_hourly_sales,
    STDDEV(amount) AS std_hourly_sales,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) AS median_hourly_sales
FROM sales_transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY outlet_id, hour;

-- =============================================================================
-- VIEW: Trend Features (Week-over-Week, Month-over-Month)
-- =============================================================================
CREATE OR REPLACE VIEW v_trend_features AS
WITH weekly_sales AS (
    SELECT 
        outlet_id,
        DATE_TRUNC('week', date) AS week_start,
        SUM(daily_total_sales) AS weekly_total,
        AVG(daily_total_sales) AS weekly_avg_daily
    FROM v_daily_sales_features
    WHERE date >= CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY outlet_id, DATE_TRUNC('week', date)
)
SELECT 
    ws.outlet_id,
    ws.week_start AS date,
    ws.weekly_total,
    ws.weekly_avg_daily,
    
    -- Week-over-week comparison
    LAG(ws.weekly_total, 1) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start) AS prev_week_total,
    LAG(ws.weekly_total, 4) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start) AS same_week_prev_month,
    
    CASE 
        WHEN LAG(ws.weekly_total, 1) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start) > 0
        THEN (ws.weekly_total - LAG(ws.weekly_total, 1) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start)) 
             / LAG(ws.weekly_total, 1) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start)
        ELSE 0
    END AS wow_growth_rate,
    
    CASE 
        WHEN LAG(ws.weekly_total, 4) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start) > 0
        THEN (ws.weekly_total - LAG(ws.weekly_total, 4) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start))
             / LAG(ws.weekly_total, 4) OVER (PARTITION BY ws.outlet_id ORDER BY ws.week_start)
        ELSE 0
    END AS mom_growth_rate

FROM weekly_sales ws;

-- =============================================================================
-- VIEW: Inventory Stockout Risk Features
-- =============================================================================
CREATE OR REPLACE VIEW v_inventory_stockout_features AS
WITH daily_usage AS (
    SELECT 
        st.outlet_id,
        DATE_TRUNC('day', st.created_at) AS usage_date,
        SUM(st.amount) AS daily_usage_amount,
        SUM(st.transaction_count) AS daily_units_sold
    FROM sales_transactions st
    WHERE st.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY st.outlet_id, DATE_TRUNC('day', st.created_at)
),
avg_usage AS (
    SELECT 
        outlet_id,
        AVG(daily_usage_amount) AS avg_daily_usage_amount,
        AVG(daily_units_sold) AS avg_daily_units_sold,
        STDDEV(daily_usage_amount) AS std_daily_usage,
        COUNT(*) AS usage_days
    FROM daily_usage
    GROUP BY outlet_id
)
SELECT 
    i.outlet_id,
    i.sku,
    i.product_name,
    i.category,
    i.current_stock,
    i.min_stock,
    i.max_stock,
    i.unit,
    i.last_restock_at,
    
    -- Stock metrics
    i.current_stock - i.min_stock AS stock_buffer,
    CASE WHEN i.current_stock > 0 THEN i.current_stock::FLOAT / NULLIF(i.max_stock, 0) ELSE 0 END AS stock_ratio,
    CASE WHEN i.current_stock > 0 AND i.min_stock > 0 
         THEN i.current_stock::FLOAT / i.min_stock 
         ELSE NULL 
    END AS stock_to_min_ratio,
    
    -- Usage metrics
    COALESCE(au.avg_daily_usage_amount, 0) AS avg_daily_usage,
    COALESCE(au.avg_daily_units_sold, 0) AS avg_daily_units,
    COALESCE(au.std_daily_usage, 0) AS usage_variability,
    COALESCE(au.usage_days, 0) AS data_coverage_days,
    
    -- Stockout prediction
    CASE 
        WHEN COALESCE(au.avg_daily_usage_amount, 0) = 0 THEN 999
        ELSE i.current_stock / au.avg_daily_usage_amount 
    END AS days_until_stockout,
    
    CASE 
        WHEN COALESCE(au.avg_daily_usage_amount, 0) = 0 THEN 'LOW'
        WHEN i.current_stock / au.avg_daily_usage_amount < 3 THEN 'HIGH'
        WHEN i.current_stock / au.avg_daily_usage_amount < 7 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS risk_level,
    
    -- Recommended order quantity (7-day supply + 20% safety)
    GREATEST(0, CEIL(
        COALESCE(au.avg_daily_usage_amount, 0) * 7 * 1.2 - i.current_stock
    )) AS recommended_order_qty,
    
    -- Days since restock
    CASE 
        WHEN i.last_restock_at IS NOT NULL 
        THEN CURRENT_DATE - i.last_restock_at::DATE 
        ELSE NULL 
    END AS days_since_restock

FROM inventory i
LEFT JOIN avg_usage au ON i.outlet_id = au.outlet_id;

-- =============================================================================
-- VIEW: Consolidated ML Feature Table (For Model Input)
-- =============================================================================
CREATE OR REPLACE VIEW v_ml_features_consolidated AS
SELECT 
    o.id AS outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    o.status AS outlet_status,
    o.region_id,
    o.daily_target,
    CURRENT_DATE AS feature_date,
    
    -- Today's sales (if available)
    COALESCE(
        (SELECT SUM(amount) FROM sales_transactions WHERE outlet_id = o.id AND date = CURRENT_DATE),
        0
    ) AS today_sales,
    
    -- Yesterday's sales
    COALESCE(
        (SELECT SUM(amount) FROM sales_transactions WHERE outlet_id = o.id AND date = CURRENT_DATE - 1),
        0
    ) AS yesterday_sales,
    
    -- 7-day aggregates
    COALESCE(
        (SELECT SUM(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 7),
        0
    ) AS last_7d_sales,
    
    COALESCE(
        (SELECT AVG(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 7),
        0
    ) AS last_7d_avg,
    
    -- 30-day aggregates
    COALESCE(
        (SELECT SUM(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30),
        0
    ) AS last_30d_sales,
    
    COALESCE(
        (SELECT AVG(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30),
        0
    ) AS last_30d_avg,
    
    -- Same period last month
    COALESCE(
        (SELECT SUM(daily_total_sales) 
         FROM v_daily_sales_features 
         WHERE outlet_id = o.id 
           AND date >= CURRENT_DATE - INTERVAL '1 month' - INTERVAL '30 days'
           AND date < CURRENT_DATE - INTERVAL '1 month'),
        0
    ) AS prev_month_same_period_sales,
    
    -- Trend
    CASE 
        WHEN COALESCE(
            (SELECT SUM(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30),
            0
        ) > 0 
        THEN (
            COALESCE((SELECT SUM(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 7), 0)
            / NULLIF((SELECT SUM(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30), 0)
        ) * 30 / 7
        ELSE 0
    END AS month_trend_ratio,
    
    -- Inventory aggregate
    COALESCE(
        (SELECT SUM(current_stock) FROM inventory WHERE outlet_id = o.id),
        0
    ) AS total_current_stock,
    
    COALESCE(
        (SELECT SUM(min_stock) FROM inventory WHERE outlet_id = o.id),
        0
    ) AS total_min_stock,
    
    COALESCE(
        (SELECT SUM(max_stock) FROM inventory WHERE outlet_id = o.id),
        0
    ) AS total_max_stock,
    
    -- Stockout risk (outlet level)
    CASE 
        WHEN COALESCE((SELECT AVG(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30), 0) = 0
        THEN 'LOW'
        WHEN COALESCE((SELECT SUM(current_stock) FROM inventory WHERE outlet_id = o.id), 0) 
             / NULLIF((SELECT AVG(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30), 0) < 3
        THEN 'HIGH'
        WHEN COALESCE((SELECT SUM(current_stock) FROM inventory WHERE outlet_id = o.id), 0) 
             / NULLIF((SELECT AVG(daily_total_sales) FROM v_daily_sales_features WHERE outlet_id = o.id AND date >= CURRENT_DATE - 30), 0) < 7
        THEN 'MEDIUM'
        ELSE 'LOW'
    END AS stockout_risk_level,
    
    -- Data freshness
    COALESCE(
        (SELECT MAX(created_at) FROM sales_transactions WHERE outlet_id = o.id),
        o.created_at
    ) AS last_transaction_at,
    
    CURRENT_TIMESTAMP AS feature_generated_at

FROM outlets o
WHERE o.status IN ('ACTIVE', 'PILOT');

-- =============================================================================
-- FUNCTION: Calculate Anomaly Score for Outlet
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_anomaly_score(
    p_outlet_id INT,
    p_current_sales DECIMAL,
    p_hour INT DEFAULT NULL,
    p_day_of_week INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_avg DECIMAL;
    v_std DECIMAL;
    v_z_score DECIMAL;
    v_percentile DECIMAL;
    v_is_anomaly BOOLEAN;
    v_data_points INT;
    v_threshold DECIMAL := 2.5;
    v_result JSONB;
BEGIN
    -- Get historical data
    SELECT 
        AVG(amount),
        STDDEV(amount),
        COUNT(*)
    INTO v_avg, v_std, v_data_points
    FROM sales_transactions
    WHERE outlet_id = p_outlet_id
      AND (p_hour IS NULL OR hour = p_hour)
      AND (p_day_of_week IS NULL OR day_of_week = p_day_of_week);
    
    -- Calculate z-score
    IF v_std IS NULL OR v_std = 0 OR v_data_points < 5 THEN
        -- Insufficient data or no variation
        v_z_score := 0;
        v_is_anomaly := FALSE;
        v_percentile := 50;
    ELSE
        v_z_score := (p_current_sales - v_avg) / v_std;
        v_is_anomaly := ABS(v_z_score) > v_threshold;
        
        -- Calculate percentile (simplified)
        v_percentile := CASE 
            WHEN p_current_sales < v_avg - 2 * v_std THEN 5
            WHEN p_current_sales < v_avg - v_std THEN 15
            WHEN p_current_sales < v_avg THEN 30
            WHEN p_current_sales < v_avg + v_std THEN 70
            WHEN p_current_sales < v_avg + 2 * v_std THEN 85
            ELSE 95
        END;
    END IF;
    
    -- Build result
    v_result := jsonb_build_object(
        'outlet_id', p_outlet_id,
        'current_sales', p_current_sales,
        'z_score', ROUND(v_z_score::NUMERIC, 2),
        'is_anomaly', v_is_anomaly,
        'avg_historical', ROUND(v_avg::NUMERIC, 2),
        'std_historical', ROUND(v_std::NUMERIC, 2),
        'percentile', v_percentile,
        'data_points', v_data_points,
        'threshold', v_threshold
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Calculate Stockout Risk Score
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_stockout_risk(
    p_outlet_id INT,
    p_sku VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_stock INT;
    v_min_stock INT;
    v_avg_daily_usage DECIMAL;
    v_days_until_stockout DECIMAL;
    v_risk_level VARCHAR;
    v_risk_score INT;
    v_recommended_order INT;
    v_data_points INT;
    v_result JSONB;
BEGIN
    -- Get inventory
    SELECT 
        COALESCE(SUM(current_stock), 0),
        COALESCE(SUM(min_stock), 0)
    INTO v_current_stock, v_min_stock
    FROM inventory
    WHERE outlet_id = p_outlet_id
      AND (p_sku IS NULL OR sku = p_sku);
    
    -- Calculate average daily usage (last 30 days)
    SELECT 
        COALESCE(SUM(amount), 0) / 30,
        COUNT(DISTINCT DATE(created_at))
    INTO v_avg_daily_usage, v_data_points
    FROM sales_transactions
    WHERE outlet_id = p_outlet_id
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Calculate days until stockout
    IF v_avg_daily_usage = 0 OR v_avg_daily_usage IS NULL THEN
        v_days_until_stockout := 999;
        v_risk_level := 'LOW';
        v_risk_score := 0;
    ELSE
        v_days_until_stockout := v_current_stock / v_avg_daily_usage;
        
        IF v_days_until_stockout < 3 THEN
            v_risk_level := 'HIGH';
            v_risk_score := 100;
        ELSIF v_days_until_stockout < 7 THEN
            v_risk_level := 'MEDIUM';
            v_risk_score := 60;
        ELSE
            v_risk_level := 'LOW';
            v_risk_score := 20;
        END IF;
        
        -- Adjust score based on proximity to min_stock
        IF v_current_stock <= v_min_stock THEN
            v_risk_score := LEAST(100, v_risk_score + 30);
        ELSIF v_current_stock <= v_min_stock * 2 THEN
            v_risk_score := LEAST(100, v_risk_score + 15);
        END IF;
    END IF;
    
    -- Calculate recommended order (7-day supply + 20% safety)
    v_recommended_order := GREATEST(0, CEIL(v_avg_daily_usage * 7 * 1.2 - v_current_stock));
    
    -- Build result
    v_result := jsonb_build_object(
        'outlet_id', p_outlet_id,
        'sku', p_sku,
        'current_stock', v_current_stock,
        'min_stock', v_min_stock,
        'avg_daily_usage', ROUND(v_avg_daily_usage::NUMERIC, 2),
        'days_until_stockout', ROUND(v_days_until_stockout::NUMERIC, 1),
        'risk_level', v_risk_level,
        'risk_score', v_risk_score,
        'recommended_order', v_recommended_order,
        'data_points', v_data_points
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Batch Calculate All Anomaly Scores
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_batch_anomaly_scores()
RETURNS TABLE (
    outlet_id INT,
    outlet_name VARCHAR,
    anomaly_score DECIMAL,
    is_anomaly BOOLEAN,
    avg_sales DECIMAL,
    std_sales DECIMAL,
    data_points INT
) AS $$
BEGIN
    RETURN QUERY
    WITH outlet_stats AS (
        SELECT 
            st.outlet_id,
            AVG(st.amount) AS avg_sales,
            STDDEV(st.amount) AS std_sales,
            COUNT(*) AS data_points
        FROM sales_transactions st
        WHERE st.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
        GROUP BY st.outlet_id
    )
    SELECT 
        o.id AS outlet_id,
        o.name AS outlet_name,
        COALESCE(os.avg_sales, 0) AS anomaly_score,
        CASE WHEN ABS(os.avg_sales - os.avg_sales) / NULLIF(os.std_sales, 0) > 2.5 THEN TRUE ELSE FALSE END AS is_anomaly,
        COALESCE(os.avg_sales, 0) AS avg_sales,
        COALESCE(os.std_sales, 0) AS std_sales,
        COALESCE(os.data_points, 0) AS data_points
    FROM outlets o
    LEFT JOIN outlet_stats os ON o.id = os.outlet_id
    WHERE o.status IN ('ACTIVE', 'PILOT')
    ORDER BY o.id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INDEXES FOR ML FEATURES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_sales_features_date ON sales_transactions(outlet_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_features_hour ON sales_transactions(outlet_id, hour);
CREATE INDEX IF NOT EXISTS idx_sales_features_dow ON sales_transactions(outlet_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_inventory_outlet_sku ON inventory(outlet_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_levels ON inventory(outlet_id) WHERE current_stock <= min_stock;

-- =============================================================================
-- REFRESH MATERIALIZED VIEW (For batch processing)
-- =============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ml_features_daily AS
SELECT * FROM v_ml_features_consolidated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ml_outlet ON mv_ml_features_daily(outlet_id);

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT ON v_daily_sales_features TO authenticated;
GRANT SELECT ON v_rolling_sales_features TO authenticated;
GRANT SELECT ON v_dow_pattern_features TO authenticated;
GRANT SELECT ON v_hourly_pattern_features TO authenticated;
GRANT SELECT ON v_trend_features TO authenticated;
GRANT SELECT ON v_inventory_stockout_features TO authenticated;
GRANT SELECT ON v_ml_features_consolidated TO authenticated;
GRANT SELECT ON mv_ml_features_daily TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calculate_anomaly_score TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calculate_stockout_risk TO authenticated;
GRANT EXECUTE ON FUNCTION fn_batch_anomaly_scores TO authenticated;
