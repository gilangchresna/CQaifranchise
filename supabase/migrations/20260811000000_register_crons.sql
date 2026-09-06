-- Register pg_cron jobs for coordinator-pipeline and sla-escalator
-- pg_cron net.http_post requires Authorization header (anon key sufficient)
-- ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnendqem11a2dwIiwicm9sZSI6ImFub24ifQ.IRLBqmMUPBvXbVmuPpN5yABNn-Q8WWNb5U2TT_uB

-- coordinator-pipeline: ML anomaly + stockout + alert creation — every 15 min
SELECT cron.schedule(
  'coordinator-pipeline',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/coordinator-pipeline',
    headers=>'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnendqem11a2dwIiwicm9sZSI6ImFub24ifQ.IRLBqmMUPBvXbVmuPpN5yABNn-Q8WWNb5U2TT_uB_pk"}',
    body=>'{"triggered_by":"cron"}'
  )$$
);

-- sla-escalator: SLA check + escalation — every 15 min
SELECT cron.schedule(
  'sla-escalator',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sla-escalator',
    headers=>'{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnendqem11a2dwIiwicm9sZSI6ImFub24ifQ.IRLBqmMUPBvXbVmuPpN5yABNn-Q8WWNb5U2TT_uB_pk"}',
    body=>'{"triggered_by":"cron"}'
  )$$
);

-- Verify all schedules
SELECT jobname, schedule, command FROM cron.job;
