-- =============================================================================
-- ML Scores Views and Helper Functions
-- =============================================================================

-- View: Latest anomaly scores for all outlets
CREATE OR REPLACE VIEW public.latest_anomaly_scores AS
SELECT DISTINCT ON (outlet_id)
    ms.outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    ms.score AS anomaly_score,
    ms.is_anomaly,
    ms.data_points,
    ms.scored_at
FROM public.ml_scores ms
JOIN public.outlets o ON o.id = ms.outlet_id
WHERE ms.model_type = 'anomaly'
ORDER BY ms.outlet_id, ms.scored_at DESC;

-- View: Latest stockout risk for all outlets
CREATE OR REPLACE VIEW public.latest_stockout_risk AS
SELECT DISTINCT ON (outlet_id)
    ms.outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    ms.score AS stockout_score,
    ms.risk_level,
    ms.days_until_stockout,
    ms.data_points,
    ms.scored_at
FROM public.ml_scores ms
JOIN public.outlets o ON o.id = ms.outlet_id
WHERE ms.model_type = 'stockout'
ORDER BY ms.outlet_id, ms.scored_at DESC;

-- View: Combined latest scores for dashboard
CREATE OR REPLACE VIEW public.outlet_ml_summary AS
SELECT 
    o.id AS outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    o.status AS outlet_status,
    o.region_id,
    r.name AS region_name,
    COALESCE(a.anomaly_score, 0) AS anomaly_score,
    COALESCE(a.is_anomaly, false) AS is_anomaly,
    COALESCE(a.scored_at, '1970-01-01'::timestamptz) AS anomaly_scored_at,
    COALESCE(s.stockout_score, 0) AS stockout_score,
    COALESCE(s.risk_level, 'LOW') AS stockout_risk,
    COALESCE(s.days_until_stockout, 999) AS days_until_stockout,
    COALESCE(s.scored_at, '1970-01-01'::timestamptz) AS stockout_scored_at,
    CASE 
        WHEN a.is_anomaly = true OR s.risk_level = 'HIGH' THEN true
        ELSE false
    END AS needs_attention
FROM public.outlets o
LEFT JOIN public.regions r ON r.id = o.region_id
LEFT JOIN LATERAL (
    SELECT score, is_anomaly, scored_at
    FROM public.ml_scores
    WHERE outlet_id = o.id AND model_type = 'anomaly'
    ORDER BY scored_at DESC
    LIMIT 1
) a ON true
LEFT JOIN LATERAL (
    SELECT score, risk_level, days_until_stockout, scored_at
    FROM public.ml_scores
    WHERE outlet_id = o.id AND model_type = 'stockout'
    ORDER BY scored_at DESC
    LIMIT 1
) s ON true;

-- View: Recent ML scheduler runs
CREATE OR REPLACE VIEW public.ml_scheduler_runs_summary AS
SELECT 
    id,
    outlets_processed,
    anomalies_detected,
    stockouts_detected,
    alerts_created,
    duration_ms,
    status,
    CASE 
        WHEN status = 'completed' THEN '✅'
        WHEN status = 'running' THEN '🔄'
        ELSE '❌'
    END AS status_icon,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) AS actual_duration_sec
FROM public.ml_scheduler_runs
ORDER BY scheduled_at DESC
LIMIT 20;

-- Function: Get outlets needing immediate attention
CREATE OR REPLACE FUNCTION public.get_outlets_needing_attention()
RETURNS TABLE (
    outlet_id INTEGER,
    outlet_name TEXT,
    outlet_code TEXT,
    region_name TEXT,
    issue_type TEXT,
    severity TEXT,
    score DECIMAL,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- High-risk stockouts
    SELECT 
        o.id AS outlet_id,
        o.name::TEXT AS outlet_name,
        o.code::TEXT AS outlet_code,
        r.name::TEXT AS region_name,
        'STOCKOUT'::TEXT AS issue_type,
        s.risk_level::TEXT AS severity,
        s.score AS score,
        ('Days until stockout: ' || COALESCE(s.days_until_stockout::TEXT, 'N/A'))::TEXT AS description
    FROM public.outlets o
    JOIN public.regions r ON r.id = o.region_id
    JOIN LATERAL (
        SELECT score, risk_level, days_until_stockout
        FROM public.ml_scores
        WHERE outlet_id = o.id AND model_type = 'stockout'
        ORDER BY scored_at DESC
        LIMIT 1
    ) s ON s.risk_level = 'HIGH'
    WHERE o.status IN ('ACTIVE', 'PILOT')
    
    UNION ALL
    
    -- Active anomalies
    SELECT 
        o.id AS outlet_id,
        o.name::TEXT AS outlet_name,
        o.code::TEXT AS outlet_code,
        r.name::TEXT AS region_name,
        'ANOMALY'::TEXT AS issue_type,
        CASE 
            WHEN a.score >= 0.9 THEN 'P0_CRITICAL'
            WHEN a.score >= 0.7 THEN 'P1_HIGH'
            ELSE 'P2_MEDIUM'
        END AS severity,
        a.score AS score,
        ('Anomaly score: ' || ROUND(a.score * 100)::TEXT || '%')::TEXT AS description
    FROM public.outlets o
    JOIN public.regions r ON r.id = o.region_id
    JOIN LATERAL (
        SELECT score, is_anomaly
        FROM public.ml_scores
        WHERE outlet_id = o.id AND model_type = 'anomaly'
        ORDER BY scored_at DESC
        LIMIT 1
    ) a ON a.is_anomaly = true AND a.score >= 0.7
    WHERE o.status IN ('ACTIVE', 'PILOT')
    
    ORDER BY 
        CASE severity WHEN 'P0_CRITICAL' THEN 1 WHEN 'P1_HIGH' THEN 2 WHEN 'P2_MEDIUM' THEN 3 ELSE 4 END,
        score DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant access to views
GRANT SELECT ON public.latest_anomaly_scores TO authenticated;
GRANT SELECT ON public.latest_stockout_risk TO authenticated;
GRANT SELECT ON public.outlet_ml_summary TO authenticated;
GRANT SELECT ON public.ml_scheduler_runs_summary TO authenticated;
GRANT SELECT ON public.get_outlets_needing_attention TO authenticated;
