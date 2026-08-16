# Data Retention Implementation Plan

**Date:** Aug 16, 2026
**Purpose:** Implement data retention system via pg_cron + Edge Function
**Approach:** pg_cron → Edge Function → reads settings table → deletes old records

---

## Scope

### Tables to Retain

| Table | Retention | Reason | Priority |
|-------|-----------|--------|----------|
| `ai_audit_log` | 365 days | Compliance audit trail | HIGH |
| `notification_logs` | 365 days | Notification history | MEDIUM |
| `sales_transactions` | 2555 days (7yr SG) / 1825 days (5yr ID) | Financial records | HIGH |
| `alerts` | 730 days (2yr) | Operational reference | MEDIUM |
| `cases` | 730 days (2yr) | Case history | MEDIUM |
| `ml_anomaly_scores` | 90 days | ML model data | LOW |
| `ml_scores` | 90 days | ML model data | LOW |
| `ml_predictions` | 90 days | ML model data | LOW |
| `repayment_events` | 1825 days (5yr) | Financial records | HIGH |
| `lender_webhook_events` | 365 days | API audit log | MEDIUM |
| `function_execution_logs` | 90 days | Debug logs | LOW |
| `ml_error_logs` | 90 days | ML error tracking | LOW |

### Tables to EXCLUDE (Permanent)

| Table | Reason |
|-------|--------|
| `regions`, `outlets`, `staff`, `inventory` | Master data — never delete |
| `settings`, `integrations` | Configuration — never delete |
| `user_profiles` | User accounts — handle via inactive policy |
| `financing_applications` | Loan records — compliance requirement |
| `repayment_schedule` | Loan records — compliance requirement |
| `knowledge_*` | SOPs, policies — permanent knowledge base |

---

## Implementation Files

### File 1: Migration — Retention Settings

**Path:** `supabase/migrations/20260816000000_retention_settings.sql`

```sql
-- ============================================================
-- Data Retention Settings
-- Default values for multi-country franchise retention
-- ============================================================

INSERT INTO public.settings (key, value, category, description, created_at, updated_at)
VALUES
  -- Financial data (SG=7yr, ID=5yr)
  ('retention_days_sales_transactions', '2555', 'finance', 'Sales transactions retention in days (default: 7 years for SG)', NOW(), NOW()),
  ('retention_days_repayment_events', '1825', 'finance', 'Repayment events retention in days (default: 5 years)', NOW(), NOW()),

  -- Operational data
  ('retention_days_alerts', '730', 'operations', 'Alerts retention in days (default: 2 years)', NOW(), NOW()),
  ('retention_days_cases', '730', 'operations', 'Cases retention in days (default: 2 years)', NOW(), NOW()),

  -- ML / Analytics
  ('retention_days_ml_anomaly_scores', '90', 'ml', 'ML anomaly scores retention in days', NOW(), NOW()),
  ('retention_days_ml_scores', '90', 'ml', 'ML scores retention in days', NOW(), NOW()),
  ('retention_days_ml_predictions', '90', 'ml', 'ML predictions retention in days', NOW(), NOW()),

  -- Compliance / Audit
  ('retention_days_ai_audit_log', '365', 'compliance', 'AI audit log retention in days (default: 1 year)', NOW(), NOW()),
  ('retention_days_notification_logs', '365', 'compliance', 'Notification logs retention in days', NOW(), NOW()),
  ('retention_days_lender_webhook_events', '365', 'compliance', 'Lender webhook events retention in days', NOW(), NOW()),
  ('retention_days_function_execution_logs', '90', 'operations', 'Function execution logs retention in days', NOW(), NOW()),
  ('retention_days_ml_error_logs', '90', 'ml', 'ML error logs retention in days', NOW(), NOW()),

  -- Retention policy toggle
  ('retention_enabled', 'true', 'general', 'Enable/disable automatic data retention cleanup', NOW(), NOW()),
  ('retention_dry_run', 'false', 'general', 'If true, count records but do not delete', NOW(), NOW())

ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
```

---

### File 2: Edge Function — retention-cleanup

**Path:** `supabase/functions/retention-cleanup/index.ts`

```typescript
// retention-cleanup/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RetentionConfig {
  table: string;
  retentionDays: number;
  idColumn?: string;
  dateColumn?: string;
  filterCondition?: string;
}

const RETENTION_TABLES: RetentionConfig[] = [
  // Financial data
  { table: "sales_transactions", retentionDays: 2555, dateColumn: "created_at" },
  { table: "repayment_events", retentionDays: 1825, dateColumn: "created_at" },

  // Operational data
  { table: "alerts", retentionDays: 730, dateColumn: "created_at" },
  { table: "cases", retentionDays: 730, dateColumn: "created_at" },

  // ML / Analytics
  { table: "ml_anomaly_scores", retentionDays: 90, dateColumn: "created_at" },
  { table: "ml_scores", retentionDays: 90, dateColumn: "created_at" },
  { table: "ml_predictions", retentionDays: 90, dateColumn: "created_at" },

  // Compliance / Audit
  { table: "ai_audit_log", retentionDays: 365, dateColumn: "created_at" },
  { table: "notification_logs", retentionDays: 365, dateColumn: "created_at" },
  { table: "lender_webhook_events", retentionDays: 365, dateColumn: "created_at" },

  // Logs
  { table: "function_execution_logs", retentionDays: 90, dateColumn: "created_at" },
  { table: "ml_error_logs", retentionDays: 90, dateColumn: "created_at" },
];

async function getSetting(supabase: any, key: string, fallback: string): Promise<string> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? fallback;
}

async function getRetentionDays(supabase: any, table: string): Promise<number> {
  const keyMap: Record<string, string> = {
    sales_transactions: "retention_days_sales_transactions",
    repayment_events: "retention_days_repayment_events",
    alerts: "retention_days_alerts",
    cases: "retention_days_cases",
    ml_anomaly_scores: "retention_days_ml_anomaly_scores",
    ml_scores: "retention_days_ml_scores",
    ml_predictions: "retention_days_ml_predictions",
    ai_audit_log: "retention_days_ai_audit_log",
    notification_logs: "retention_days_notification_logs",
    lender_webhook_events: "retention_days_lender_webhook_events",
    function_execution_logs: "retention_days_function_execution_logs",
    ml_error_logs: "retention_days_ml_error_logs",
  };

  const settingKey = keyMap[table];
  if (!settingKey) return 365; // default fallback

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", settingKey)
    .single();

  return data ? parseInt(data.value) : 365;
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if retention is enabled
  const enabled = await getSetting(supabase, "retention_enabled", "true");
  const dryRun = await getSetting(supabase, "retention_dry_run", "false");

  if (enabled !== "true") {
    return Response.json({ success: true, message: "Retention cleanup is disabled" });
  }

  const results: any[] = [];
  const startTime = Date.now();
  let totalDeleted = 0;

  for (const config of RETENTION_TABLES) {
    try {
      const retentionDays = await getRetentionDays(supabase, config.table);
      const cutoffDate = new Date(Date.now() - retentionDays * 86400000);
      const cutoffStr = cutoffDate.toISOString();

      // Count before delete
      const { count: beforeCount } = await supabase
        .from(config.table)
        .select("*", { count: "exact", head: true })
        .lt(config.dateColumn || "created_at", cutoffStr);

      if (beforeCount === 0) {
        results.push({
          table: config.table,
          status: "skipped",
          reason: "no records to delete",
          retention_days: retentionDays,
        });
        continue;
      }

      if (dryRun === "true") {
        // Dry run — count only, no delete
        results.push({
          table: config.table,
          status: "dry_run",
          retention_days: retentionDays,
          cutoff_date: cutoffStr,
          would_delete: beforeCount,
        });
      } else {
        // Actual delete
        const { count: deletedCount, error } = await supabase
          .from(config.table)
          .delete()
          .lt(config.dateColumn || "created_at", cutoffStr);

        if (error) {
          results.push({
            table: config.table,
            status: "error",
            error: error.message,
            retention_days: retentionDays,
          });
        } else {
          results.push({
            table: config.table,
            status: "success",
            deleted: deletedCount || 0,
            retention_days: retentionDays,
            cutoff_date: cutoffStr,
          });
          totalDeleted += deletedCount || 0;
        }
      }
    } catch (err: any) {
      results.push({
        table: config.table,
        status: "error",
        error: err.message,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  // Log the cleanup run
  await supabase.from("ai_audit_log").insert({
    action: "retention_cleanup",
    details: JSON.stringify({
      duration_ms: durationMs,
      total_deleted: totalDeleted,
      dry_run: dryRun === "true",
      results,
    }),
    user_id: null, // system action
  });

  return Response.json({
    success: true,
    dry_run: dryRun === "true",
    executed_at: new Date().toISOString(),
    duration_ms: durationMs,
    total_deleted: totalDeleted,
    results,
  });
});
```

---

### File 3: Migration — pg_cron Registration

**Path:** `supabase/migrations/20260816000001_register_retention_cron.sql`

```sql
-- ============================================================
-- Register retention-cleanup cron job
-- Runs daily at 2 AM
-- ============================================================

SELECT cron.schedule(
  'retention-cleanup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url=>'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/retention-cleanup',
    headers=>'{"Authorization": "Bearer ' || current_setting('app.settings_service_role_key', true) || '"}'
  );
  $$
);

-- Verify registration
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'retention-cleanup';
```

---

### File 4: Migration — RLS Policy for Retention Logs

**Path:** `supabase/migrations/20260816000002_retention_rls.sql`

```sql
-- Retention cleanup needs service role access (no RLS needed for system job)
-- But add a view for HQ admins to see retention status

CREATE OR REPLACE VIEW public.v_retention_status AS
SELECT
  key,
  value AS retention_days,
  category,
  description,
  updated_at
FROM public.settings
WHERE key LIKE 'retention_days_%'
   OR key IN ('retention_enabled', 'retention_dry_run');

-- Grant access to HQ admins
GRANT SELECT ON public.v_retention_status TO authenticated;
```

---

## Files to Create

| # | File | Type |
|---|------|------|
| 1 | `supabase/migrations/20260816000000_retention_settings.sql` | Migration |
| 2 | `supabase/functions/retention-cleanup/index.ts` | Edge Function |
| 3 | `supabase/migrations/20260816000001_register_retention_cron.sql` | Migration |
| 4 | `supabase/migrations/20260816000002_retention_rls.sql` | Migration |

---

## Steps to Implement

```
Step 1: Create migration — retention_settings.sql
         └─ Inserts default retention values into settings table

Step 2: Create edge function — retention-cleanup/index.ts
         └─ Reads settings → deletes old records → logs to ai_audit_log

Step 3: Create migration — register_retention_cron.sql
         └─ Registers pg_cron job (daily 2 AM)

Step 4: Create migration — retention_rls.sql
         └─ Creates v_retention_status view for HQ admins

Step 5: Deploy edge function
         └─ supabase functions deploy retention-cleanup

Step 6: Push migrations to Supabase
         └─ supabase db push

Step 7: Verify cron registration
         └─ SELECT * FROM cron.job WHERE jobname = 'retention-cleanup';

Step 8: Test dry run
         └─ UPDATE settings SET value = 'true' WHERE key = 'retention_dry_run';
         └─ Invoke edge function manually
         └─ Check ai_audit_log for cleanup results
```

---

## Verification

### Check settings populated
```sql
SELECT key, value, category FROM settings
WHERE key LIKE 'retention_%' ORDER BY category, key;
```

### Check cron registered
```sql
SELECT jobname, schedule, active FROM cron.job
WHERE jobname = 'retention-cleanup';
```

### Dry run test
```bash
curl -X POST "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/retention-cleanup" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

### Check cleanup log
```sql
SELECT action, details, created_at FROM ai_audit_log
WHERE action = 'retention_cleanup'
ORDER BY created_at DESC LIMIT 5;
```

### Disable temporarily
```sql
UPDATE settings SET value = 'false' WHERE key = 'retention_enabled';
```

---

## Effort

| Task | Time |
|------|------|
| Create migration + settings | 15 min |
| Create edge function | 1 hour |
| Create cron registration | 15 min |
| Deploy + verify | 30 min |
| **Total** | **~2 hours** |

---

## Admin UI (Future Enhancement)

```tsx
// Settings > Data Management
// Shows v_retention_status view
// Buttons: [Run Cleanup Now] [Dry Run] [Save]

const RetentionSettings = () => {
  const [settings, setSettings] = useState([]);
  const [running, setRunning] = useState(false);

  const handleRun = async (dryRun: boolean) => {
    setRunning(true);
    await fetch('/functions/v1/retention-cleanup', { method: 'POST' });
    setRunning(false);
  };

  return (
    <div>
      <h2>Data Retention Policy</h2>
      <table>
        <thead>
          <tr>
            <th>Table</th>
            <th>Retention (days)</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {settings.map(s => (
            <tr key={s.key}>
              <td>{s.key.replace('retention_days_', '')}</td>
              <td>
                <input
                  defaultValue={s.retention_days}
                  onBlur={e => saveSetting(s.key, e.target.value)}
                />
              </td>
              <td>{s.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => handleRun(true)} disabled={running}>Dry Run</button>
      <button onClick={() => handleRun(false)} disabled={running}>Run Now</button>
    </div>
  );
};
```

---

## Rollback

```sql
-- Disable cron
SELECT cron.unschedule('retention-cleanup');

-- Delete retention settings
DELETE FROM settings WHERE key LIKE 'retention_%';

-- Delete view
DROP VIEW IF EXISTS public.v_retention_status;
```

---

## Priority

**HIGH** — Compliance requirement. Recommend implementing before production launch.
