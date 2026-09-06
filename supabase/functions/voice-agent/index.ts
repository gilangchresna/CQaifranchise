// supabase/functions/voice-agent/index.ts
//
// Voice: clusters complaint volume/patterns per outlet (using the existing
// OutletKPI.complaints field already in your schema) and correlates spikes
// with staffing or stockout signals so a case gets richer context
// automatically instead of a bare complaint count. Suggested cadence: daily.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const COMPLAINT_SPIKE_THRESHOLD = 5; // absolute complaints in the period
const COMPLAINT_TREND_MULTIPLIER = 1.5; // vs. trailing average

interface OutletComplaintSignal {
  outlet_id: string;
  outlet_name: string;
  complaints_today: number;
  complaints_trailing_avg: number;
  staffing_status?: "optimal" | "short" | "critical";
  stockout_risk?: number; // 0-1
}

serve(async (req) => {
  try {
    const { signals } = (await req.json()) as { signals: OutletComplaintSignal[] };
    if (!Array.isArray(signals) || signals.length === 0) {
      return new Response(JSON.stringify({ error: "signals[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const s of signals) {
      const isSpike =
        s.complaints_today >= COMPLAINT_SPIKE_THRESHOLD ||
        (s.complaints_trailing_avg > 0 && s.complaints_today >= s.complaints_trailing_avg * COMPLAINT_TREND_MULTIPLIER);

      if (!isSpike) continue;

      const correlations: string[] = [];
      if (s.staffing_status === "short" || s.staffing_status === "critical") {
        correlations.push(`staffing is ${s.staffing_status}`);
      }
      if (s.stockout_risk && s.stockout_risk > 0.5) {
        correlations.push(`elevated stockout risk (${(s.stockout_risk * 100).toFixed(0)}%)`);
      }

      await createInsight(supabase, {
        agentName: "voice",
        module: "Cases",
        outletId: s.outlet_id,
        category: "complaint_spike",
        severity: s.complaints_today >= COMPLAINT_SPIKE_THRESHOLD * 2 ? "high" : "medium",
        title: `${s.outlet_name}: complaint spike (${s.complaints_today} today, avg ${s.complaints_trailing_avg.toFixed(1)})`,
        details: correlations.length
          ? `Possible contributing factors: ${correlations.join(", ")}.`
          : "No obvious staffing/stockout correlation found — may need manual review.",
        payload: { complaints_today: s.complaints_today, trailing_avg: s.complaints_trailing_avg, correlations },
      });
      flagged.push({ outlet_id: s.outlet_id, complaints_today: s.complaints_today });
    }

    await logAgentRun(supabase, "voice", { outlets_scanned: signals.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
