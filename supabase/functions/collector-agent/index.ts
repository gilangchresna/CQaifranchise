// Collector: watches EMI repayment events post-disbursement. Flags missed/late payments
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const LATE_GRACE_DAYS = 3;

serve(async (req) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // Pull repayment events - try multiple schemas
    let dueEvents: any[] = [];
    
    // Try new schema first (due_date field)
    try {
      const { data, error } = await supabase
        .from("repayment_events")
        .select("*, outlets(name)")
        .lte("scheduled_date", today)
        .neq("processed", true);
      if (!error && data) dueEvents = data;
    } catch (e) {
      console.log("New schema query failed:", e);
    }
    
    // Try old schema (days_overdue field)
    if (dueEvents.length === 0) {
      try {
        const { data, error } = await supabase
          .from("repayment_events")
          .select("*, outlets(name)")
          .gt("days_overdue", 0);
        if (!error && data) dueEvents = data;
      } catch (e) {
        console.log("Old schema query failed:", e);
      }
    }

    const results: any[] = [];
    
    for (const ev of dueEvents ?? []) {
      const daysOverdue = ev.days_overdue ?? ev.days_late ?? 0;
      
      if (daysOverdue > LATE_GRACE_DAYS) {
        await createInsight(supabase, {
          agentName: "collector",
          module: "Financing",
          outletId: ev.outlet_id,
          category: daysOverdue > 30 ? "repayment_default" : "repayment_late",
          severity: daysOverdue > 30 ? "high" : "medium",
          title: `EMI ${daysOverdue} days overdue`,
          details: `EMI payment is ${daysOverdue} day(s) overdue. Amount: ${ev.amount || ev.total_amount || 'N/A'}`,
        });
        results.push({ outlet_id: ev.outlet_id, days_overdue: daysOverdue });
      }
    }

    await logAgentRun(supabase, "collector", { events_scanned: dueEvents.length, flags_raised: results.length });

    return new Response(JSON.stringify({ 
      success: true,
      events_scanned: dueEvents.length,
      flags_raised: results.length,
      results 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Collector error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
