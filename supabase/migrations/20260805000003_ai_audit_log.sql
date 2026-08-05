-- Phase 2: AI Audit Log Table for FR-AI-06 compliance
-- Logs all AI interactions for audit trail

CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL,
  outlet_id INTEGER,
  prompt_hash TEXT NOT NULL,
  response_hash TEXT,
  model TEXT NOT NULL DEFAULT 'claude',
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  sources_used JSONB DEFAULT '[]',
  latency_ms INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users see their own audit logs, HQ_ADMIN sees all
CREATE POLICY "Users view own audit logs"
  ON public.ai_audit_log
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'HQ_ADMIN'
    )
  );

-- Policy: Service role can insert (edge functions log here)
CREATE POLICY "Service role can insert audit logs"
  ON public.ai_audit_log
  FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON public.ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_role ON public.ai_audit_log(role);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON public.ai_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_model ON public.ai_audit_log(model);
