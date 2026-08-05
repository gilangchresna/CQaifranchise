-- =============================================================================
-- QA FIX P0 BUGS - Run in Supabase Dashboard → SQL Editor
-- Date: July 16, 2026
-- NOTE: notification_logs table already exists with correct schema
-- =============================================================================

-- =============================================================================
-- Bug Fix #1: notification_logs - add missing columns
-- =============================================================================
DO $$
BEGIN
  -- Add recipient column (combined field)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'recipient'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN recipient TEXT;
  END IF;
  
  -- Add message column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'message'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN message TEXT;
  END IF;
  
  -- Add external_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN external_id TEXT;
  END IF;
  
  -- Add delivered_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
  
  -- Add notification_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'notification_id'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN notification_id UUID DEFAULT gen_random_uuid();
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_sla_escalation_runs_run_id ON sla_escalation_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_sla_escalation_runs_started_at ON sla_escalation_runs(started_at);

-- =============================================================================
-- Bug Fix #3: Add region_id to cases table
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cases' AND column_name = 'region_id'
  ) THEN
    ALTER TABLE cases ADD COLUMN region_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_cases_region_id ON cases(region_id);
  END IF;
END $$;

-- =============================================================================
-- Bug Fix #4: Add region_id to alerts table
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'region_id'
  ) THEN
    ALTER TABLE alerts ADD COLUMN region_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_alerts_region_id ON alerts(region_id);
  END IF;
END $$;

-- =============================================================================
-- Seed sample data (using correct columns!)
-- =============================================================================
INSERT INTO notification_logs (alert_id, channel, recipient_email, status)
VALUES (1, 'EMAIL', 'steve@cyberquote.id', 'SENT')
ON CONFLICT DO NOTHING;

INSERT INTO sla_escalation_runs (cases_affected, cases_escalated, cases_warned, completed_at, duration_ms)
VALUES (0, 0, 0, NOW(), 100)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Verify
-- =============================================================================
SELECT 'notification_logs' as table_name, COUNT(*) as columns 
FROM information_schema.columns 
WHERE table_name = 'notification_logs'
UNION ALL
SELECT 'sla_escalation_runs', COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'sla_escalation_runs';
