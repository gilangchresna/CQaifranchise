-- =============================================================================
-- Fix: royalty_payments is missing the due_date column that its own index
-- (idx_royalty_payments_due, created in 20260828000000_royalty_program.sql)
-- already references. This was discovered while executing the agentic
-- ecosystem migration against a real Postgres instance (pglite) loaded with
-- the actual prerequisite schema — CREATE INDEX idx_royalty_payments_due ON
-- royalty_payments(period_month, due_date) fails with "column due_date does
-- not exist" because royalty_payments never defines that column (due_date
-- only exists on the separate royalty_invoices table).
--
-- Practical implication: since Supabase applies each migration file inside
-- one transaction, this failing CREATE INDEX statement would have rolled
-- back the ENTIRE 20260828000000_royalty_program.sql migration — meaning
-- royalty_settings, royalty_agreements, royalty_calculations,
-- royalty_payments, royalty_invoices, and royalty_alerts may never have
-- been created on the live database at all, and the royalty cron jobs
-- (20260828000001) and every royalty-* Edge Function would be failing.
-- This needs verifying against the live project directly (this session has
-- no access to it) — check with:
--   SELECT tablename FROM pg_tables WHERE tablename LIKE 'royalty_%';
-- If none of those tables exist, re-run 20260828000000_royalty_program.sql
-- (or this whole migration sequence) after applying this fix.
-- =============================================================================

alter table royalty_payments add column if not exists due_date date;

-- Backfill a reasonable default for any existing rows: royalty payments are
-- typically due some number of days after the period they cover. Using
-- period_month + 30 days as a sane default; adjust if your agreements use a
-- different net-terms convention.
update royalty_payments
set due_date = period_month + interval '30 days'
where due_date is null and period_month is not null;
