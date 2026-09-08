-- =============================================================================
-- Agentic Ecosystem Expansion — CORRECTED (supersedes the original version of
-- this file, which never applied successfully). Fixed 2026-09-08.
--
-- The original version of this migration would have failed at CREATE TABLE
-- time because:
--   1. `outlet_id uuid references outlets(id)` — outlets.id is SERIAL
--      (integer), not uuid. Postgres rejects a foreign key between mismatched
--      types, so this CREATE TABLE statement errors immediately.
--   2. RLS policies joined on `o.franchisee_owner_id`, but the real column
--      on public.outlets is `franchisee_id`.
--   3. It tried to CREATE TABLE IF NOT EXISTS repayment_events with a
--      completely different schema (outlet_id/due_date/amount_due/status)
--      than the repayment_events table already created in
--      20260805000000_financing_and_reporting.sql (application_id/event_type/
--      days_overdue). Because that table already existed, the IF NOT EXISTS
--      would have silently no-opped — meaning the Collector agent's expected
--      columns would never actually exist on the real table.
--   4. Several already-deployed Edge Functions (underwriter-agent,
--      ledger-agent, send-financing-request, sentinel-agent) reference
--      tables that no migration ever created: financiers, financing_requests,
--      risk_scores, loan_sizing_recommendations, audit_log, compliance_flags.
--      This migration creates all of them, matching the exact columns those
--      already-written functions use (verified by reading each function's
--      source directly rather than re-guessing a schema).
--
-- Design decisions made while fixing this:
--   - Collector now reads the EXISTING repayment_schedule + financing_applications
--     tables (created 2026-08-05) instead of a new colliding repayment_events
--     table — no new repayment table is created here at all.
--   - Ledger's royalty_reconciliation table is defined to match what
--     ledger-agent/index.ts already queries (expected_amount/actual_amount/
--     variance/status/period_month as 'YYYY-MM' text), not the original
--     design's expected_royalty/ledger_royalty/generated-column version.
--   - risk_scores and loan_sizing_recommendations are defined to match what
--     underwriter-agent/index.ts already inserts — this is a DIFFERENT,
--     simpler shape than application_risk_scores (created 2026-08-05, which
--     serves a different purpose: point-in-time application underwriting
--     history with computation_method tracking). Both tables now coexist
--     intentionally; they are not the same concept.
--   - audit_log.user_id is TEXT, not a UUID FK to auth.users — every existing
--     call site (sentinel-agent, underwriter-agent, send-financing-request,
--     the shared agentInsights helper) passes the literal string "system"
--     for automated runs, which would fail against a UUID column.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. audit_log — generic append-only action log (distinct from the
--    pre-existing ai_audit_log, which is specifically for AI chat/prompt
--    interactions per FR-AI-06; this one is for agent/system actions).
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  user_id text,                    -- "system" for automated agent runs, or a real auth.users UUID as text
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb default '{}'::jsonb
);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
  for insert
  with check (true); -- written by service-role edge functions; no client-side insert path exists

drop policy if exists audit_log_select_hq_only on public.audit_log;
create policy audit_log_select_hq_only on public.audit_log
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'HQ_ADMIN'
    )
  );

create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_occurred on public.audit_log(occurred_at desc);

-- ----------------------------------------------------------------------------
-- 2. agent_insights — shared table for the 11 lightweight pattern-detection
--    agents (royalty_auditor, voice, shift, coach, curator, librarian,
--    gatekeeper, bridge, guardian, steward, benchmarker, scout).
-- ----------------------------------------------------------------------------
create table if not exists public.agent_insights (
  id bigint generated always as identity primary key,
  agent_name text not null,
  module text not null,
  outlet_id integer references public.outlets(id),  -- FIXED: was uuid; outlets.id is integer. null = network/HQ-level insight.
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  details text,
  payload jsonb default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_agent_insights_outlet on public.agent_insights(outlet_id, status);
create index if not exists idx_agent_insights_agent on public.agent_insights(agent_name, created_at desc);
create index if not exists idx_agent_insights_module on public.agent_insights(module, status);

alter table public.agent_insights enable row level security;

drop policy if exists agent_insights_select on public.agent_insights;
create policy agent_insights_select on public.agent_insights
  for select
  using (
    (
      outlet_id is not null and exists (
        select 1 from public.user_profiles up
        join public.outlets o on o.id = agent_insights.outlet_id
        where up.id = auth.uid()
          and (
            up.role = 'HQ_ADMIN'
            or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
            -- FIXED: was o.franchisee_owner_id; real column is franchisee_id
            or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_id = up.id)
          )
      )
    )
    or (
      outlet_id is null and exists (
        select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('HQ_ADMIN', 'REGIONAL_MANAGER')
      )
    )
  );

drop policy if exists agent_insights_service_write on public.agent_insights;
create policy agent_insights_service_write on public.agent_insights
  for insert
  with check (true); -- written by service-role edge functions

drop policy if exists agent_insights_update on public.agent_insights;
create policy agent_insights_update on public.agent_insights
  for update
  using (
    exists (
      select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('HQ_ADMIN', 'REGIONAL_MANAGER')
    )
  );

-- ----------------------------------------------------------------------------
-- 3. compliance_flags — matches sentinel-agent/index.ts's actual insert shape
--    (flag_type, severity, description, flagged_at — not the original design's
--    details/raised_at).
-- ----------------------------------------------------------------------------
create table if not exists public.compliance_flags (
  id bigint generated always as identity primary key,
  outlet_id integer references public.outlets(id),
  flag_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  description text,
  flagged_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  resolved_at timestamptz
);

create index if not exists idx_compliance_flags_outlet on public.compliance_flags(outlet_id, status);

alter table public.compliance_flags enable row level security;

drop policy if exists compliance_flags_select on public.compliance_flags;
create policy compliance_flags_select on public.compliance_flags
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      join public.outlets o on o.id = compliance_flags.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_id = up.id)
        )
    )
  );

drop policy if exists compliance_flags_service_write on public.compliance_flags;
create policy compliance_flags_service_write on public.compliance_flags
  for insert with check (true);

drop policy if exists compliance_flags_update on public.compliance_flags;
create policy compliance_flags_update on public.compliance_flags
  for update
  using (
    exists (
      select 1 from public.user_profiles up where up.id = auth.uid() and up.role in ('HQ_ADMIN', 'REGIONAL_MANAGER')
    )
  );

-- ----------------------------------------------------------------------------
-- 4. financiers — directory of financing partners (genuinely new; no
--    collision with any pre-existing table).
-- ----------------------------------------------------------------------------
create table if not exists public.financiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market text not null check (market in ('SG', 'ID', 'Both')),
  contact_name text,
  contact_email text not null,
  dscr_min numeric(6,3) not null default 1.25,
  ebitda_multiple numeric(6,3) not null default 3.0,
  ltv_max numeric(5,4) not null default 0.70,
  status text not null default 'active' check (status in ('active', 'inactive')),
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.financiers enable row level security;

drop policy if exists financiers_select_active on public.financiers;
create policy financiers_select_active on public.financiers
  for select
  using (
    status = 'active'
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'HQ_ADMIN')
  );

drop policy if exists financiers_hq_manage on public.financiers;
create policy financiers_hq_manage on public.financiers
  for insert with check (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'HQ_ADMIN')
  );

drop policy if exists financiers_hq_update on public.financiers;
create policy financiers_hq_update on public.financiers
  for update using (
    exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'HQ_ADMIN')
  );

-- ----------------------------------------------------------------------------
-- 5. financing_requests — matches the ALREADY-WRITTEN underwriter-agent,
--    ledger-agent, and send-financing-request functions' actual usage.
--    Distinct from financing_applications (2026-08-05): this is the earlier
--    "browse a financier and ask about options" step; a request may later
--    turn into a formal financing_applications row, but that link is manual
--    for now (see FIX_CHANGELOG.md for this session).
-- ----------------------------------------------------------------------------
create table if not exists public.financing_requests (
  id uuid primary key default gen_random_uuid(),
  outlet_id integer not null references public.outlets(id),
  franchisee_id uuid references public.user_profiles(id),
  financier_id uuid references public.financiers(id),
  purpose text,
  requested_amount numeric(15,2),
  currency text default 'SGD',
  requested_term_months integer,
  market text,
  lender_code text,               -- set by send-financing-request from financiers.market
  last_lender_response text,      -- plain-text status/error string set by send-financing-request
  status text not null default 'pending' check (
    status in ('pending', 'submitted', 'sent_to_financier', 'underwriting_complete', 'responded', 'closed', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financing_requests_outlet on public.financing_requests(outlet_id, created_at desc);
create index if not exists idx_financing_requests_status on public.financing_requests(status);

alter table public.financing_requests enable row level security;

drop policy if exists financing_requests_select on public.financing_requests;
create policy financing_requests_select on public.financing_requests
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      join public.outlets o on o.id = financing_requests.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_id = up.id)
        )
    )
  );

drop policy if exists financing_requests_insert on public.financing_requests;
create policy financing_requests_insert on public.financing_requests
  for insert
  with check (
    exists (
      select 1 from public.user_profiles up
      join public.outlets o on o.id = financing_requests.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_id = up.id)
        )
    )
  );

drop policy if exists financing_requests_service_update on public.financing_requests;
create policy financing_requests_service_update on public.financing_requests
  for update using (true); -- status transitions (sent_to_financier, underwriting_complete, etc.) are written by edge functions

-- ----------------------------------------------------------------------------
-- 6. risk_scores — matches underwriter-agent/index.ts's actual insert shape.
--    Deliberately distinct from application_risk_scores (2026-08-05); that
--    table tracks point-in-time application underwriting history with a
--    computation_method column, this one is the Underwriter agent's own
--    continuous credit-risk assessment per financing_requests row.
-- ----------------------------------------------------------------------------
create table if not exists public.risk_scores (
  id bigint generated always as identity primary key,
  outlet_id integer references public.outlets(id),
  franchisee_id uuid references public.user_profiles(id),
  score_type text not null default 'credit_risk',
  score_value numeric(6,2) not null,
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  factors jsonb default '{}'::jsonb,
  recommendation text,
  assessed_at timestamptz not null default now()
);

create index if not exists idx_risk_scores_outlet on public.risk_scores(outlet_id, assessed_at desc);

alter table public.risk_scores enable row level security;

drop policy if exists risk_scores_select on public.risk_scores;
create policy risk_scores_select on public.risk_scores
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      left join public.outlets o on o.id = risk_scores.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and (o.franchisee_id = up.id or risk_scores.franchisee_id = up.id))
        )
    )
  );

drop policy if exists risk_scores_service_write on public.risk_scores;
create policy risk_scores_service_write on public.risk_scores
  for insert with check (true);

-- ----------------------------------------------------------------------------
-- 7. loan_sizing_recommendations — matches underwriter-agent/index.ts.
-- ----------------------------------------------------------------------------
create table if not exists public.loan_sizing_recommendations (
  id bigint generated always as identity primary key,
  franchisee_id uuid references public.user_profiles(id),
  outlet_id integer references public.outlets(id),
  application_id uuid references public.financing_requests(id), -- naming kept as "application_id" to match the function's existing field name; points at financing_requests, not financing_applications
  requested_amount numeric(15,2),
  recommended_amount numeric(15,2),
  approved_amount numeric(15,2),
  interest_rate_bps integer,
  term_months integer,
  dscr_min numeric(8,2),
  monthly_payment numeric(15,2),
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);

create index if not exists idx_loan_sizing_outlet on public.loan_sizing_recommendations(outlet_id, created_at desc);

alter table public.loan_sizing_recommendations enable row level security;

drop policy if exists loan_sizing_select on public.loan_sizing_recommendations;
create policy loan_sizing_select on public.loan_sizing_recommendations
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      left join public.outlets o on o.id = loan_sizing_recommendations.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and (o.franchisee_id = up.id or loan_sizing_recommendations.franchisee_id = up.id))
        )
    )
  );

drop policy if exists loan_sizing_service_write on public.loan_sizing_recommendations;
create policy loan_sizing_service_write on public.loan_sizing_recommendations
  for insert with check (true);

-- ----------------------------------------------------------------------------
-- 8. royalty_reconciliation — matches ledger-agent/index.ts's actual query
--    shape (expected_amount/actual_amount/variance/status/period_month as
--    'YYYY-MM' text), linked to the real royalty_calculations/royalty_payments
--    tables (2026-08-28) rather than the outlet-keyed design originally proposed.
-- ----------------------------------------------------------------------------
create table if not exists public.royalty_reconciliation (
  id bigint generated always as identity primary key,
  outlet_id integer references public.outlets(id),
  royalty_calculation_id uuid references royalty_calculations(id),
  period_month text not null,        -- 'YYYY-MM', matches ledger-agent's monthStart.slice(0,7) usage
  expected_amount numeric(15,2),
  actual_amount numeric(15,2),
  variance numeric(15,2),
  status text not null default 'pending' check (status in ('pending', 'reconciled', 'flagged')),
  created_at timestamptz not null default now()
);

create index if not exists idx_royalty_reconciliation_outlet on public.royalty_reconciliation(outlet_id, period_month);
create index if not exists idx_royalty_reconciliation_status on public.royalty_reconciliation(status);

alter table public.royalty_reconciliation enable row level security;

drop policy if exists royalty_reconciliation_select on public.royalty_reconciliation;
create policy royalty_reconciliation_select on public.royalty_reconciliation
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      left join public.outlets o on o.id = royalty_reconciliation.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_id = up.id)
        )
    )
  );

drop policy if exists royalty_reconciliation_service_write on public.royalty_reconciliation;
create policy royalty_reconciliation_service_write on public.royalty_reconciliation
  for insert with check (true);

-- =============================================================================
-- Verification queries (run manually after applying):
--
-- select tablename from pg_tables where schemaname = 'public' and tablename in
--   ('audit_log','agent_insights','compliance_flags','financiers',
--    'financing_requests','risk_scores','loan_sizing_recommendations',
--    'royalty_reconciliation');
-- -- should return all 8 rows
--
-- select * from pg_policies where tablename in
--   ('audit_log','agent_insights','compliance_flags','financiers',
--    'financing_requests','risk_scores','loan_sizing_recommendations',
--    'royalty_reconciliation');
-- -- should show policies for every table above
-- =============================================================================
