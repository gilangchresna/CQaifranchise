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
  const { error } = await supabase.from("agent_insights").insert({
    agent_name: input.agentName,
    module: input.module,
    outlet_id: input.outletId ?? null,
    category: input.category,
    severity: input.severity,
    title: input.title,
    details: input.details ?? null,
    payload: input.payload ?? {},
  });
  if (error) throw error;
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
