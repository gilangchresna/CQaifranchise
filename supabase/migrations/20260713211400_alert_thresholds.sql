-- =============================================================================
-- CyberQuote MVP - Alert Thresholds Configuration
-- =============================================================================

-- =============================================================================
-- TABLE: Alert Threshold Configuration
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alert_thresholds (
    id SERIAL PRIMARY KEY,
    threshold_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    metric_type VARCHAR(50) NOT NULL,
    -- Threshold values
    warning_threshold DECIMAL(10,2),
    critical_threshold DECIMAL(10,2),
    -- Time window for evaluation
    evaluation_window_minutes INTEGER DEFAULT 60,
    -- Alerting behavior
    cooldown_minutes INTEGER DEFAULT 30,
    auto_escalate BOOLEAN DEFAULT false,
    escalation_factor DECIMAL(3,2) DEFAULT 1.5,
    -- Status
    is_enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    trigger_count_24h INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thresholds_name ON public.alert_thresholds(threshold_name);
CREATE INDEX IF NOT EXISTS idx_thresholds_enabled ON public.alert_thresholds(is_enabled) WHERE is_enabled = true;

COMMENT ON TABLE public.alert_thresholds IS 
    'Configurable alert thresholds for monitoring system health. Modify thresholds without code changes.';

-- =============================================================================
-- INSERT DEFAULT THRESHOLDS
-- =============================================================================
INSERT INTO public.alert_thresholds (threshold_name, description, metric_type, warning_threshold, critical_threshold, evaluation_window_minutes, cooldown_minutes)
VALUES
    -- Alert generation rate thresholds
    ('alerts_per_hour_critical', 'Critical: Too many alerts generated per hour - potential system issue', 
     'alert_rate', 50, 100, 60, 15),
    ('alerts_per_hour_high', 'High: Elevated alert generation rate', 
     'alert_rate', 30, 50, 60, 15),
    
    -- SLA breach rate thresholds
    ('sla_breach_rate_critical', 'Critical: SLA breach rate exceeds acceptable limit', 
     'sla_breach_rate', 10.0, 20.0, 60, 30),
    ('sla_breach_rate_high', 'Warning: SLA breach rate is elevated', 
     'sla_breach_rate', 5.0, 10.0, 60, 30),
    
    -- ML error rate thresholds
    ('ml_error_rate_critical', 'Critical: ML function error rate too high', 
     'ml_error_rate', 10.0, 25.0, 60, 10),
    ('ml_error_rate_high', 'Warning: ML function error rate elevated', 
     'ml_error_rate', 5.0, 10.0, 60, 10),
    
    -- Function execution time thresholds
    ('function_duration_p95_critical', 'Critical: Function P95 execution time exceeds limit', 
     'function_duration', 5000, 10000, 30, 15),
    ('function_duration_p95_high', 'Warning: Function P95 execution time elevated', 
     'function_duration', 3000, 5000, 30, 15),
    
    -- Database connection thresholds
    ('db_connections_critical', 'Critical: Database connections near limit', 
     'db_connections', 80, 95, 5, 5),
    ('db_connections_high', 'Warning: Database connections elevated', 
     'db_connections', 60, 80, 5, 5),
    
    -- Active alerts thresholds
    ('active_alerts_critical', 'Critical: Too many active alerts - investigation required', 
     'active_alerts', 100, 200, 60, 30),
    ('active_alerts_high', 'Warning: Active alert count elevated', 
     'active_alerts', 50, 100, 60, 30),
    
    -- ML model staleness
    ('ml_stale_data_critical', 'Critical: No ML scores generated recently', 
     'ml_staleness', 120, 240, 60, 60),
    ('ml_stale_data_high', 'Warning: ML scores are stale', 
     'ml_staleness', 60, 120, 60, 30)
ON CONFLICT (threshold_name) DO NOTHING;

-- =============================================================================
-- TABLE: Threshold Violation Log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.threshold_violations (
    id SERIAL PRIMARY KEY,
    threshold_id INTEGER NOT NULL REFERENCES public.alert_thresholds(id) ON DELETE CASCADE,
    metric_value DECIMAL(10,2) NOT NULL,
    threshold_value DECIMAL(10,2) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    violation_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    violation_end TIMESTAMPTZ,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE WHEN violation_end IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (violation_end - violation_start)) / 60
        ELSE EXTRACT(EPOCH FROM (NOW() - violation_start)) / 60 END
    ) STORED,
    notifications_sent JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_threshold ON public.threshold_violations(threshold_id);
CREATE INDEX IF NOT EXISTS idx_violations_active ON public.threshold_violations(violation_end) WHERE violation_end IS NULL;

COMMENT ON TABLE public.threshold_violations IS 
    'Logs when monitoring thresholds are violated for trend analysis.';

-- =============================================================================
-- VIEW: Active Threshold Violations
-- =============================================================================
CREATE OR REPLACE VIEW public.v_active_threshold_violations AS
SELECT 
    tv.id AS violation_id,
    tv.threshold_id,
    at.threshold_name,
    at.description,
    at.metric_type,
    tv.metric_value,
    tv.threshold_value,
    tv.severity,
    tv.violation_start,
    EXTRACT(EPOCH FROM (NOW() - tv.violation_start)) / 60 AS minutes_in_violation,
    at.is_enabled,
    at.cooldown_minutes
FROM public.threshold_violations tv
JOIN public.alert_thresholds at ON at.id = tv.threshold_id
WHERE tv.violation_end IS NULL
    AND at.is_enabled = true
ORDER BY 
    CASE tv.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
    tv.violation_start DESC;

-- =============================================================================
-- VIEW: Threshold Status Summary
-- =============================================================================
CREATE OR REPLACE VIEW public.v_threshold_status AS
SELECT 
    at.threshold_name,
    at.description,
    at.metric_type,
    at.warning_threshold,
    at.critical_threshold,
    at.is_enabled,
    at.last_triggered_at,
    at.trigger_count_24h,
    COUNT(tv.id) FILTER (WHERE tv.violation_end IS NULL) AS active_violations,
    COUNT(tv.id) FILTER (
        AND tv.violation_start >= NOW() - INTERVAL '24 hours'
    ) AS violations_24h
FROM public.alert_thresholds at
LEFT JOIN public.threshold_violations tv ON tv.threshold_id = at.id
GROUP BY at.id, at.threshold_name, at.description, at.metric_type, 
         at.warning_threshold, at.critical_threshold, at.is_enabled,
         at.last_triggered_at, at.trigger_count_24h
ORDER BY at.metric_type, at.threshold_name;
