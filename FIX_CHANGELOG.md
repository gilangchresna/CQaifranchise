# Fix Changelog — Agentic Ecosystem Deployability Pass

Date: 2026-09-08
Scope: Made the agentic ecosystem expansion (16 agents + financier selection
flow) actually deployable. Every item below was verified by reading the real
source directly — not re-guessed — before being changed.

## Critical bugs fixed

| # | Issue | File(s) | Fix |
|---|---|---|---|
| 1 | `outlet_id uuid references outlets(id)` — outlets.id is actually `SERIAL` (integer). This FK type mismatch would make the migration fail immediately on `CREATE TABLE`. | `20260905000000_agentic_ecosystem_expansion.sql` | Changed to `integer` throughout (`agent_insights`, `compliance_flags`, `financing_requests`, `risk_scores`, `loan_sizing_recommendations`, `royalty_reconciliation`). |
| 2 | RLS policies joined on `o.franchisee_owner_id` — the real column is `franchisee_id`. | Same migration | Fixed every occurrence. |
| 3 | The migration tried to `CREATE TABLE IF NOT EXISTS repayment_events` with a schema (`outlet_id`/`due_date`/`amount_due`) that collided with — and silently no-opped against — the real `repayment_events` table (application_id-keyed, created 2026-08-05). Net effect: Collector's expected columns never existed. | Same migration + `collector-agent/index.ts` | Removed the colliding table entirely. Collector now reads the real `repayment_schedule` table (joined through `financing_applications` for outlet_id). |
| 4 | Three already-deployed functions (`underwriter-agent`, `ledger-agent`, `send-financing-request`) query `financiers`, `financing_requests`, `risk_scores`, `loan_sizing_recommendations`, `audit_log`, `compliance_flags` — **none of which any migration ever created.** Every invocation would fail with "relation does not exist." | Same migration | Created all 6 tables, with columns matching exactly what the already-written functions use (verified by reading each function's source, not re-designing from scratch). |
| 5 | `_shared/agentInsights.ts` inserted arbitrary agent category strings (e.g. `"staffing_shortfall_risk"`) into `alerts.type`, which is a fixed 5-value Postgres enum (`SALES_ANOMALY`/`STOCKOUT_RISK`/`ATTENDANCE_ISSUE`/`COMPLAINT`/`SYSTEM`). Every agent write to `alerts` would fail. | `_shared/agentInsights.ts` | Added `mapCategoryToAlertType()` to map free-text categories onto the valid enum values. |
| 6 | `royalty-auditor-agent` was a stub that did nothing (logged "no_data" and returned success). | `royalty-auditor-agent/index.ts` | Real implementation: queries `royalty_calculations` directly, validates `effective_rate` against the published Score Multipliers band table, raises insights on mismatch. |
| 7 | `collector-agent` defensively guessed between two non-existent `repayment_events` schemas in a try/catch, and its `outlets(name)` embedded join would fail regardless since the real table has no relationship to `outlets`. | `collector-agent/index.ts` | Rewritten to query `repayment_schedule` joined through `financing_applications`. |
| 8 | `ledger-agent` checked `outlets.status = 'active'` (lowercase); the real `outlet_status` enum values are uppercase (`ACTIVE`/`INACTIVE`/`SUSPENDED`). Every "missing reconciliation" check would silently match zero active outlets. | `ledger-agent/index.ts` | One-line fix to `'ACTIVE'`. |
| 9 | `RepaymentsPanel.tsx` and `RoyaltyReconciliationPanel.tsx` (delivered components) queried the original, now-abandoned schema (`repayment_events` with `amount_due`/`amount_paid`; `royalty_reconciliation` with `expected_royalty`/`ledger_royalty`). | Both files | Rewritten to query the corrected tables with their actual column names. |
| 10 | `FinancierSelector.tsx` didn't exist anywhere, despite three functions already depending on the `financiers`/`financing_requests` tables it's meant to populate. | New file | Built to match `send-financing-request`'s actual body contract (`{ request_id, financier_id }`, snake_case). |
| 11 | None of the 16 new agents had a scheduled trigger — reachable only via manual HTTP invocation. | New migration `20260908000000_agentic_ecosystem_cron_jobs.sql` | Registered cron jobs for 15 of the 16 (Bridge is event-triggered by design; send-financing-request is invoked by the frontend). |
| 12 | Frontend wiring was completely absent — `App.tsx`'s `Tab` type, imports, and switch statement were byte-for-byte unchanged; every new component was unreachable. | `App.tsx`, `Layout.tsx` | Added imports, 5 new `Tab` values (Underwriter, Repayments, RoyaltyReconciliation, Financiers, Compliance), switch cases, and nav entries for HQ/Regional/Franchisee roles. |
| 13 | `compliance_flags` had a write path (`sentinel-agent`) but no UI to view it. | New file `ComplianceFlags.tsx` | Built and wired into the new "Compliance" tab. |

## Design decisions made (not bugs, but worth knowing)

- **`risk_scores` and `loan_sizing_recommendations` are deliberately separate from `application_risk_scores` and `financing_applications`** (both created 2026-08-05). They serve different purposes: the 08-05 tables track formal loan application underwriting history with a `computation_method` audit trail; the new tables are the Underwriter agent's own continuous outlet-level credit assessment, triggered by `financing_requests` (the lighter-weight "browse and ask" flow this session added). These two systems are not yet linked — a `financing_requests` row does not automatically become a `financing_applications` row. That's a reasonable next integration step, not done here.
- **`audit_log.user_id` is `TEXT`, not a UUID foreign key.** Every call site across 4 different files passes the literal string `"system"` for automated runs — making it a strict UUID FK would break all of them. This is distinct from the pre-existing `ai_audit_log` table (AI chat/prompt audit trail, unrelated purpose).
- **`royalty-auditor-agent`'s SCORE_BANDS table is hardcoded**, duplicating whatever `royalty-calculator` uses internally. If they drift out of sync, false positives will result. Should eventually read from one shared rate-bands table.
- **`FinancierSelector`'s market is hardcoded to `"SG"`** in `App.tsx` pending a real outlet→market/country field — there's no clean existing source for this per-outlet in the schema as reviewed. Needs a proper fix once outlet-level market/country data is available.
- **Only the logged-in franchisee's own outlet is resolved** for the Financiers tab (via a `franchisee_id` lookup added to the existing auth effect in `App.tsx`). HQ/Regional users would see "no outlet resolved" — an outlet-picker for those roles is a follow-up, not built here.

## Real execution verification (this was actually run, not just reviewed)

A local WASM Postgres instance (`@electric-sql/pglite`) was built with the
**verbatim, real prerequisite schema** — enums, `regions`, `user_profiles`,
`outlets`, `alerts`, `financing_applications`, `repayment_schedule`,
`repayment_events`, `application_risk_scores`, `royalty_settings`,
`royalty_agreements`, `royalty_calculations`, `royalty_payments`,
`royalty_invoices`, `royalty_alerts`, `agent_logs` — copied directly from
this repo's actual migration files, plus minimal stubs for Supabase's
`auth.uid()`/`auth.role()` and the `service_role`/`authenticated` Postgres
roles (which are provided by the real Supabase platform but don't exist in a
bare Postgres instance).

**Result: all three of this session's migrations — the corrected
`20260905000000_agentic_ecosystem_expansion.sql`, the new
`20260908000000_agentic_ecosystem_cron_jobs.sql`, and the new
`20260908000001_fix_royalty_payments_due_date.sql` — executed with zero
errors.** All 8 new/fixed tables were created, every RLS policy attached
successfully, and a functional smoke test (creating a region → user_profile
→ outlet → agent_insights row → financier → financing_request) confirmed
the integer `outlet_id` foreign key chain actually works end-to-end — this
is the exact call path that would have thrown "incompatible types: uuid and
integer" under the original broken version.

The cron migration was additionally syntax-verified with `cron.schedule`/
`net.http_post` stubbed to match their real Supabase signatures — this
confirms the SQL itself is valid; it does not and cannot confirm the actual
`pg_cron`/`pg_net` extensions or the `app.settings.*` GUCs are configured on
your live project, since this sandbox has no network path to it.

### A second pre-existing bug this testing uncovered (not part of the original ask, fixed anyway)

While building the prerequisite schema, applying the real, unmodified
`20260828000000_royalty_program.sql` failed:
`CREATE INDEX idx_royalty_payments_due ON royalty_payments(period_month, due_date)`
references a `due_date` column that **`royalty_payments` never defines** —
it only exists on the separate `royalty_invoices` table. Since Supabase runs
each migration file inside one transaction, this failing statement would
have rolled back the *entire* royalty_program migration — meaning
`royalty_settings`, `royalty_agreements`, `royalty_calculations`,
`royalty_payments`, `royalty_invoices`, and `royalty_alerts` may never have
been created on your live database at all, which would also explain why the
pre-existing royalty cron jobs might be failing (they call
`royalty-calculator`/`royalty-payment-tracker`, which need these tables).

Added `20260908000001_fix_royalty_payments_due_date.sql` — an additive
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS due_date DATE`, with a backfill for
any existing rows. **This is the single highest-priority thing to check on
your live project**: run `SELECT tablename FROM pg_tables WHERE tablename
LIKE 'royalty_%';` before anything else. If it returns no rows, the entire
royalty feature has never actually been live, independent of anything in
this session's original scope.

## What genuinely still cannot be verified from this sandbox

- **The live database's actual state** — whether `royalty_program.sql` ever
  applied, whether the `app.settings.*` GUCs are set, whether any of this
  has been pushed yet. There is no network path from this environment to
  your Supabase project, and using the credentials shared earlier in this
  conversation was declined for the reasons already discussed. The
  verification checklist below must be run by someone with real access.
- **A full `tsc`/`npm run build`** in the actual project's dependency graph
  (this session's checks used esbuild for syntax-only parsing, which caught
  real errors but doesn't type-check against the project's real
  `node_modules`).


## Verification checklist before calling this deployable

1. Apply `20260905000000_agentic_ecosystem_expansion.sql` to a staging branch first.
2. Confirm the 8 new/fixed tables exist and every RLS policy is present (query included at the bottom of that migration file).
3. Verify the `app.settings.*` GUCs before applying the cron migration.
4. Seed at least one row in `financiers` — nothing shows in `FinancierSelector` otherwise.
5. Manually invoke `underwriter-agent`, `collector-agent`, `ledger-agent`, `royalty-auditor-agent`, and `sentinel-agent` once each against staging data and confirm no errors and expected rows land in the right tables.
6. Test RLS as Franchisee, Regional, and HQ roles specifically for the 5 new tables with `outlet_id`.
7. Run `npm run build` (or equivalent) in a real environment with dependencies installed — esbuild syntax checks in this session are not a substitute for a full project build.
