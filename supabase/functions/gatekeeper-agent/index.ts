// Gatekeeper: monitors POS/lender webhook and connector health
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const STALE_MINUTES_THRESHOLD = 30;

serve(async (req) => {
  try {
    // Gatekeeper checks data freshness by looking at recent transactions
    // If no transactions received in threshold time, flag as stale
    
    const { data: recentTxns } = await supabase
      .from("sales_transactions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastTxn = recentTxns?.[0];
    const minutesSinceLastTxn = lastTxn 
      ? Math.floor((Date.now() - new Date(lastTxn.created_at).getTime()) / (1000 * 60))
      : null;

    if (minutesSinceLastTxn !== null && minutesSinceLastTxn > STALE_MINUTES_THRESHOLD) {
      await createInsight(supabase, {
        agentName: "gatekeeper",
        module: "Integrations",
        outletId: null,
        category: "connector_stale",
        severity: minutesSinceLastTxn > STALE_MINUTES_THRESHOLD * 2 ? "high" : "medium",
        title: `POS data stale: ${minutesSinceLastTxn} minutes since last transaction`,
        details: `No transactions received in ${minutesSinceLastTxn} minutes. Check POS webhook connectivity.`,
      });
    }

    await logAgentRun(supabase, "gatekeeper", { minutes_since_last_txn: minutesSinceLastTxn });

    return new Response(JSON.stringify({ 
      success: true,
      minutes_since_last_txn: minutesSinceLastTxn,
      status: minutesSinceLastTxn === null || minutesSinceLastTxn > STALE_MINUTES_THRESHOLD ? "warning" : "ok"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gatekeeper error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
