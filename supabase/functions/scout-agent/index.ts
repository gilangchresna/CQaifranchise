// Scout Agent: Market intelligence and competitive analysis
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

serve(async (req) => {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const insights: any[] = [];

    // 1. Track outlet growth/decline month-over-month
    const { data: currentMonthSales } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount, date")
      .gte("date", monthStart);

    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
    
    const { data: prevMonthSales } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount")
      .gte("date", prevMonthStart)
      .lte("date", prevMonthEnd);

    // Calculate current month per outlet
    const currentByOutlet: Record<number, number> = {};
    for (const s of currentMonthSales ?? []) {
      currentByOutlet[s.outlet_id] = (currentByOutlet[s.outlet_id] || 0) + (s.amount || 0);
    }

    // Calculate previous month per outlet
    const prevByOutlet: Record<number, number> = {};
    for (const s of prevMonthSales ?? []) {
      prevByOutlet[s.outlet_id] = (prevByOutlet[s.outlet_id] || 0) + (s.amount || 0);
    }

    // Compare and flag significant changes
    for (const [outletId, current] of Object.entries(currentByOutlet)) {
      const prev = prevByOutlet[parseInt(outletId)] || 0;
      if (prev > 0) {
        const change = ((current - prev) / prev) * 100;
        if (change < -30) {
          await createInsight(supabase, {
            agentName: "scout",
            module: "Peer",
            outletId: outletId,
            category: "revenue_decline",
            severity: Math.abs(change) > 50 ? "high" : "medium",
            title: `Revenue down ${Math.abs(Math.round(change))}% MoM`,
            details: `This month: $${Math.round(current)}. Last month: $${Math.round(prev)}. Investigate cause.`,
          });
          insights.push({ outlet_id: outletId, change: Math.round(change) });
        } else if (change > 50) {
          await createInsight(supabase, {
            agentName: "scout",
            module: "Peer",
            outletId: outletId,
            category: "revenue_growth",
            severity: "low",
            title: `Revenue up ${Math.round(change)}% MoM`,
            details: `This month: $${Math.round(current)}. Last month: $${Math.round(prev)}. Identify success factors.`,
          });
        }
      }
    }

    // 2. Regional performance comparison
    const { data: outlets } = await supabase
      .from("outlets")
      .select("id, name, region_id")
      .eq("status", "active");

    const regionRevenue: Record<number, number> = {};
    for (const o of outlets ?? []) {
      regionRevenue[o.region_id] = (regionRevenue[o.region_id] || 0) + (currentByOutlet[o.id] || 0);
    }

    if (Object.keys(regionRevenue).length > 1) {
      const avgRegionRevenue = Object.values(regionRevenue).reduce((a, b) => a + b, 0) / Object.keys(regionRevenue).length;
      
      for (const [regionId, revenue] of Object.entries(regionRevenue)) {
        if (revenue < avgRegionRevenue * 0.5) {
          await createInsight(supabase, {
            agentName: "scout",
            module: "Peer",
            outletId: null,
            category: "region_underperformance",
            severity: "medium",
            title: `Region ${regionId} significantly below average`,
            details: `Region revenue: $${Math.round(revenue)}. Network avg: $${Math.round(avgRegionRevenue)}.`,
          });
        }
      }
    }

    // 3. Identify new outlet activity (potential expansion signals)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newOutlets } = await supabase
      .from("outlets")
      .select("id, name, created_at")
      .gte("created_at", weekAgo);

    if (newOutlets && newOutlets.length > 0) {
      await logAgentRun(supabase, "scout", { 
        new_outlets_this_week: newOutlets.length,
        insights_created: insights.length
      });
    }

    await logAgentRun(supabase, "scout", { 
      outlets_analyzed: Object.keys(currentByOutlet).length,
      insights_created: insights.length
    });

    return new Response(JSON.stringify({ 
      success: true,
      outlets_analyzed: Object.keys(currentByOutlet).length,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Scout error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
