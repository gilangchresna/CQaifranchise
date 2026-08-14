-- P2-1: Workflow State Persistence
-- Creates workflow_instances table for tracking multi-step workflow execution
-- Enables retry, audit trail, and resumability

-- =============================================================================
-- WORKFLOW INSTANCES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name TEXT NOT NULL,
    workflow_version TEXT DEFAULT 'v1',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    current_step TEXT,
    total_steps INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    
    -- Input/output
    payload JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    
    -- Error handling
    error_detail TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_by TEXT DEFAULT NULL,
    triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron', 'webhook', 'api')),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wf_status ON public.workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_wf_next_retry ON public.workflow_instances(next_retry_at) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_wf_created ON public.workflow_instances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wf_name ON public.workflow_instances(workflow_name);

-- =============================================================================
-- WORKFLOW STEPS (optional: track sub-steps)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    step_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    output JSONB DEFAULT '{}',
    error_detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_wf_step_instance ON public.workflow_steps(instance_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_order ON public.workflow_steps(instance_id, step_order);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Update workflow status helper
CREATE OR REPLACE FUNCTION public.workflow_update_status(
    p_instance_id UUID,
    p_status TEXT,
    p_step TEXT DEFAULT NULL,
    p_progress INTEGER DEFAULT NULL,
    p_result JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL,
    p_inc_retry BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_retry_count INTEGER;
BEGIN
    new_retry_count := (
        SELECT retry_count + CASE WHEN p_inc_retry THEN 1 ELSE 0 END
        FROM public.workflow_instances WHERE id = p_instance_id
    );
    
    UPDATE public.workflow_instances SET
        status = p_status,
        current_step = COALESCE(p_step, current_step),
        progress_percent = COALESCE(p_progress, progress_percent),
        result = COALESCE(p_result, result),
        error_detail = COALESCE(p_error, error_detail),
        retry_count = new_retry_count,
        next_retry_at = CASE
            WHEN p_status = 'failed' AND new_retry_count < 3
            THEN NOW() + (ARRAY['5 minutes', '15 minutes', '60 minutes'])[new_retry_count]::interval
            ELSE NULL
        END,
        started_at = CASE WHEN p_status = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_instance_id;
END;
$$;

-- Create workflow instance helper
CREATE OR REPLACE FUNCTION public.workflow_create(
    p_workflow_name TEXT,
    p_payload JSONB DEFAULT '{}',
    p_triggered_by TEXT DEFAULT 'manual',
    p_created_by UUID DEFAULT NULL,
    p_max_retries INTEGER DEFAULT 3
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.workflow_instances (
        workflow_name, payload, triggered_by, created_by, max_retries, status
    ) VALUES (
        p_workflow_name, p_payload, p_triggered_by, p_created_by, p_max_retries, 'pending'
    ) RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role full access workflow_instances" ON public.workflow_instances;
CREATE POLICY "Service role full access workflow_instances" ON public.workflow_instances
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access workflow_steps" ON public.workflow_steps;
CREATE POLICY "Service role full access workflow_steps" ON public.workflow_steps
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- SEED example
-- =============================================================================
-- Example workflow instance (for testing)
-- INSERT INTO public.workflow_instances (workflow_name, status, payload, triggered_by)
-- VALUES ('coordinator-pipeline', 'completed', '{"date": "2026-08-14"}', 'cron');
