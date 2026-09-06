// Coach: workforce coaching and training reminders
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    await logAgentRun(supabase, "coach", { status: "no_data" });
    return new Response(JSON.stringify({ 
      success: true,
      message: "Coach agent - no training data available yet",
      insights_created: 0
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
