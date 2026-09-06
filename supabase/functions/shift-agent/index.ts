// supabase/functions/shift-agent/index.ts
//
// Shift: predicts staffing shortfalls from attendance trends, flags no-show
// risk ahead of an upcoming shift, and correlates understaffing with sales
// dips. Suggested cadence: daily, ideally the evening before next-day shifts.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

interface ShiftSignal {
  outlet_id: string;
  outlet_name: string;
  shift_date: string;
  scheduled_staff: number;
  recent_no_show_rate: number; // 0-1, trailing average for this outlet
  sales_trend: number;          // % change, negative = declining
}

serve(async (req) => {
  try {
    const { shifts } = (await req.json()) as { shifts: ShiftSignal[] };
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return new Response(JSON.stringify({ error: "shifts[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const s of shifts) {
      const expectedShortfall = Math.round(s.scheduled_staff * s.recent_no_show_rate);
      if (expectedShortfall === 0) continue;

      const severity = expectedShortfall >= 2 || s.recent_no_show_rate > 0.3 ? "high" : "medium";
      const salesContext =
        s.sales_trend < -0.05
          ? ` Sales already trending down (${(s.sales_trend * 100).toFixed(1)}%) — understaffing risk compounding it.`
          : "";

      await createInsight(supabase, {
        agentName: "shift",
        module: "Workforce",
        outletId: s.outlet_id,
        category: "staffing_shortfall_risk",
        severity,
        title: `${s.outlet_name}: predicted ${expectedShortfall} no-show(s) for ${s.shift_date}`,
        details: `Based on a ${(s.recent_no_show_rate * 100).toFixed(0)}% trailing no-show rate against ${s.scheduled_staff} scheduled staff.${salesContext}`,
        payload: { shift_date: s.shift_date, expected_shortfall: expectedShortfall, no_show_rate: s.recent_no_show_rate },
      });
      flagged.push({ outlet_id: s.outlet_id, shift_date: s.shift_date, expected_shortfall: expectedShortfall });
    }

    await logAgentRun(supabase, "shift", { shifts_scanned: shifts.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
