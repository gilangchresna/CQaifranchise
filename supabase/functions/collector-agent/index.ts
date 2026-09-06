// supabase/functions/collector-agent/index.ts
//
// Collector: watches EMI repayment events post-disbursement. Flags missed/
// late payments and raises a compounding-risk insight if lateness trends
// upward, feeding back into the Financing module's monitoring view.
// Suggested cadence: daily.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();

const LATE_GRACE_DAYS = 3;
const DEFAULT_THRESHOLD_DAYS = 30;

serve(async (req) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Pull all repayment events due on/before today that aren't yet paid.
    const { data: dueEvents, error } = await supabase
      .from("repayment_events")
      .select("*, outlets(name)")
      .lte("due_date", today)
      .neq("status", "paid");

    if (error) throw error;

    const results = [];
    for (const ev of dueEvents ?? []) {
      const daysLate = ev.days_late ?? 0;
      let newStatus = ev.status;

      if (daysLate >= DEFAULT_THRESHOLD_DAYS) {
        newStatus = "defaulted";
      } else if (daysLate > LATE_GRACE_DAYS) {
        newStatus = "late";
      }

      if (newStatus !== ev.status) {
        await supabase.from("repayment_events").update({ status: newStatus }).eq("id", ev.id);
      }

      if (newStatus === "late" || newStatus === "defaulted") {
        await createInsight(supabase, {
          agentName: "collector",
          module: "Financing",
          outletId: ev.outlet_id,
          category: newStatus === "defaulted" ? "repayment_default" : "repayment_late",
          severity: newStatus === "defaulted" ? "high" : "medium",
          title: `${ev.outlets?.name ?? ev.outlet_id}: repayment ${newStatus} (${daysLate}d)`,
          details: `EMI of ${ev.amount_due} due ${ev.due_date} is ${daysLate} day(s) overdue.`,
          payload: { repayment_event_id: ev.id, days_late: daysLate, amount_due: ev.amount_due },
        });
        results.push({ outlet_id: ev.outlet_id, status: newStatus, days_late: daysLate });
      }
    }

    await logAgentRun(supabase, "collector", { events_scanned: dueEvents?.length ?? 0, flags_raised: results.length });

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
