-- Create agent_logs table if not exists
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id BIGSERIAL PRIMARY KEY,
    log_id VARCHAR(100) UNIQUE,
    agent_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100),
    level VARCHAR(10) DEFAULT 'info',
    log_level VARCHAR(10) DEFAULT 'info',
    message TEXT,
    source VARCHAR(100),
    task_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert
CREATE POLICY "Service role can all agent_logs" ON public.agent_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON public.agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON public.agent_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_level ON public.agent_logs(level);
