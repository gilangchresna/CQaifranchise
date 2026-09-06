-- ============================================================================
-- 003: Agentic Ecosystem Expansion — 10 new agents, every module at 2+
-- ============================================================================
-- See COVERAGE_MAP.md for the full module-to-agent mapping and the
-- rationale for shared vs. dedicated tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Shared agent insights table (Royalty Auditor, Shift, Coach, Curator,
--    Librarian, Gatekeeper, Bridge, Guardian, Steward, Benchmarker, Scout)
-- ----------------------------------------------------------------------------
create table if not exists agent_insights (
  id bigint generated always as identity primary key,
  agent_name text not null,             -- e.g. 'shift', 'gatekeeper', 'scout'
  module text not null,                 -- e.g. 'Workforce', 'Integrations', 'Peer'
  outlet_id uuid references outlets(id),-- null = network/HQ-level insight (e.g. Integrations, Access)
  category text not null,               -- agent-specific, e.g. 'staffing_shortfall', 'connector_down'
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  details text,
  payload jsonb default '{}'::jsonb,    -- structured extra data specific to the agent
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_agent_insights_outlet on agent_insights(outlet_id, status);
create index if not exists idx_agent_insights_agent on agent_insights(agent_name, created_at desc);
create index if not exists idx_agent_insights_module on agent_insights(module, status);

alter table agent_insights enable row level security;

-- Outlet-scoped insights follow the same role/region/ownership pattern as
-- compliance_flags. Network-level insights (outlet_id is null) are HQ/Regional only.
create policy agent_insights_select on agent_insights
  for select
  using (
    (
      outlet_id is not null and exists (
        select 1 from user_profiles up
        join outlets o on o.id = agent_insights.outlet_id
        where up.id = auth.uid()
          and (
            up.role = 'HQ_ADMIN'
            or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
            or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_owner_id = up.id)
          )
      )
    )
    or (
      outlet_id is null and exists (
        select 1 from user_profiles up where up.id = auth.uid() and up.role in ('HQ_ADMIN', 'REGIONAL_MANAGER')
      )
    )
  );

create policy agent_insights_service_write on agent_insights
  for insert
  with check (auth.role() = 'service_role');

create policy agent_insights_update on agent_insights
  for update
  using (
    exists (
      select 1 from user_profiles up where up.id = auth.uid() and up.role in ('HQ_ADMIN', 'REGIONAL_MANAGER')
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Collector agent — post-disbursement repayment monitoring (Financing)
-- ----------------------------------------------------------------------------
create table if not exists repayment_events (
  id bigint generated always as identity primary key,
  outlet_id uuid not null references outlets(id),
  loan_sizing_id bigint references loan_sizing_recommendations(id),
  due_date date not null,
  amount_due numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  paid_at timestamptz,
  days_late integer generated always as (
    case when paid_at is null and due_date < current_date
      then current_date - due_date
      else 0
    end
  ) stored,
  status text not null default 'due' check (status in ('due', 'paid', 'late', 'defaulted')),
  created_at timestamptz not null default now()
);

create index if not exists idx_repayment_events_outlet on repayment_events(outlet_id, due_date desc);

alter table repayment_events enable row level security;

create policy repayment_events_select on repayment_events
  for select
  using (
    exists (
      select 1 from user_profiles up
      join outlets o on o.id = repayment_events.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_owner_id = up.id)
        )
    )
  );

create policy repayment_events_service_write on repayment_events
  for insert with check (auth.role() = 'service_role');

create policy repayment_events_service_update on repayment_events
  for update using (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 3. Ledger agent — royalty reconciliation (Royalty)
-- ----------------------------------------------------------------------------
create table if not exists royalty_reconciliation (
  id bigint generated always as identity primary key,
  outlet_id uuid not null references outlets(id),
  period_start date not null,
  period_end date not null,
  expected_royalty numeric(14,2) not null,   -- from the royalty formula engine
  ledger_royalty numeric(14,2) not null,     -- derived from bank GL / sales ledger
  variance numeric(14,2) generated always as (ledger_royalty - expected_royalty) stored,
  variance_pct numeric(6,4) generated always as (
    case when expected_royalty = 0 then 0
    else (ledger_royalty - expected_royalty) / nullif(expected_royalty, 0)
    end
  ) stored,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_royalty_reconciliation_outlet on royalty_reconciliation(outlet_id, period_end desc);

alter table royalty_reconciliation enable row level security;

create policy royalty_reconciliation_select on royalty_reconciliation
  for select
  using (
    exists (
      select 1 from user_profiles up
      join outlets o on o.id = royalty_reconciliation.outlet_id
      where up.id = auth.uid()
        and (
          up.role = 'HQ_ADMIN'
          or (up.role = 'REGIONAL_MANAGER' and o.region_id = up.region_id)
          or (up.role in ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') and o.franchisee_owner_id = up.id)
        )
    )
  );

create policy royalty_reconciliation_service_write on royalty_reconciliation
  for insert with check (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 4. Verification checklist
-- ----------------------------------------------------------------------------
-- [ ] Confirm `outlets` columns (region_id, franchisee_owner_id) match — same
--     assumption as migrations 001/002.
-- [ ] `select * from pg_policies where tablename in
--     ('agent_insights','repayment_events','royalty_reconciliation');`
-- [ ] Test agent_insights visibility for a network-level (outlet_id null) row
--     as a Franchisee — should return zero rows.
