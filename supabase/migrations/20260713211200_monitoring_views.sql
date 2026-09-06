-- =============================================================================
-- CyberQuote MVP - Observability Views and Metrics
-- =============================================================================

-- =============================================================================
-- VIEW: Active Alerts by Severity (Dashboard Query)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_active_alerts_by_severity AS
SELECT 
    severity,
    status,
    COUNT(*) AS alert_count,
    AVG(score) AS avg_score,
    MIN(triggered_at) AS oldest_alert,
    MAX(triggered_at) AS newest_alert
FROM public.alerts
WHERE status NOT IN ('CLOSED', 'RESOLVED')
GROUP BY severity, status
ORDER BY 
    CASE severity 
        WHEN 'P0_CRITICAL' THEN 1 
        WHEN 'P1_HIGH' THEN 2 
        WHEN 'P2_MEDIUM' THEN 3 
        WHEN 'P3_LOW' THEN 4 
    END,
    status;

-- =============================================================================
-- VIEW: Alert Summary (Quick Dashboard Stats)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_alert_summary AS
SELECT 
    COUNT(*) FILTER (WHERE status NOT IN ('CLOSED', 'RESOLVED')) AS active_alerts,
    COUNT(*) FILTER (WHERE status = 'NEW') AS new_alerts,
    COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED') AS acknowledged_alerts,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_alerts,
    COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_today,
    COUNT(*) FILTER (WHERE triggered_at >= CURRENT_DATE) AS triggered_today,
    COUNT(*) FILTER (WHERE triggered_at >= NOW() - INTERVAL '1 hour') AS triggered_last_hour,
    COUNT(*) FILTER (WHERE severity = 'P0_CRITICAL' AND status = 'NEW') AS critical_new,
    COUNT(*) FILTER (WHERE severity = 'P0_CRITICAL' AND status NOT IN ('CLOSED', 'RESOLVED')) AS critical_active,
    AVG(score) FILTER (WHERE score IS NOT NULL AND status NOT IN ('CLOSED', 'RESOLVED')) AS avg_active_score
FROM public.alerts;

-- =============================================================================
-- VIEW: Cases by Status with SLA Progress
-- =============================================================================
CREATE OR REPLACE VIEW public.v_cases_with_sla AS
SELECT 
    c.id AS case_id,
    c.title,
    c.priority,
    c.status,
    c.created_at,
    c.sla_deadline,
    c.resolved_at,
    c.assigned_to_id,
    u.full_name AS assigned_to_name,
    c.alert_id,
    a.severity AS alert_severity,
    a.type AS alert_type,
    a.outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    -- SLA calculations
    CASE 
        WHEN c.status IN ('RESOLVED', 'CLOSED') THEN 'met'
        WHEN c.sla_deadline IS NULL THEN 'no_sla'
        WHEN c.sla_deadline < NOW() THEN 'breached'
        WHEN c.sla_deadline < NOW() + INTERVAL '1 hour' THEN 'at_risk'
        ELSE 'on_track'
    END AS sla_status,
    EXTRACT(EPOCH FROM (
        CASE 
            WHEN c.status IN ('RESOLVED', 'CLOSED') THEN c.resolved_at - c.created_at
            WHEN c.sla_deadline IS NULL THEN NULL
            ELSE c.sla_deadline - NOW()
        END
    )) / 3600 AS sla_hours_remaining,
    EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600 AS hours_open
FROM public.cases c
LEFT JOIN public.user_profiles u ON u.id = c.assigned_to_id
LEFT JOIN public.alerts a ON a.id = c.alert_id
LEFT JOIN public.outlets o ON o.id = a.outlet_id
WHERE c.status != 'CLOSED';

-- =============================================================================
-- VIEW: Case SLA Metrics Summary
-- =============================================================================
CREATE OR REPLACE VIEW public.v_case_sla_metrics AS
SELECT 
    COUNT(*) AS total_cases,
    COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED')) AS resolved_cases,
    COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED', 'CLOSED')) AS open_cases,
    COUNT(*) FILTER (
        AND status NOT IN ('RESOLVED', 'CLOSED')
        AND sla_deadline IS NOT NULL
        AND sla_deadline < NOW()
    ) AS sla_breached,
    COUNT(*) FILTER (
        AND status NOT IN ('RESOLVED', 'CLOSED')
        AND sla_deadline IS NOT NULL
        AND sla_deadline >= NOW()
        AND sla_deadline < NOW() + INTERVAL '1 hour'
    ) AS sla_at_risk,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED')) * 100.0 / 
        NULLIF(COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED') AND resolved_at <= sla_deadline), 0),
        2
    ) AS sla_compliance_rate,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (
        WHERE status IN ('RESOLVED', 'CLOSED')
        AND resolved_at IS NOT NULL
    ) AS avg_resolution_hours
FROM public.cases;

-- =============================================================================
-- VIEW: ML Model Performance Metrics
-- =============================================================================
CREATE OR REPLACE VIEW public.v_ml_performance_metrics AS
SELECT 
    model_type,
    scored_at::DATE AS score_date,
    COUNT(*) AS total_scores,
    AVG(score) AS avg_score,
    MIN(score) AS min_score,
    MAX(score) AS max_score,
    COUNT(*) FILTER (WHERE is_anomaly = true) AS anomalies_detected,
    COUNT(*) FILTER (WHERE risk_level = 'HIGH') AS high_risk_count,
    AVG(data_points) AS avg_data_points
FROM public.ml_scores
WHERE scored_at >= NOW() - INTERVAL '30 days'
GROUP BY model_type, scored_at::DATE
ORDER BY scored_at DESC;

-- =============================================================================
-- VIEW: ML Recent Summary (for dashboard)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_ml_summary AS
SELECT 
    model_type,
    COUNT(*) AS total_scores,
    COUNT(*) FILTER (WHERE scored_at >= NOW() - INTERVAL '1 hour') AS scores_last_hour,
    COUNT(*) FILTER (WHERE scored_at >= CURRENT_DATE) AS scores_today,
    COUNT(*) FILTER (WHERE is_anomaly = true AND scored_at >= CURRENT_DATE) AS anomalies_today,
    AVG(score) FILTER (WHERE scored_at >= CURRENT_DATE) AS avg_score_today,
    MAX(scored_at) AS last_score_at,
    EXTRACT(EPOCH FROM (NOW() - MAX(scored_at))) / 60 AS minutes_since_last_score
FROM public.ml_scores
GROUP BY model_type;

-- =============================================================================
-- VIEW: Outlet Health Scores
-- =============================================================================
CREATE OR REPLACE VIEW public.v_outlet_health AS
SELECT 
    o.id AS outlet_id,
    o.name AS outlet_name,
    o.code AS outlet_code,
    o.status AS outlet_status,
    r.name AS region_name,
    -- Alert health
    COALESCE(a.active_alerts, 0) AS active_alerts,
    COALESCE(a.critical_alerts, 0) AS critical_alerts,
    COALESCE(a.avg_alert_score, 0) AS avg_alert_score,
    -- Sales health
    COALESCE(s.daily_avg_sales, 0) AS daily_avg_sales,
    COALESCE(s.sales_count_7d, 0) AS sales_count_7d,
    COALESCE(s.anomaly_count_7d, 0) AS anomaly_count_7d,
    -- Inventory health
    COALESCE(i.low_stock_items, 0) AS low_stock_items,
    COALESCE(i.total_items, 0) AS total_items,
    -- Case health
    COALESCE(c.open_cases, 0) AS open_cases,
    COALESCE(c.sla_breached_cases, 0) AS sla_breached_cases,
    -- Calculate overall health score (0-100)
    GREATEST(0, 100 - (
        COALESCE(a.critical_alerts, 0) * 20 +
        COALESCE(a.active_alerts, 0) * 2 +
        COALESCE(i.low_stock_items, 0) * 5 +
        COALESCE(c.sla_breached_cases, 0) * 15 +
        COALESCE(s.anomaly_count_7d, 0) * 10
    )) AS health_score
FROM public.outlets o
LEFT JOIN public.regions r ON r.id = o.region_id
-- Alert aggregation (last 7 days)
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) FILTER (WHERE status NOT IN ('CLOSED', 'RESOLVED')) AS active_alerts,
        COUNT(*) FILTER (WHERE severity = 'P0_CRITICAL' AND status NOT IN ('CLOSED', 'RESOLVED')) AS critical_alerts,
        AVG(score) FILTER (WHERE status NOT IN ('CLOSED', 'RESOLVED') AND score IS NOT NULL) AS avg_alert_score
    FROM public.alerts
    WHERE outlet_id = o.id AND triggered_at >= NOW() - INTERVAL '7 days'
) a ON true
-- Sales aggregation (last 7 days)
LEFT JOIN LATERAL (
    SELECT 
        AVG(amount) AS daily_avg_sales,
        COUNT(*) AS sales_count_7d,
        COUNT(*) FILTER (WHERE is_anomaly = true) AS anomaly_count_7d
    FROM public.sales_transactions
    WHERE outlet_id = o.id AND date >= CURRENT_DATE - INTERVAL '7 days'
) s ON true
-- Inventory aggregation
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) FILTER (WHERE current_stock <= min_stock) AS low_stock_items,
        COUNT(*) AS total_items
    FROM public.inventory
    WHERE outlet_id = o.id
) i ON true
-- Case aggregation
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) FILTER (WHERE status NOT IN ('CLOSED', 'RESOLVED')) AS open_cases,
        COUNT(*) FILTER (
            AND status NOT IN ('CLOSED', 'RESOLVED')
            AND sla_deadline IS NOT NULL
            AND sla_deadline < NOW()
        ) AS sla_breached_cases
    FROM public.cases c
    JOIN public.alerts a ON a.id = c.alert_id
    WHERE a.outlet_id = o.id
) c ON true
ORDER BY health_score ASC, active_alerts DESC;

-- =============================================================================
-- VIEW: Outlet Health Status Summary
-- =============================================================================
CREATE OR REPLACE VIEW public.v_outlet_health_summary AS
SELECT 
    CASE 
        WHEN health_score >= 90 THEN 'excellent'
        WHEN health_score >= 70 THEN 'good'
        WHEN health_score >= 50 THEN 'fair'
        ELSE 'poor'
    END AS health_category,
    COUNT(*) AS outlet_count,
    AVG(health_score) AS avg_health_score,
    SUM(active_alerts) AS total_active_alerts,
    SUM(critical_alerts) AS total_critical_alerts,
    SUM(low_stock_items) AS total_low_stock_items,
    SUM(sla_breached_cases) AS total_sla_breaches
FROM public.v_outlet_health
GROUP BY 
    CASE 
        WHEN health_score >= 90 THEN 'excellent'
        WHEN health_score >= 70 THEN 'good'
        WHEN health_score >= 50 THEN 'fair'
        ELSE 'poor'
    END
ORDER BY 
    CASE 
        WHEN health_score >= 90 THEN 1
        WHEN health_score >= 70 THEN 2
        WHEN health_score >= 50 THEN 3
        ELSE 4
    END;
