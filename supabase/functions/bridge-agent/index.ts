// Bridge Agent: Integration connectivity monitoring
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const STALE_THRESHOLD_MINUTES = 60;

serve(async (req) => {
  try {
    const insights: any[] = [];

    // 1. Check sales_transactions for data freshness
    const { data: latestTxn } = await supabase
      .from("sales_transactions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestTxn && latestTxn[0]) {
      const lastTxnTime = new Date(latestTxn[0].created_at).getTime();
      const minutesSince = Math.floor((Date.now() - lastTxnTime) / (1000 * 60));
      
      if (minutesSince > STALE_THRESHOLD_MINUTES) {
        await createInsight(supabase, {
          agentName: "bridge",
          module: "Integrations",
          outletId: null,
          category: "pos_stale",
          severity: minutesSince > 240 ? "high" : "medium",
          title: `POS data stale: ${minutesSince} minutes`,
          details: `Last transaction ${minutesSince} minutes ago. Check POS webhook connectivity.`,
        });
        insights.push({ type: "pos_stale", minutes: minutesSince });
      }
    } else {
      // No transactions at all - might be first day or integration broken
      await createInsight(supabase, {
        agentName: "bridge",
        module: "Integrations",
        outletId: null,
        category: "no_transactions",
        severity: "low",
        title: "No transactions received",
        details: "No sales_transactions records found. Verify POS integration is active.",
      });
    }

    // 2. Check for webhook endpoint health (via audit_log)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: webhookLogs } = await supabase
      .from("audit_log")
      .select("action, metadata, created_at")
      .ilike("action", "%webhook%")
      .gte("created_at", hourAgo);

    if (!webhookLogs || webhookLogs.length === 0) {
      // Check if any POS integration is configured
      const { count: txnCount } = await supabase
        .from("sales_transactions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", hourAgo);

      if (!txnCount || txnCount === 0) {
        await createInsight(supabase, {
          agentName: "bridge",
          module: "Integrations",
          outletId: null,
          category: "integration_quiet",
          severity: "low",
          title: "No webhook activity in last hour",
          details: "No webhook logs or transactions in the last hour. Integration may be idle or disconnected.",
        });
      }
    }

    // 3. Check for recent bulk imports vs realtime
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentTxns } = await supabase
      .from("sales_transactions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    if (recentTxns && recentTxns > 0) {
      const avgPerHour = recentTxns / 24;
      if (avgPerHour < 1) {
        await createInsight(supabase, {
          agentName: "bridge",
          module: "Integrations",
          outletId: null,
          category: "low_transaction_rate",
          severity: "low",
          title: `Low transaction rate: ${Math.round(avgPerHour * 60)}/hour`,
          details: `Only ${recentTxns} transactions in 24h. Consider checking POS volume or integration health.`,
        });
      }
    }

    await logAgentRun(supabase, "bridge", { 
      insights_created: insights.length,
      last_txn_minutes_ago: latestTxn ? Math.floor((Date.now() - new Date(latestTxn[0].created_at).getTime()) / (1000 * 60)) : null
    });

    return new Response(JSON.stringify({ 
      success: true,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Bridge error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
