-- AI Agent Orchestration Tables
-- Run this SQL in Supabase Dashboard → SQL Editor
-- Handles both new tables AND patching existing agent_metrics

-- =============================================================================
-- PATCH EXISTING: agent_metrics (has different schema: period_start/period_end instead of period)
-- =============================================================================

-- Add missing columns to existing agent_metrics
ALTER TABLE public.agent_metrics ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);
ALTER TABLE public.agent_metrics ADD COLUMN IF NOT EXISTS period VARCHAR(20) DEFAULT 'daily';
ALTER TABLE public.agent_metrics ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Drop bad index on period, recreate
DROP INDEX IF EXISTS idx_agent_metrics_type;
CREATE INDEX IF NOT EXISTS idx_agent_metrics_type
  ON public.agent_metrics(metric_type, period);

-- =============================================================================
-- NEW: AGENT TASKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(100) UNIQUE NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    user_id UUID,
    outlet_id BIGINT,
    CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON public.agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON public.agent_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_task_type ON public.agent_tasks(task_type);

-- =============================================================================
-- NEW: AGENT REGISTRATION TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    description TEXT,
    capabilities TEXT[],
    status VARCHAR(20) DEFAULT 'online'
        CHECK (status IN ('online', 'busy', 'offline', 'error', 'maintenance')),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    tasks_completed_today INTEGER DEFAULT 0,
    tasks_completed_total BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    queue_size INTEGER DEFAULT 0,
    uptime_percentage FLOAT DEFAULT 100.0,
    error_rate_percentage FLOAT DEFAULT 0.0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);

-- =============================================================================
-- NEW: AGENT LOGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id SERIAL PRIMARY KEY,
    log_id VARCHAR(100) UNIQUE NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100),
    level VARCHAR(10) NOT NULL DEFAULT 'info'
        CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
    message TEXT NOT NULL,
    source VARCHAR(50) DEFAULT 'agent',
    task_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON public.agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON public.agent_logs(level);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON public.agent_logs(created_at DESC);

-- =============================================================================
-- LOG AGENT EVENT RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_agent_event(
    p_agent_id VARCHAR,
    p_level VARCHAR,
    p_message TEXT,
    p_metadata JSONB DEFAULT NULL,
    p_task_id VARCHAR DEFAULT NULL,
    p_source VARCHAR DEFAULT 'agent'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id_val VARCHAR(100);
BEGIN
    log_id_val := 'log_' || substr(md5(random()::text), 1, 16) || '_' || floor(extract(epoch from now()))::bigint;

    INSERT INTO public.agent_logs (log_id, agent_id, level, message, source, task_id, metadata)
    VALUES (log_id_val, p_agent_id, p_level, p_message, p_source, p_task_id, p_metadata);

    RETURN log_id_val;
END;
$$;

-- =============================================================================
-- RECORD AGENT METRIC RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_agent_metric(
    p_agent_id VARCHAR,
    p_metric_type VARCHAR,
    p_value FLOAT,
    p_unit VARCHAR DEFAULT 'count',
    p_period VARCHAR DEFAULT 'daily',
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.agent_metrics (agent_id, metric_type, metric_value, metric_unit, period, period_start, period_end, recorded_at, metadata)
    VALUES (
        p_agent_id, p_metric_type, p_value, p_unit, p_period,
        CASE p_period
            WHEN 'hourly' THEN date_trunc('hour', NOW())
            WHEN 'daily' THEN date_trunc('day', NOW())
            WHEN 'weekly' THEN date_trunc('week', NOW())
            WHEN 'monthly' THEN date_trunc('month', NOW())
            ELSE date_trunc('day', NOW())
        END,
        CASE p_period
            WHEN 'hourly' THEN date_trunc('hour', NOW()) + INTERVAL '1 hour'
            WHEN 'daily' THEN date_trunc('day', NOW()) + INTERVAL '1 day'
            WHEN 'weekly' THEN date_trunc('week', NOW()) + INTERVAL '1 week'
            WHEN 'monthly' THEN date_trunc('month', NOW()) + INTERVAL '1 month'
            ELSE date_trunc('day', NOW()) + INTERVAL '1 day'
        END,
        NOW(), p_metadata
    );

    -- Update agent heartbeat
    UPDATE public.agents SET last_heartbeat = NOW(), last_active = NOW() WHERE id = p_agent_id;
END;
$$;

-- =============================================================================
-- SEED DEFAULT AGENTS
-- =============================================================================
INSERT INTO public.agents (id, name, role, description, capabilities, status) VALUES
    ('athena', 'Athena', 'Main AI Assistant',
     'Primary AI assistant for natural language queries, summaries, and explanations',
     ARRAY['Chat', 'Summarize', 'Explain', 'Recommend', 'Knowledge Base'],
     'online'),
    ('monitor', 'Monitor', 'Alert & Monitoring Agent',
     '24/7 monitoring of outlet metrics, anomaly detection, alert triggers',
     ARRAY['Z-score Anomaly', 'Stockout Detection', 'Alert Triggers', 'Real-time Watch'],
     'online'),
    ('analyst', 'Analyst', 'Data Analysis Agent',
     'Analyzes trends, generates insights, produces reports, benchmarks',
     ARRAY['Trend Analysis', 'Forecasting', 'Report Generation', 'Benchmarking'],
     'online'),
    ('coordinator', 'Coordinator', 'Task Routing Agent',
     'Routes requests to appropriate agents, assigns cases, handles escalation',
     ARRAY['Task Routing', 'Case Assignment', 'Escalation', 'Priority Queue'],
     'online'),
    ('triage', 'Triage', 'Case Triage Agent',
     'Categorizes incoming issues, suggests resolution paths, calculates SLA',
     ARRAY['Categorization', 'Priority Scoring', 'SLA Calculation', 'Similar Case Lookup'],
     'online'),
    ('executor', 'Executor', 'Action Execution Agent',
     'Executes automated actions: create case, send notification, update CRM',
     ARRAY['Create Case', 'Send Alert', 'Notify', 'CRM Update', 'Webhook Trigger'],
     'online')
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role full access agent_tasks" ON public.agent_tasks;
CREATE POLICY "Service role full access agent_tasks" ON public.agent_tasks
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access agent_metrics" ON public.agent_metrics;
CREATE POLICY "Service role full access agent_metrics" ON public.agent_metrics
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access agents" ON public.agents;
CREATE POLICY "Service role full access agents" ON public.agents
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access agent_logs" ON public.agent_logs;
CREATE POLICY "Service role full access agent_logs" ON public.agent_logs
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.agent_tasks IS 'Records individual task executions by AI agents';
COMMENT ON TABLE public.agent_metrics IS 'Aggregated performance metrics per agent';
COMMENT ON TABLE public.agents IS 'Registered AI agents with status and capabilities';
COMMENT ON TABLE public.agent_logs IS 'Detailed event logs from AI agents';
