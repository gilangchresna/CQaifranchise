
-- Check if pg_net extension is available
SELECT extname, extversion FROM pg_extension WHERE extname = 'net';

-- Create a wrapper function that triggers edge functions with auth
-- This runs IN postgres, calls edge function WITH Authorization header
CREATE OR REPLACE FUNCTION cron_trigger_agent(task_name TEXT)
RETURNS VOID AS $$
DECLARE
  result TEXT;
BEGIN
  -- Use pg_net to call edge function with Authorization header
  -- This bypasses Supabase platform auth gate since it comes from inside Postgres
  PERFORM net.http_post(
    url => 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/' || task_name,
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body => '{"source":"cron"}'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

-- Also create individual trigger functions for each agent
CREATE OR REPLACE FUNCTION cron_coordinator_pipeline()
RETURNS VOID AS $$
BEGIN
  PERFORM cron_trigger_agent('coordinator-pipeline');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cron_sla_escalator()
RETURNS VOID AS $$
BEGIN
  PERFORM cron_trigger_agent('sla-escalator');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cron_agent_monitor()
RETURNS VOID AS $$
BEGIN
  PERFORM cron_trigger_agent('agent-monitor');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cron_agent_status()
RETURNS VOID AS $$
BEGIN
  PERFORM cron_trigger_agent('agent-status');
END;
$$ LANGUAGE plpgsql;
