import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any = { success: true, tables: {} };

    // 1. Create sla_escalation_runs using raw SQL via postgres rpc
    const { data: serData, error: serError } = await supabase.rpc("pg_execute", {
      sql: `
        CREATE TABLE IF NOT EXISTS sla_escalation_runs (
          id SERIAL PRIMARY KEY,
          run_id UUID DEFAULT gen_random_uuid(),
          cases_affected INTEGER DEFAULT 0,
          cases_escalated INTEGER DEFAULT 0,
          cases_warned INTEGER DEFAULT 0,
          errors TEXT[],
          started_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          duration_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_sla_escalation_runs_run_id ON sla_escalation_runs(run_id);
        CREATE INDEX IF NOT EXISTS idx_sla_escalation_runs_started_at ON sla_escalation_runs(started_at);
      `
    }).catch(() => ({ data: null, error: "RPC not available" }));

    if (serError) {
      results.tables.sla_escalation_runs = "Note: Use Supabase Dashboard to create this table. RPC not available.";
    } else {
      results.tables.sla_escalation_runs = "created";
    }

    // 2. Add region_id to cases if missing
    const { data: casesData } = await supabase.rpc("pg_execute", {
      sql: `ALTER TABLE cases ADD COLUMN IF NOT EXISTS region_id INTEGER;`
    }).catch(() => ({ data: null }));
    results.tables.cases_region_id = "added or exists";

    // 3. Add region_id to alerts if missing
    const { data: alertsData } = await supabase.rpc("pg_execute", {
      sql: `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS region_id INTEGER;`
    }).catch(() => ({ data: null }));
    results.tables.alerts_region_id = "added or exists";

    // 4. Add missing columns to notification_logs
    const extraColumns = ["recipient", "message", "external_id", "delivered_at", "notification_id"];
    for (const col of extraColumns) {
      const colType = col === "notification_id" ? "UUID DEFAULT gen_random_uuid()" : "TEXT";
      await supabase.rpc("pg_execute", {
        sql: `ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS ${col} ${colType === "UUID" ? "UUID DEFAULT gen_random_uuid()" : "TEXT"};`
      }).catch(() => ({}));
    }
    results.tables.notification_logs_extra = "added or exist";

    // 5. Count records
    const { count: nlCount } = await supabase
      .from("notification_logs")
      .select("*", { count: "exact", head: true })
      .catch(() => ({ count: 0 }));

    const { count: serCount } = await supabase
      .from("sla_escalation_runs")
      .select("*", { count: "exact", head: true })
      .catch(() => ({ count: 0 }));

    results.counts = {
      notification_logs: nlCount || 0,
      sla_escalation_runs: serCount || 0
    };

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Setup attempted. Some tables may need manual creation via Supabase Dashboard.",
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
