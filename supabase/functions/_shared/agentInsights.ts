// supabase/functions/_shared/agentInsights.ts
//
// Shared helper for any agent writing into the generic `agent_insights` table.
// Import with a relative path from each agent's index.ts, e.g.:
//   import { createInsight, logAgentRun } from "../_shared/agentInsights.ts";

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
  await supabase.from("audit_log").insert({
    action: `${agentName}.run`,
    entity_type: "agent",
    entity_id: agentName,
    metadata,
  });
}
