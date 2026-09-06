# Migration rename map (2026-08-01 cleanup)

The original `supabase/migrations/` files used plain sequential numeric
prefixes (`001_`, `002_`, ...), and several numbers were reused for unrelated
migrations written days apart (e.g. `002_fix_rls.sql` from 2026-07-13 and
`002_knowledge_base.sql` from 2026-07-23 both used prefix `002`). Supabase's
own migration tooling expects unique, sortable filenames (its own `supabase
migration new` generates `YYYYMMDDHHMMSS_name.sql`), so this renumbers every
file to that format.

**Important: this rename preserves the exact same apply order the project
already had** (current lexical/alphabetical order of the old filenames -
which is what `supabase db push`/`supabase migration list` was already
using). Nothing was reordered relative to itself; only the naming scheme
changed, to remove the duplicate-prefix ambiguity. The new timestamps are
therefore **synthetic sequence markers, one minute apart, starting from the
project's actual first migration's real timestamp** - they are not literal
per-file creation times. The real original file timestamps (from the
project's own history) are recorded below for reference.

## If any of these migrations are already applied on a live Supabase project

Supabase tracks applied migrations by filename/version in a
`supabase_migrations.schema_migrations` table on the remote database.
Renaming already-applied files means the CLI will think these are new,
unapplied migrations on the next `supabase db push` - which would try to
re-run non-idempotent statements (`CREATE TABLE` without `IF NOT EXISTS`,
seed `INSERT`s, etc.) and likely fail or double-apply data.

**Before pushing anything with this new migration history**, reconcile the
remote project's migration history to match the new filenames:

```bash
supabase link --project-ref ploqeifazcgzwjzmukgp

# For every migration below that is already applied on the live project,
# mark its NEW version as applied (using the new file's timestamp prefix):
supabase migration repair --status applied 20260713204100
supabase migration repair --status applied 20260713204200
# ...repeat for each new prefix that corresponds to a migration already live.
# (Or reverse: --status reverted for any that were never actually applied.)

supabase migration list   # confirm remote and local are back in sync
```

There is no way to determine from the repo alone which of these were already
applied to the live project - that has to be checked in the Supabase
dashboard (Database -> Migrations) or via `supabase migration list` while
linked, before running `repair`.

## Full rename map

| Old filename | New filename | Real original file date |
|---|---|---|
| `001_initial_schema.sql` | `20260713204100_initial_schema.sql` | 2026-07-13 20:41:00 |
| `002_fix_rls.sql` | `20260713204200_fix_rls.sql` | 2026-07-13 21:20:00 |
| `002_knowledge_base.sql` | `20260713204300_knowledge_base.sql` | 2026-07-23 22:42:00 |
| `003_create_ml_predictions.sql` | `20260713204400_create_ml_predictions.sql` | 2026-07-24 23:02:00 |
| `003_peer_benchmarking.sql` | `20260713204500_peer_benchmarking.sql` | 2026-07-24 07:29:00 |
| `004_add_pos_fields.sql` | `20260713204600_add_pos_fields.sql` | 2026-07-24 23:23:00 |
| `004_approval_workflows.sql` | `20260713204700_approval_workflows.sql` | 2026-07-24 08:15:00 |
| `004_disable_user_rls.sql` | `20260713204800_disable_user_rls.sql` | 2026-07-13 21:44:00 |
| `005_ml_feature_store.sql` | `20260713204900_ml_feature_store.sql` | 2026-07-24 10:59:00 |
| `005_pos_webhook_fields.sql` | `20260713205000_pos_webhook_fields.sql` | 2026-07-25 07:51:00 |
| `005_remove_auth_fk.sql` | `20260713205100_remove_auth_fk.sql` | 2026-07-13 21:44:00 |
| `006_production_rls.sql` | `20260713205200_production_rls.sql` | 2026-07-13 22:05:00 |
| `007_temp_user_rls.sql` | `20260713205300_temp_user_rls.sql` | 2026-07-13 22:06:00 |
| `008_final_rls.sql` | `20260713205400_final_rls.sql` | 2026-07-13 22:06:00 |
| `009_temp_rls.sql` | `20260713205500_temp_rls.sql` | 2026-07-13 22:11:00 |
| `010_final_rls.sql` | `20260713205600_final_rls.sql` | 2026-07-13 22:12:00 |
| `011_add_pilot_status.sql` | `20260713205700_add_pilot_status.sql` | 2026-07-13 22:15:00 |
| `013_fix_rls.sql` | `20260713205800_fix_rls.sql` | 2026-07-14 00:04:00 |
| `014_cleanup.sql` | `20260713205900_cleanup.sql` | 2026-07-14 00:04:00 |
| `015_fix_rls_auth.sql` | `20260713210000_fix_rls_auth.sql` | 2026-07-14 11:19:00 |
| `016_final_rls_fix.sql` | `20260713210100_final_rls_fix.sql` | 2026-07-14 11:21:00 |
| `017_fix_cases_rls.sql` | `20260713210200_fix_cases_rls.sql` | 2026-07-14 16:37:00 |
| `017_seed_inventory_local.sql` | `20260713210300_seed_inventory_local.sql` | 2026-07-14 16:29:00 |
| `018_seed_sales_transactions.sql` | `20260713210400_seed_sales_transactions.sql` | 2026-07-14 20:21:00 |
| `029_create_integrations.sql` | `20260713210500_create_integrations.sql` | 2026-07-16 12:23:00 |
| `030_setup_cron_jobs.sql` | `20260713210600_setup_cron_jobs.sql` | 2026-07-16 20:01:00 |
| `031_fix_p0_bugs.sql` | `20260713210700_fix_p0_bugs.sql` | 2026-07-16 12:54:00 |
| `032_fix_rls.sql` | `20260713210800_fix_rls.sql` | 2026-07-16 20:01:00 |
| `033_ml_scores_table.sql` | `20260713210900_ml_scores_table.sql` | 2026-07-16 20:11:00 |
| `034_ml_batch_cron.sql` | `20260713211000_ml_batch_cron.sql` | 2026-07-16 20:13:00 |
| `035_ml_scores_views.sql` | `20260713211100_ml_scores_views.sql` | 2026-07-16 20:14:00 |
| `040_monitoring_views.sql` | `20260713211200_monitoring_views.sql` | 2026-07-17 09:32:00 |
| `041_monitoring_metrics.sql` | `20260713211300_monitoring_metrics.sql` | 2026-07-17 09:33:00 |
| `042_alert_thresholds.sql` | `20260713211400_alert_thresholds.sql` | 2026-07-17 09:33:00 |
