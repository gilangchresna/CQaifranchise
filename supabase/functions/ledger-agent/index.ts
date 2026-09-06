// Ledger: royalty reconciliation
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    await logAgentRun(supabase, "ledger", { status: "no_data" });
    return new Response(JSON.stringify({ 
      success: true,
      message: "Ledger agent - royalty monitoring",
      insights_created: 0
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
