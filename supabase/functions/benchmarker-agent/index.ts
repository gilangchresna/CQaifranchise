// Benchmarker Agent: Peer performance comparison across outlets
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const insights: any[] = [];

    // Get average daily revenue per outlet for this month
    const { data: monthlySales } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount, date")
      .gte("date", monthStart);

    // Calculate per-outlet averages
    const outletRevenue: Record<number, { total: number; days: Set<string> }> = {};
    for (const sale of monthlySales ?? []) {
      if (!outletRevenue[sale.outlet_id]) {
        outletRevenue[sale.outlet_id] = { total: 0, days: new Set() };
      }
      outletRevenue[sale.outlet_id].total += sale.amount || 0;
      outletRevenue[sale.outlet_id].days.add(sale.date);
    }

    const outletAverages = Object.entries(outletRevenue).map(([id, data]) => ({
      outlet_id: parseInt(id),
      avg_daily: data.total / Math.max(data.days.size, 1),
      total_revenue: data.total,
      active_days: data.days.size
    }));

    if (outletAverages.length > 0) {
      // Calculate network average
      const networkAvg = outletAverages.reduce((sum, o) => sum + o.avg_daily, 0) / outletAverages.length;
      
      // Flag underperformers (>30% below average)
      const threshold = networkAvg * 0.7;
      
      for (const outlet of outletAverages) {
        if (outlet.avg_daily < threshold) {
          const pct = Math.round((1 - outlet.avg_daily / networkAvg) * 100);
          await createInsight(supabase, {
            agentName: "benchmarker",
            module: "Peer",
            outletId: outlet.outlet_id.toString(),
            category: "underperformance",
            severity: pct > 50 ? "high" : "medium",
            title: `Revenue ${pct}% below average`,
            details: `Daily avg: $${Math.round(outlet.avg_daily)}. Network avg: $${Math.round(networkAvg)}. ${outlet.active_days} active days this month.`,
          });
          insights.push({ outlet_id: outlet.outlet_id, issue: "underperformance", pct });
        }
      }

      // Flag top performers (for recognition)
      const topThreshold = networkAvg * 1.3;
      const topPerformers = outletAverages.filter(o => o.avg_daily > topThreshold);
      
      if (topPerformers.length > 0) {
        await logAgentRun(supabase, "benchmarker", { 
          network_avg: Math.round(networkAvg),
          top_performers: topPerformers.length,
          underperformers: insights.length
        });
      }
    }

    // Also check transaction count per outlet
    const { data: txnCounts } = await supabase
      .from("sales_transactions")
      .select("outlet_id, transaction_count")
      .gte("date", monthStart);

    const txnByOutlet: Record<number, number> = {};
    for (const t of txnCounts ?? []) {
      txnByOutlet[t.outlet_id] = (txnByOutlet[t.outlet_id] || 0) + (t.transaction_count || 1);
    }

    // Flag outlets with low transaction volume but high revenue (potential data issues)
    for (const [outletId, count] of Object.entries(txnByOutlet)) {
      const revenue = outletRevenue[parseInt(outletId)]?.total || 0;
      if (count > 0 && revenue / count > 500) { // avg transaction > $500
        await createInsight(supabase, {
          agentName: "benchmarker",
          module: "Peer",
          outletId: outletId,
          category: "high_avg_transaction",
          severity: "low",
          title: `High avg transaction: $${Math.round(revenue / count)}`,
          details: `${count} transactions with avg $${Math.round(revenue / count)}. Verify POS data integrity.`,
        });
      }
    }

    await logAgentRun(supabase, "benchmarker", { 
      outlets_analyzed: outletAverages.length,
      insights_created: insights.length
    });

    return new Response(JSON.stringify({ 
      success: true,
      outlets_analyzed: outletAverages.length,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Benchmarker error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
