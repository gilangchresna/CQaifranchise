// Collector: watches EMI repayment schedule post-disbursement. Flags missed/
// late payments and raises a compounding-risk insight as lateness grows.
//
// FIXED: the previous version queried a "repayment_events" table with two
// different guessed schemas (defensive try/catch fallback), because a
// migration tried to create a NEW repayment_events table that collided with
// (and silently no-opped against) the REAL repayment_events table already
// created in 20260805000000_financing_and_reporting.sql — which is keyed by
// application_id, not outlet_id, and has no outlet relationship at all (so
// the `outlets(name)` embed in the old code would also have failed at
// runtime). This version reads the correct existing tables instead:
// repayment_schedule (the actual EMI due/paid tracking) joined through
// financing_applications to resolve outlet_id/franchisee_id.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const LATE_GRACE_DAYS = 3;
const DEFAULT_THRESHOLD_DAYS = 30;

serve(async (req) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Pull EMI schedule rows that are due and not fully paid.
    const { data: dueSchedules, error } = await supabase
      .from("repayment_schedule")
      .select("id, application_id, due_date, total_amount, paid_amount, status, days_overdue, financing_applications(outlet_id, franchisee_id)")
      .lte("due_date", today)
      .neq("status", "PAID");

    if (error) throw error;

    const results: any[] = [];

    for (const sched of dueSchedules ?? []) {
      const app = (sched as any).financing_applications;
      const outletId: number | null = app?.outlet_id ?? null;

      // days_overdue is maintained by the existing schema; fall back to a
      // date computation if it hasn't been updated yet for this row.
      const daysOverdue =
        sched.days_overdue && sched.days_overdue > 0
          ? sched.days_overdue
          : Math.max(0, Math.floor((Date.now() - new Date(sched.due_date).getTime()) / (1000 * 60 * 60 * 24)));

      if (daysOverdue <= LATE_GRACE_DAYS) continue;

      const newStatus = daysOverdue >= DEFAULT_THRESHOLD_DAYS ? "DEFAULTED" : "OVERDUE";
      if (newStatus !== sched.status) {
        await supabase
          .from("repayment_schedule")
          .update({ status: newStatus, days_overdue: daysOverdue })
          .eq("id", sched.id);
      }

      await createInsight(supabase, {
        agentName: "collector",
        module: "Financing",
        outletId: outletId !== null ? String(outletId) : null,
        category: newStatus === "DEFAULTED" ? "repayment_default" : "repayment_late",
        severity: newStatus === "DEFAULTED" ? "high" : "medium",
        title: `EMI ${daysOverdue} day(s) overdue`,
        details: `Repayment schedule ${sched.id}: EMI of ${sched.total_amount} (paid so far: ${sched.paid_amount}) due ${sched.due_date} is ${daysOverdue} day(s) overdue.`,
        payload: { schedule_id: sched.id, application_id: sched.application_id, days_overdue: daysOverdue, total_amount: sched.total_amount },
      });
      results.push({ schedule_id: sched.id, outlet_id: outletId, days_overdue: daysOverdue });
    }

    await logAgentRun(supabase, "collector", { schedules_scanned: dueSchedules?.length ?? 0, flags_raised: results.length });

    return new Response(JSON.stringify({ success: true, schedules_scanned: dueSchedules?.length ?? 0, flags_raised: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Collector error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
