-- Fix P0 Bugs: Create missing tables
-- Run this in Supabase Dashboard → SQL Editor

-- =============================================================================
-- Bug Fix #1: notification_logs table
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  notification_id UUID DEFAULT gen_random_uuid(),
  alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'PUSH', 'SMS')),
  recipient VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED')),
  error_message TEXT,
  external_id VARCHAR(255),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
DROP INDEX IF EXISTS idx_notification_logs_alert_id;
DROP INDEX IF EXISTS idx_notification_logs_case_id;
DROP INDEX IF EXISTS idx_notification_logs_status;
DROP INDEX IF EXISTS idx_notification_logs_created_at;

CREATE INDEX idx_notification_logs_alert_id ON notification_logs(alert_id);
CREATE INDEX idx_notification_logs_case_id ON notification_logs(case_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- =============================================================================
-- Bug Fix #2: sla_escalation_runs table
-- =============================================================================
CREATE TABLE IF NOT EXISTS sla_escalation_runs (
  id SERIAL PRIMARY KEY,
  run_id UUID DEFAULT gen_random_uuid(),
  cases_affected INTEGER DEFAULT 0,
  cases_escalated INTEGER DEFAULT 0,
  cases_warned INTEGER DEFAULT 0,
  errors TEXT[],
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Index
DROP INDEX IF EXISTS idx_sla_escalation_runs_run_id;
DROP INDEX IF EXISTS idx_sla_escalation_runs_started_at;

CREATE INDEX idx_sla_escalation_runs_run_id ON sla_escalation_runs(run_id);
CREATE INDEX idx_sla_escalation_runs_started_at ON sla_escalation_runs(started_at);

-- =============================================================================
-- Verify tables created
-- =============================================================================
SELECT 'notification_logs' as table_name, COUNT(*) as row_count FROM notification_logs
UNION ALL
SELECT 'sla_escalation_runs', COUNT(*) FROM sla_escalation_runs;
