-- =============================================================================
-- Cron jobs for the agentic ecosystem expansion agents.
-- None of these 16 agents had any scheduled trigger before this migration —
-- they existed only as deployable functions, reachable solely via manual
-- HTTP invocation. Follows the same net.http_post + current_setting pattern
-- already established in 20260828000001_royalty_cron_jobs.sql.
--
-- IMPORTANT — PRE-FLIGHT CHECK BEFORE APPLYING THIS FILE:
-- current_setting('app.settings.supabase_url') and
-- current_setting('app.settings.supabase_service_key') are NOT set by any
-- migration in this repo (the royalty cron jobs from 2026-08-28 rely on the
-- same two settings and have the identical dependency). No migration sets
-- them, which strongly suggests they were configured manually against the
-- live database (the secret should never be committed to a migration file).
-- Confirm they exist before applying this migration, e.g. in the Supabase
-- SQL editor:
--   SELECT current_setting('app.settings.supabase_url', true);
--   SELECT current_setting('app.settings.supabase_service_key', true);
-- If either returns NULL, set them once (session-independent, database-level):
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<project-ref>.supabase.co';
--   ALTER DATABASE postgres SET app.settings.supabase_service_key = '<service_role_key>';
-- If this was never done, the pre-existing royalty cron jobs (2026-08-28)
-- are almost certainly failing silently too — worth checking
-- cron.job_run_details for past failures on those job names while you're in there.
--
-- Bridge and send-financing-request are intentionally NOT scheduled here:
-- Bridge validates payloads as they arrive (event-triggered from whatever
-- ingests POS/lender webhooks) and send-financing-request is invoked
-- directly by the frontend when a franchisee submits a request — neither
-- is a "scan on a schedule" agent.
-- =============================================================================

-- Fail loudly, immediately, if the required GUCs are missing — rather than
-- silently creating 15 cron jobs that will all fail on their first run.
-- This also protects the pre-existing royalty cron jobs' assumption.
DO $$
BEGIN
  IF current_setting('app.settings.supabase_url', true) IS NULL THEN
    RAISE EXCEPTION 'app.settings.supabase_url is not set on this database. Run: ALTER DATABASE postgres SET app.settings.supabase_url = ''https://<project-ref>.supabase.co''; before applying this migration.';
  END IF;
  IF current_setting('app.settings.supabase_service_key', true) IS NULL THEN
    RAISE EXCEPTION 'app.settings.supabase_service_key is not set on this database. Run: ALTER DATABASE postgres SET app.settings.supabase_service_key = ''<service_role_key>''; before applying this migration.';
  END IF;
END $$;

-- Underwriter — event-triggered ideally (on new financing_requests), hourly fallback
SELECT cron.schedule(
    'underwriter-agent-hourly',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/underwriter-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Sentinel — daily system health / compliance sweep
SELECT cron.schedule(
    'sentinel-agent-daily',
    '0 6 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/sentinel-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Collector — daily EMI repayment schedule scan
SELECT cron.schedule(
    'collector-agent-daily',
    '0 7 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/collector-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Ledger — weekly royalty reconciliation sweep
SELECT cron.schedule(
    'ledger-agent-weekly',
    '0 8 * * 1',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/ledger-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Royalty Auditor — daily (royalty_calculations rows are created continuously
-- by royalty-calculator, so check daily rather than waiting for a monthly cycle)
SELECT cron.schedule(
    'royalty-auditor-agent-daily',
    '30 6 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/royalty-auditor-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Voice — daily complaint pattern scan
SELECT cron.schedule(
    'voice-agent-daily',
    '0 9 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/voice-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Shift — daily evening run, ahead of next-day shifts
SELECT cron.schedule(
    'shift-agent-daily',
    '0 18 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/shift-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Coach — weekly staff performance review
SELECT cron.schedule(
    'coach-agent-weekly',
    '0 8 * * 1',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/coach-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Curator — weekly KB-gap detection
SELECT cron.schedule(
    'curator-agent-weekly',
    '0 9 * * 1',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/curator-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Librarian — monthly KB staleness audit
SELECT cron.schedule(
    'librarian-agent-monthly',
    '0 9 1 * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/librarian-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Gatekeeper — every 15 minutes (connector staleness needs fast detection)
SELECT cron.schedule(
    'gatekeeper-agent-15min',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/gatekeeper-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Guardian — weekly access hygiene review
SELECT cron.schedule(
    'guardian-agent-weekly',
    '0 8 * * 1',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/guardian-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Steward — daily invitation/access lifecycle check
SELECT cron.schedule(
    'steward-agent-daily',
    '0 7 * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/steward-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Benchmarker — weekly peer underperformance scan
SELECT cron.schedule(
    'benchmarker-agent-weekly',
    '0 9 * * 1',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/benchmarker-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);

-- Scout — monthly expansion/cannibalisation analysis
SELECT cron.schedule(
    'scout-agent-monthly',
    '0 9 1 * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/scout-agent',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
        )
    );
    $$
);
