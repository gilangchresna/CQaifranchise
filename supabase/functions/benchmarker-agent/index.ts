// supabase/functions/benchmarker-agent/index.ts
//
// Benchmarker: turns the Peer Benchmark module from a passive report into an
// active nudge — proactively surfaces when an outlet is meaningfully behind
// its peer cohort, rather than waiting for someone to open the dashboard.
// Suggested cadence: weekly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const UNDERPERFORMANCE_THRESHOLD_PCT = -0.15; // 15% below peer cohort average

interface PeerComparisonSignal {
  outlet_id: string;
  outlet_name: string;
  metric: string; // e.g. 'sales_per_sqft', 'avg_ticket_size'
  outlet_value: number;
  peer_cohort_avg: number;
  peer_cohort_name: string;
}

serve(async (req) => {
  try {
    const { comparisons } = (await req.json()) as { comparisons: PeerComparisonSignal[] };
    if (!Array.isArray(comparisons) || comparisons.length === 0) {
      return new Response(JSON.stringify({ error: "comparisons[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const c of comparisons) {
      if (c.peer_cohort_avg === 0) continue;
      const gapPct = (c.outlet_value - c.peer_cohort_avg) / c.peer_cohort_avg;
      if (gapPct > UNDERPERFORMANCE_THRESHOLD_PCT) continue;

      await createInsight(supabase, {
        agentName: "benchmarker",
        module: "Peer",
        outletId: c.outlet_id,
        category: "peer_underperformance",
        severity: gapPct < UNDERPERFORMANCE_THRESHOLD_PCT * 2 ? "high" : "medium",
        title: `${c.outlet_name}: ${c.metric} is ${(Math.abs(gapPct) * 100).toFixed(0)}% below ${c.peer_cohort_name} average`,
        details: `Outlet value ${c.outlet_value} vs. peer average ${c.peer_cohort_avg}. Worth a review of what peers are doing differently.`,
        payload: { metric: c.metric, outlet_value: c.outlet_value, peer_avg: c.peer_cohort_avg, gap_pct: gapPct },
      });
      flagged.push({ outlet_id: c.outlet_id, metric: c.metric, gap_pct: gapPct });
    }

    await logAgentRun(supabase, "benchmarker", { comparisons_scanned: comparisons.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
