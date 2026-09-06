-- AI Agent Orchestration Tables (PATCH)
-- Run in Supabase Dashboard → SQL Editor
-- Existing: agent_tasks (UUID), agent_metrics, agent_logs (no log_id/agent_name/level cols)

-- =============================================================================
-- PATCH agent_logs: add missing columns
-- =============================================================================
ALTER TABLE public.agent_logs ADD COLUMN IF NOT EXISTS log_id VARCHAR(100);
ALTER TABLE public.agent_logs ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);
ALTER TABLE public.agent_logs ADD COLUMN IF NOT EXISTS level VARCHAR(10);

-- Backfill existing nulls
UPDATE public.agent_logs SET log_id = 'log_' || id::text WHERE log_id IS NULL;
UPDATE public.agent_logs SET level = COALESCE(log_level, 'info') WHERE level IS NULL;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_logs_log_id_key'
  ) THEN
    ALTER TABLE public.agent_logs ADD CONSTRAINT agent_logs_log_id_key UNIQUE (log_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- =============================================================================
-- CREATE agents table
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
-- SEED default agents
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
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

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
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id_val VARCHAR(100);
    log_level_val VARCHAR(10);
BEGIN
    log_id_val := 'log_' || substr(md5(random()::text), 1, 16) || '_' || floor(extract(epoch from now()))::bigint;
    log_level_val := COALESCE(p_level, 'info');

    INSERT INTO public.agent_logs
        (log_id, agent_id, level, log_level, message, source, task_id, metadata)
    VALUES
        (log_id_val, p_agent_id, log_level_val, log_level_val, p_message, p_source, p_task_id, p_metadata);

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
    INSERT INTO public.agent_metrics
        (agent_id, metric_type, metric_value, metric_unit, period, period_start, period_end, recorded_at, metadata)
    VALUES (
        p_agent_id, p_metric_type, p_value, p_unit, p_period,
        CASE p_period
            WHEN 'hourly'  THEN date_trunc('hour',   NOW())
            WHEN 'daily'   THEN date_trunc('day',    NOW())
            WHEN 'weekly'  THEN date_trunc('week',   NOW())
            WHEN 'monthly' THEN date_trunc('month', NOW())
            ELSE date_trunc('day', NOW())
        END,
        CASE p_period
            WHEN 'hourly'  THEN date_trunc('hour',   NOW()) + INTERVAL '1 hour'
            WHEN 'daily'   THEN date_trunc('day',    NOW()) + INTERVAL '1 day'
            WHEN 'weekly'  THEN date_trunc('week',   NOW()) + INTERVAL '1 week'
            WHEN 'monthly' THEN date_trunc('month', NOW()) + INTERVAL '1 month'
            ELSE date_trunc('day', NOW()) + INTERVAL '1 day'
        END,
        NOW(), p_metadata
    );

    -- Update agent heartbeat
    UPDATE public.agents
       SET last_heartbeat = NOW(), last_active = NOW()
     WHERE id = p_agent_id;
END;
$$;

-- =============================================================================
-- RLS for agents (agent_tasks + agent_metrics already have RLS)
-- =============================================================================
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access agents" ON public.agents;
CREATE POLICY "Service role full access agents" ON public.agents
    FOR ALL USING (auth.role() = 'service_role');
