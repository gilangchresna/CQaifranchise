# Verifying RLS matches migration 032

This repo's migration history repeatedly enabled/disabled Row Level Security
before landing on the real per-tenant policy set in the migration formerly
named `032_fix_rls.sql` (now `20260713210800_fix_rls.sql` - see
`supabase/migrations/RENAME_MAP.md`).

**Update:** tracing every `ALTER TABLE ... ENABLE/DISABLE ROW LEVEL SECURITY`
statement across the full migration history in true apply order turned up a
concrete bug, not just historical churn: `sales_transactions` and
`pilot_outreach` were disabled by the temporary "fix" migrations and never
re-enabled afterwards, and `ai_explanations`, `ml_model_versions`, and
`webhook_secrets` were disabled early on and never re-enabled either -
meaning the policies later written for these tables (in `016_final_rls_fix`
and `032_fix_rls`) have never actually been enforced. A handful of other
tables (`outlet_classifications`, `peer_metrics`, `peer_snapshots`,
`approval_requests`, `approval_history`, `approval_rules`, and several
ML/ops logging tables) never had RLS enabled at all. A new migration,
`20260801000000_enable_missing_rls.sql`, fixes all of these - it enables RLS
on the tables that already had policies (activating the existing policies),
and enables RLS with a service-role-only policy on the tables that had none
(locking them down by default rather than leaving them open). **This trace
was done by replaying the migration files textually - it has not been
confirmed against the actual live database state**, so step 2 below still
needs to be run for real. Two
migrations that temporarily disabled RLS (`003_disable_rls.sql`,
`disable_rls_inventory.sql`) have been deleted from this repo now that `032`
is authoritative — but that only fixes the *migration files*. It does not by
itself confirm what's actually active on the live database, since migrations
already applied to a running Supabase project aren't automatically re-run.

I don't have credentials/access to the live Supabase project (`ploqeifazcgzwjzmukgp`,
per `supabase/.temp/project-ref`), so this has to be checked manually. Run the
following before considering this item closed:

## 1. Confirm which migrations have actually been applied

```bash
supabase link --project-ref ploqeifazcgzwjzmukgp
supabase migration list
```

Compare the "Remote" column against the files in `supabase/migrations/`. If
`032_fix_rls.sql` is not listed as applied remotely, push it:

```bash
supabase db push
```

## 2. Confirm RLS is actually enabled on every sensitive table

Run in the Supabase SQL editor (or `supabase db execute`):

```sql
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in (
  'outlets', 'sales_transactions', 'alerts', 'notifications',
  'inventory', 'cases', 'user_profiles', 'regions',
  'notification_logs', 'sla_escalation_runs'
)
order by relname;
```

Every row should show `rls_enabled = true`. If any show `false`, RLS was
disabled at some point (e.g. by the now-deleted migrations, or manually in
the dashboard) and never re-enabled — run `ALTER TABLE public.<name> ENABLE
ROW LEVEL SECURITY;` for each.

## 3. Confirm the policies in place match 032, not an older/looser version

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Compare against the `CREATE POLICY` statements in `032_fix_rls.sql`. Watch
specifically for leftover permissive policies from earlier migrations that
032 was supposed to drop (e.g. `"Authenticated can view sales"` with
`USING (true)` from `006_production_rls.sql`, or `"Allow read cases
authenticated"` from `017_fix_cases_rls.sql`) — `032` issues `DROP POLICY IF
EXISTS` for the ones it knows about, but if any table picked up a permissive
policy under a name not covered by those `DROP` statements, it will still be
in effect and silently override the tighter 032 policies (Postgres RLS is
permissive-by-default: if *any* matching policy allows the row, it's
allowed).

## 4. Re-run this after any manual dashboard changes

Anyone with dashboard access can toggle RLS or add/drop policies outside of
the migration history entirely. Since this project has already drifted from
its migrations at least twice (temporary disables, ad-hoc "fix" migrations),
it's worth re-running steps 2–3 periodically, not just once.
