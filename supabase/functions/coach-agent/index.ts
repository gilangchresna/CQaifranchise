// Coach Agent: Workforce performance monitoring and coaching reminders
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getServiceClient, createInsight, logAgentRun } from "../_shared/agentInsights.ts";

const supabase = getServiceClient();
const LOW_PERFORMANCE_THRESHOLD = 50; // performance_score < 50 = low
const LOW_ATTENDANCE_THRESHOLD = 80; // attendance_rate < 80% = concern

serve(async (req) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const insights: any[] = [];
    
    // 1. Check staff with low performance scores
    const { data: lowPerformers } = await supabase
      .from("employees")
      .select("id, name, role, outlet_id, performance_score, attendance_rate")
      .lt("performance_score", LOW_PERFORMANCE_THRESHOLD);

    for (const staff of lowPerformers ?? []) {
      await createInsight(supabase, {
        agentName: "coach",
        module: "Workforce",
        outletId: staff.outlet_id?.toString() ?? null,
        category: "low_performance",
        severity: staff.performance_score < 30 ? "high" : "medium",
        title: `Staff underperformance: ${staff.name}`,
        details: `Performance score: ${staff.performance_score}/100. Attendance: ${staff.attendance_rate}%. Needs coaching intervention.`,
      });
      insights.push({ staff: staff.name, issue: "low_performance" });
    }

    // 2. Check for attendance issues (no check-in today)
    const { data: todayAttendance } = await supabase
      .from("staff_attendance")
      .select("staff_id, date")
      .eq("date", today);

    const checkedIn = new Set((todayAttendance ?? []).map((a: any) => a.staff_id));
    
    const { data: employees } = await supabase
      .from("employees")
      .select("id, name, outlet_id")
      .eq("status", "active");

    for (const emp of employees ?? []) {
      if (!checkedIn.has(emp.id) && !checkedIn.has(emp.id.toString())) {
        await createInsight(supabase, {
          agentName: "coach",
          module: "Workforce",
          outletId: emp.outlet_id?.toString() ?? null,
          category: "missing_attendance",
          severity: "low",
          title: `Missing attendance: ${emp.name}`,
          details: `No check-in recorded for ${emp.name} on ${today}. Verify attendance.`,
        });
        insights.push({ staff: emp.name, issue: "missing_attendance" });
      }
    }

    // 3. Check for staff with low attendance rates
    const { data: lowAttendance } = await supabase
      .from("employees")
      .select("id, name, outlet_id, attendance_rate")
      .lt("attendance_rate", LOW_ATTENDANCE_THRESHOLD)
      .gte("attendance_rate", 0);

    for (const staff of lowAttendance ?? []) {
      await createInsight(supabase, {
        agentName: "coach",
        module: "Workforce",
        outletId: staff.outlet_id?.toString() ?? null,
        category: "low_attendance",
        severity: staff.attendance_rate < 60 ? "high" : "medium",
        title: `Attendance concern: ${staff.name}`,
        details: `Attendance rate: ${staff.attendance_rate}% (threshold: ${LOW_ATTENDANCE_THRESHOLD}%). Schedule coaching session.`,
      });
      insights.push({ staff: staff.name, issue: "low_attendance" });
    }

    await logAgentRun(supabase, "coach", { 
      staff_checked: employees?.length ?? 0, 
      insights_created: insights.length 
    });

    return new Response(JSON.stringify({ 
      success: true,
      staff_checked: employees?.length ?? 0,
      insights_created: insights.length,
      details: insights
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Coach error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
