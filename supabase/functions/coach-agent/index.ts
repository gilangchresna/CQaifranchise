// supabase/functions/coach-agent/index.ts
//
// Coach: reviews staff performance trends (distinct from Shift's staffing-
// shortfall focus) and recommends recognition or coaching interventions —
// e.g. a consistently high performer worth recognising, or a declining
// trend worth a check-in before it becomes a bigger issue.
// Suggested cadence: weekly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

interface StaffPerformanceSignal {
  outlet_id: string;
  outlet_name: string;
  staff_id: string;
  staff_name: string;
  performance_trend: number; // % change over trailing period, positive = improving
  attendance_rate: number;   // 0-1
}

const DECLINE_THRESHOLD = -0.15;
const STRONG_IMPROVEMENT_THRESHOLD = 0.20;

serve(async (req) => {
  try {
    const { staff } = (await req.json()) as { staff: StaffPerformanceSignal[] };
    if (!Array.isArray(staff) || staff.length === 0) {
      return new Response(JSON.stringify({ error: "staff[] required" }), { status: 400 });
    }

    const flagged = [];
    for (const s of staff) {
      if (s.performance_trend <= DECLINE_THRESHOLD) {
        await createInsight(supabase, {
          agentName: "coach",
          module: "Workforce",
          outletId: s.outlet_id,
          category: "performance_decline",
          severity: s.attendance_rate < 0.8 ? "high" : "medium",
          title: `${s.staff_name} at ${s.outlet_name}: performance trending down (${(s.performance_trend * 100).toFixed(0)}%)`,
          details: "Suggest a check-in — consider whether staffing load, training gaps, or personal factors are contributing.",
          payload: { staff_id: s.staff_id, performance_trend: s.performance_trend, attendance_rate: s.attendance_rate },
        });
        flagged.push({ staff_id: s.staff_id, type: "decline" });
      } else if (s.performance_trend >= STRONG_IMPROVEMENT_THRESHOLD) {
        await createInsight(supabase, {
          agentName: "coach",
          module: "Workforce",
          outletId: s.outlet_id,
          category: "recognition_opportunity",
          severity: "low",
          title: `${s.staff_name} at ${s.outlet_name}: strong improvement (${(s.performance_trend * 100).toFixed(0)}%)`,
          details: "Worth recognising — sustained improvement like this is a retention opportunity.",
          payload: { staff_id: s.staff_id, performance_trend: s.performance_trend },
        });
        flagged.push({ staff_id: s.staff_id, type: "recognition" });
      }
    }

    await logAgentRun(supabase, "coach", { staff_scanned: staff.length, flagged: flagged.length });

    return new Response(JSON.stringify({ flagged }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
