# Changelog: priority fixes (2026-08-01)

Work done against the priority order agreed after the initial code review.
Five commits on top of the original history (`git log` for full messages/diffs).

## 1. Locked down unauthenticated admin/seed edge functions

25 functions used the service-role key (bypasses RLS) with no caller check
at all: `clear-data`, `cleanup-transactions`, `debug-db`, `apply-migration`,
`fix-rls`, `apply-rls-fix`, `check-data`, `qa-fix-final`,
`fix-inventory-rls`, `fix-missing-tables`, `seed-data`, and 13 other
`seed-*` functions. Each now requires a valid session (`verifyAuth`) and
`HQ_ADMIN` role (`isAtLeastRole`) before doing anything, using the
`_shared/auth.ts` helper that already existed but was never wired up
anywhere in the codebase.

Verified all 25 patched files parse cleanly (esbuild, brace-balance check).
One pre-existing, unrelated bug was found in the process: `apply-migration/
index.ts` has a broken escaped-quote string literal in its SQL (predates
this change) that would have made the whole function fail to load in Deno
regardless of the auth fix. Left as-is and flagged here rather than
guessing at the intended fix.

**You still need to:** redeploy these 25 functions to Supabase
(`supabase functions deploy <name>` for each, or all at once), since editing
the source here doesn't touch what's currently live.

## 2. RLS migrations

Deleted `003_disable_rls.sql` and `disable_rls_inventory.sql` (both
explicitly disabled RLS "for testing"/"for development" and were
superseded once the real RBAC policy landed).

While verifying this was safe, traced every `ENABLE/DISABLE ROW LEVEL
SECURITY` statement across the *entire* migration history in true apply
order (not just the two obviously-named ones) and found a real, previously
undetected bug: `sales_transactions`, `pilot_outreach`, `ai_explanations`,
`ml_model_versions`, and `webhook_secrets` were disabled by earlier
"temporary" migrations and **never re-enabled** - meaning the RBAC
policies written for them later have never actually been enforced. A
further 14 tables (`approval_requests`, `peer_metrics`,
`outlet_classifications`, and various ML/ops logging tables) never had RLS
enabled at all, ever. New migration `20260801000000_enable_missing_rls.sql`
fixes both.

**Caveat:** this was determined by statically replaying the migration
*files* - I have no credentials for the live Supabase project
(`ploqeifazcgzwjzmukgp`) to confirm this matches reality. `supabase/
RLS_VERIFICATION.md` has the exact commands to check the live database and
push this fix.

## 3. Repo hygiene

Removed the `{backend/...}` junk directory tree (~1,658 stray directories
from an unexpanded shell brace-expansion command, committed to git along
with their own `.DS_Store` files). Removed tracked `.DS_Store` and `dist/`
build output from git. `.gitignore` now also covers `.DS_Store`, `dist`,
`.env*`, and `supabase/.temp`.

## 4. Makefile / README / config drift (backend left as-is per your call)

Fixed `Makefile` frontend targets to point at the repo root instead of the
nonexistent `frontend/web/`; added guards so `deploy-staging`/`deploy-prod`/
`infra-init`/`infra-plan` fail with a clear message instead of a cryptic
`cd: no such directory` (since `infra/terraform/...` doesn't exist in this
repo at all); flagged the missing frontend `test`/`format` npm scripts and
missing frontend Dockerfile instead of pretending they work. Fixed the
README quick-start (was pointing at `~/CyberquoteWeb/unified-ai-CQ` on port
5173 - a different repo/port than what's actually configured). Fixed
`supabase/config.toml`'s `project_id` (was still `unified-ai-CQ`).

Also found and restored: `docs/` (36 files) existed in git history but was
missing from the working copy you gave me, which is why my original review
said it "didn't exist" - that was wrong. Restored via `git checkout --
docs/` per your answer; all 5 files the README links to are present again.

The FastAPI `backend/` + `docker-compose.yml` stack was left untouched, per
your decision to defer that call.

## 5. Migration renumbering + CI

Renamed all 34 migrations from duplicate-prone `NNN_name.sql` prefixes to
unique `YYYYMMDDHHMMSS_name.sql`, preserving the *exact* apply order the
project already had (see `supabase/migrations/RENAME_MAP.md` for the full
old-name/new-name/real-original-date mapping, plus `supabase migration
repair` instructions - renaming already-applied migrations requires
reconciling Supabase's remote migration-history table, which I can't do
without live access).

Added `.github/workflows/ci.yml`: runs the existing Deno tests in `tests/`
(previously never wired into CI anywhere), the frontend `tsc --noEmit`
check, and a guard that fails any future PR introducing a duplicate
migration prefix.

## Not done / needs your input

- **Redeploy the 25 patched edge functions** (see item 1) - editing source
  here has no effect on the live Supabase project.
- **Run the live-DB verification** in `supabase/RLS_VERIFICATION.md` and
  push `20260801000000_enable_missing_rls.sql`.
- **Reconcile migration history** with `supabase migration repair` per
  `supabase/migrations/RENAME_MAP.md` before your next `supabase db push`.
- The broader finding from the original review that ~50 *other* edge
  functions (alerts-list, dashboard-stats, cases-list, etc.) also use the
  service-role key without calling `verifyAuth` was **not** addressed here -
  that was out of scope for the agreed priority list (those looked like
  normal app endpoints, not admin/ops tooling, and blanket-gating them risks
  breaking real user flows without knowing each one's intended access
  rules). Worth a dedicated pass.
- `apply-migration/index.ts`'s pre-existing broken SQL string (item 1) is
  still broken - needs someone who knows the intended column-add logic to
  fix it.
- Old "Weskonek"/"unified-ai-CQ" name remnants still exist in a few static
  planning docs under `docs/` (not touched - historical documents, not live
  config).
