// Shift: monitors staffing levels and flags short-staffed outlets
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const MIN_STAFF_THRESHOLD = 2;

serve(async (req) => {
  try {
    // Check recent outlet activity as proxy for staffing
    const today = new Date().toISOString().split('T')[0];
    
    const { data: outlets } = await supabase
      .from("outlets")
      .select("id, name, code")
      .eq("status", "active");

    const flagged: any[] = [];
    
    // Check transactions per outlet today as staffing proxy
    const { data: txns } = await supabase
      .from("sales_transactions")
      .select("outlet_id, transaction_count")
      .gte("date", today);

    const txnByOutlet: Record<number, number> = {};
    for (const t of txns ?? []) {
      txnByOutlet[t.outlet_id] = (txnByOutlet[t.outlet_id] || 0) + (t.transaction_count || 1);
    }

    // Flag outlets with low transaction volume (potential understaffing)
    for (const outlet of outlets ?? []) {
      const txnCount = txnByOutlet[outlet.id] || 0;
      if (txnCount > 0 && txnCount < 10) {
        await createInsight(supabase, {
          agentName: "shift",
          module: "Workforce",
          outletId: outlet.id,
          category: "low_transaction_volume",
          severity: "low",
          title: `Low activity: ${txnCount} transactions today`,
          details: `Outlet ${outlet.name} (${outlet.code}) may be understaffed. Only ${txnCount} transactions recorded today.`,
        });
        flagged.push(outlet.id);
      }
    }

    await logAgentRun(supabase, "shift", { outlets_checked: outlets?.length ?? 0, flagged: flagged.length });

    return new Response(JSON.stringify({ 
      success: true,
      outlets_checked: outlets?.length ?? 0,
      flagged: flagged.length
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Shift agent error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
