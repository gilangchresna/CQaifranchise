-- Integrations table for external system connections
CREATE TABLE IF NOT EXISTS public.integrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    description TEXT,
    config JSONB DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role all" ON public.integrations FOR ALL TO service_role USING (true) WITH CHECK (true);
