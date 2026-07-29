-- =============================================================================
-- CyberQuote MVP - Function Execution Metrics & Logging
-- =============================================================================

-- =============================================================================
-- TABLE: Function Execution Logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.function_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    function_name VARCHAR(100) NOT NULL,
    execution_id UUID NOT NULL DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER GENERATED ALWAYS AS (
        CASE WHEN completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 
        ELSE NULL END
    ) STORED,
    error_message TEXT,
    input_size_bytes INTEGER,
    output_size_bytes INTEGER,
    records_processed INTEGER,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_function_logs_name ON public.function_execution_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_function_logs_status ON public.function_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_function_logs_started ON public.function_execution_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_logs_execution_id ON public.function_execution_logs(execution_id);

COMMENT ON TABLE public.function_execution_logs IS 
    'Tracks execution metrics for all Supabase Edge Functions including duration, errors, and throughput.';

-- =============================================================================
-- TABLE: Alert Generation Metrics
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alert_generation_metrics (
    id SERIAL PRIMARY KEY,
    metric_hour TIMESTAMPTZ NOT NULL DEFAULT DATE_TRUNC('hour', NOW()),
    alerts_generated INTEGER NOT NULL DEFAULT 0,
    alerts_by_severity JSONB DEFAULT '{}',
    alerts_by_type JSONB DEFAULT '{}',
    avg_generation_time_ms INTEGER,
    peak_alerts_per_minute INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(metric_hour)
);

CREATE INDEX IF NOT EXISTS idx_alert_metrics_hour ON public.alert_generation_metrics(metric_hour DESC);

COMMENT ON TABLE public.alert_generation_metrics IS 
    'Hourly aggregated metrics for alert generation rates by severity and type.';

-- =============================================================================
-- TABLE: SLA Breach Events
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sla_breach_events (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    alert_id INTEGER REFERENCES public.alerts(id) ON DELETE SET NULL,
    outlet_id INTEGER NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    sla_deadline TIMESTAMPTZ NOT NULL,
    breached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    case_priority case_priority NOT NULL,
    resolution_time_minutes INTEGER,
    notification_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_breaches_case ON public.sla_breach_events(case_id);
CREATE INDEX IF NOT EXISTS idx_sla_breaches_outlet ON public.sla_breach_events(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sla_breaches_time ON public.sla_breach_events(breached_at DESC);

COMMENT ON TABLE public.sla_breach_events IS 
    'Tracks SLA breach events for reporting and alerting.';

-- =============================================================================
-- TABLE: ML Error Tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ml_error_logs (
    id SERIAL PRIMARY KEY,
    function_name VARCHAR(100) NOT NULL,
    outlet_id INTEGER REFERENCES public.outlets(id) ON DELETE SET NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    severity VARCHAR(20) DEFAULT 'error',
    context JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_errors_function ON public.ml_error_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_ml_errors_time ON public.ml_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_errors_unresolved ON public.ml_error_logs(resolved) WHERE resolved = false;

COMMENT ON TABLE public.ml_error_logs IS 
    'Tracks ML function errors for monitoring and debugging.';

-- =============================================================================
-- VIEW: Function Execution Summary
-- =============================================================================
CREATE OR REPLACE VIEW public.v_function_execution_summary AS
SELECT 
    function_name,
    COUNT(*) AS total_executions,
    COUNT(*) FILTER (WHERE status = 'completed') AS successful,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    ROUND(AVG(duration_ms) FILTER (WHERE status = 'completed')) AS avg_duration_ms,
    ROUND(MAX(duration_ms)) AS max_duration_ms,
    ROUND(MIN(duration_ms) FILTER (WHERE status = 'completed')) AS min_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
    AVG(records_processed) FILTER (WHERE status = 'completed') AS avg_records,
    SUM(records_processed) FILTER (WHERE status = 'completed') AS total_records
FROM public.function_execution_logs
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY function_name;

-- =============================================================================
-- VIEW: Error Rate Metrics (last hour)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_error_rate_metrics AS
SELECT 
    function_name,
    COUNT(*) AS total_executions_1h,
    COUNT(*) FILTER (WHERE status = 'failed') AS errors_1h,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / 
        NULLIF(COUNT(*), 0), 
        2
    ) AS error_rate_pct,
    AVG(duration_ms) FILTER (WHERE status = 'completed') AS avg_duration_ms
FROM public.function_execution_logs
WHERE started_at >= NOW() - INTERVAL '1 hour'
GROUP BY function_name;

-- =============================================================================
-- FUNCTION: Log function execution
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_function_execution(
    p_function_name VARCHAR,
    p_status VARCHAR,
    p_duration_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_records_processed INTEGER DEFAULT NULL,
    p_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_execution_id UUID;
BEGIN
    INSERT INTO public.function_execution_logs (
        function_name,
        status,
        duration_ms,
        error_message,
        records_processed,
        context,
        completed_at
    ) VALUES (
        p_function_name,
        p_status,
        p_duration_ms,
        p_error_message,
        p_records_processed,
        p_context,
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    )
    RETURNING execution_id INTO v_execution_id;
    
    RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_function_execution IS 
    'Logs execution metrics for Supabase Edge Functions. Call at start and end of function execution.';

-- =============================================================================
-- FUNCTION: Record alert generation metric
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_alert_generation(
    p_alert_count INTEGER,
    p_by_severity JSONB DEFAULT '{}',
    p_by_type JSONB DEFAULT '{}',
    p_generation_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.alert_generation_metrics (
        metric_hour,
        alerts_generated,
        alerts_by_severity,
        alerts_by_type,
        avg_generation_time_ms
    )
    VALUES (
        DATE_TRUNC('hour', NOW()),
        p_alert_count,
        p_by_severity,
        p_by_type,
        p_generation_time_ms
    )
    ON CONFLICT (metric_hour) DO UPDATE SET
        alerts_generated = alert_generation_metrics.alerts_generated + EXCLUDED.alerts_generated,
        avg_generation_time_ms = GREATEST(
            COALESCE(alert_generation_metrics.avg_generation_time_ms, 0),
            EXCLUDED.avg_generation_time_ms
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Log ML error
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_ml_error(
    p_function_name VARCHAR,
    p_outlet_id INTEGER DEFAULT NULL,
    p_error_type VARCHAR,
    p_error_message TEXT,
    p_severity VARCHAR DEFAULT 'error',
    p_context JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_error_id INTEGER;
BEGIN
    INSERT INTO public.ml_error_logs (
        function_name,
        outlet_id,
        error_type,
        error_message,
        severity,
        context
    )
    VALUES (
        p_function_name,
        p_outlet_id,
        p_error_type,
        p_error_message,
        p_severity,
        p_context
    )
    RETURNING id INTO v_error_id;
    
    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGER: Auto-log SLA breaches
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_sla_breach()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status NOT IN ('RESOLVED', 'CLOSED') 
        AND NEW.sla_deadline IS NOT NULL 
        AND NEW.sla_deadline < NOW() THEN
        
        -- Check if this case is already logged as breached
        IF NOT EXISTS (
            SELECT 1 FROM public.sla_breach_events 
            WHERE case_id = NEW.id AND breached_at IS NOT NULL
        ) THEN
            INSERT INTO public.sla_breach_events (
                case_id,
                alert_id,
                outlet_id,
                sla_deadline,
                case_priority
            )
            SELECT 
                NEW.id,
                NEW.alert_id,
                a.outlet_id,
                NEW.sla_deadline,
                NEW.priority
            FROM public.alerts a
            WHERE a.id = NEW.alert_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_sla_breach ON public.cases;
CREATE TRIGGER trg_check_sla_breach
    AFTER INSERT OR UPDATE ON public.cases
    FOR EACH ROW
    EXECUTE FUNCTION public.check_sla_breach();

COMMENT ON FUNCTION public.check_sla_breach IS 
    'Automatically logs SLA breaches when case deadline is passed.';
