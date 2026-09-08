// supabase/functions/_shared/agentInsights.ts
// Shared helpers for agent insights and logging

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey);
}

export interface InsightInput {
  agentName: string;
  module: string;
  outletId?: string | null;
  category: string;
  severity: "low" | "medium" | "high";
  title: string;
  details?: string;
  payload?: Record<string, unknown>;
}

export async function createInsight(supabase: SupabaseClient, input: InsightInput) {
  // Write to agent_insights
  const { error: insightError } = await supabase.from("agent_insights").insert({
    agent_name: input.agentName,
    module: input.module,
    outlet_id: input.outletId ?? null,
    category: input.category,
    severity: input.severity,
    title: input.title,
    details: input.details ?? null,
    payload: input.payload ?? {},
  });
  if (insightError) console.error("agent_insights insert error:", insightError.message);

  // Also write to alerts table for Dashboard UI (only if outletId exists)
  if (input.outletId) {
    const outletIdNum = parseInt(input.outletId);
    if (!isNaN(outletIdNum)) {
      const { error: alertError } = await supabase.from("alerts").insert({
        outlet_id: outletIdNum,
        // FIXED: alerts.type is a fixed Postgres enum (SALES_ANOMALY, STOCKOUT_RISK,
        // ATTENDANCE_ISSUE, COMPLAINT, SYSTEM) — the arbitrary agent `category` strings
        // (e.g. "staffing_shortfall_risk", "connector_stale") are not valid enum values
        // and would fail every insert. Map to the closest valid enum value instead.
        type: mapCategoryToAlertType(input.category),
        severity: input.severity === "high" ? "P1_HIGH" : input.severity === "medium" ? "P2_MEDIUM" : "P3_LOW",
        title: `[${input.agentName}] ${input.title}`,
        description: input.details ?? null,
        status: "NEW",
        triggered_at: new Date().toISOString(),
      });
      if (alertError) console.error("alerts insert error:", alertError.message);
    }
  }
}

// Maps an agent's free-text category onto the fixed alert_type enum
// (SALES_ANOMALY | STOCKOUT_RISK | ATTENDANCE_ISSUE | COMPLAINT | SYSTEM).
function mapCategoryToAlertType(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("stockout")) return "STOCKOUT_RISK";
  if (c.includes("complaint")) return "COMPLAINT";
  if (c.includes("staffing") || c.includes("shift") || c.includes("attendance") || c.includes("no_show")) {
    return "ATTENDANCE_ISSUE";
  }
  if (c.includes("sales") || c.includes("variance") || c.includes("anomaly") || c.includes("rate_mismatch")) {
    return "SALES_ANOMALY";
  }
  return "SYSTEM"; // connector/schema/access/peer/financing/knowledge-base categories fall back here
}

export async function logAgentRun(
  supabase: SupabaseClient,
  agentName: string,
  metadata: Record<string, unknown>
) {
  // Write to agent_logs (main log table)
  await supabase.from("agent_logs").insert({
    agent_id: agentName,
    log_level: "info",
    message: `${agentName} agent completed`,
    metadata,
    source: "agent",
  });
  
  // Also write to audit_log for compliance
  await supabase.from("audit_log").insert({
    action: `${agentName}.run`,
    entity_type: "agent",
    entity_id: agentName,
    user_id: "system",
    metadata,
  });
}
