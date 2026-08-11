/// <reference lib="deno.ns" />

/**
 * SLA Escalator Edge Function
 * Checks for overdue cases and escalates appropriately
 *
 * POST /functions/v1/sla-escalator
 *
 * Request Body (optional):
 * {
 *   case_ids?: number[],       // Optional: specific cases to check
 *   warning_threshold?: number, // Optional: % of SLA elapsed to send warning (default: 50)
 *   escalation_threshold?: number, // Optional: % of SLA elapsed to escalate (default: 75)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   checked: number,
 *   warnings_sent: number,
 *   escalated: number,
 *   overdue: number,
 *   errors: string[]
 * }
 *
 * Cron: Every 15 minutes (every 15 min)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cqaifranchise.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default thresholds (percentage of SLA time elapsed)
let DEFAULT_WARNING_THRESHOLD = 50;  // 50% elapsed = warning
let DEFAULT_ESCALATION_THRESHOLD = 75; // 75% elapsed = escalate

/**
 * Load SLA thresholds from settings table (runtime override)
 */
async function loadSlaThresholds(supabase: any) {
  const { data: rows } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["sla_warning_threshold", "sla_escalation_threshold"]);

  for (const r of rows || []) {
    const v = parseInt(r.value);
    if (!isNaN(v)) {
      if (r.key === "sla_warning_threshold") DEFAULT_WARNING_THRESHOLD = v;
      if (r.key === "sla_escalation_threshold") DEFAULT_ESCALATION_THRESHOLD = v;
    }
  }
  console.log(`SLA thresholds: warning=${DEFAULT_WARNING_THRESHOLD}%, escalation=${DEFAULT_ESCALATION_THRESHOLD}%`);
}

// Status that indicates a case is still open
const OPEN_STATUSES = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS"];

type Severity = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";

interface SlaEscalatorRequest {
  case_ids?: number[];
  warning_threshold?: number;
  escalation_threshold?: number;
}

interface SlaEscalatorResponse {
  success: boolean;
  checked: number;
  warnings_sent: number;
  escalated: number;
  overdue: number;
  errors: string[];
  warnings: WarningDetail[];
  escalations: EscalationDetail[];
}

interface WarningDetail {
  case_id: number;
  case_title: string;
  assignee_id: string;
  assignee_name: string;
  sla_deadline: string;
  elapsed_percent: number;
  remaining_minutes: number;
}

interface EscalationDetail {
  case_id: number;
  case_title: string;
  from_assignee_id: string;
  from_assignee_name: string;
  to_assignee_id: string;
  to_assignee_name: string;
  escalation_rule: string;
  elapsed_percent: number;
}

interface CaseInfo {
  id: number;
  title: string;
  status: string;
  priority: string;
  sla_deadline: string | null;
  assigned_to_id: string | null;
  outlet_id: number | null;
  created_at: string;
  alert: {
    id: number;
    severity: Severity;
  } | null;
  assignee: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  outlet: {
    region_id: number;
  } | null;
}

/**
 * Calculate percentage of SLA elapsed
 */
function calculateElapsedPercent(
  createdAt: string,
  slaDeadline: string,
  severity: Severity
): number {
  const created = new Date(createdAt).getTime();
  const deadline = new Date(slaDeadline).getTime();
  const now = Date.now();

  if (now >= deadline) return 100;

  const totalDuration = deadline - created;
  const elapsed = now - created;

  return Math.round((elapsed / totalDuration) * 100);
}

/**
 * Calculate remaining time in minutes
 */
function calculateRemainingMinutes(slaDeadline: string): number {
  const deadline = new Date(slaDeadline).getTime();
  const now = Date.now();
  const remaining = deadline - now;

  return Math.max(0, Math.round(remaining / (1000 * 60)));
}

/**
 * Find escalation target based on current assignee role
 */
async function findEscalationTarget(
  supabase: any,
  currentAssignee: { id: string; role: string } | null,
  alertSeverity: Severity | null,
  regionId: number | null
): Promise<{ id: string; full_name: string; role: string } | null> {
  // If no current assignee, try to find appropriate one
  if (!currentAssignee) {
    // Try HQ_ADMIN for P0/P1
    if (alertSeverity === "P0_CRITICAL" || alertSeverity === "P1_HIGH") {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, role")
        .eq("role", "HQ_ADMIN")
        .eq("is_active", true)
        .limit(1)
        .single();
      return data || null;
    }

    // Try Regional Manager
    if (regionId) {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, role")
        .eq("role", "REGIONAL_MANAGER")
        .eq("region_id", regionId)
        .eq("is_active", true)
        .limit(1)
        .single();
      return data || null;
    }

    // Last resort: any active HQ_ADMIN
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, role")
      .eq("role", "HQ_ADMIN")
      .eq("is_active", true)
      .limit(1)
      .single();
    return data || null;
  }

  // Escalation chain based on current role
  const escalationChain: Record<string, { role: string; region_needed?: boolean }[]> = {
    "FRANCHISEE_OWNER": [
      { role: "AREA_LEAD", region_needed: true },
      { role: "REGIONAL_MANAGER", region_needed: true },
      { role: "HQ_ADMIN" },
    ],
    "AREA_LEAD": [
      { role: "REGIONAL_MANAGER", region_needed: true },
      { role: "HQ_ADMIN" },
    ],
    "REGIONAL_MANAGER": [
      { role: "HQ_ADMIN" },
    ],
    "OUTLET_STAFF": [
      { role: "FRANCHISEE_OWNER" },
      { role: "AREA_LEAD", region_needed: true },
      { role: "REGIONAL_MANAGER", region_needed: true },
      { role: "HQ_ADMIN" },
    ],
  };

  const chain = escalationChain[currentAssignee.role] || escalationChain["REGIONAL_MANAGER"];

  for (const step of chain) {
    let query = supabase
      .from("user_profiles")
      .select("id, full_name, role")
      .eq("role", step.role)
      .eq("is_active", true);

    if (step.region_needed && regionId) {
      query = query.eq("region_id", regionId);
    }

    const { data } = await query.limit(1).single();
    if (data && data.id !== currentAssignee.id) {
      return data;
    }
  }

  return null;
}

/**
 * Call notification trigger function
 */
async function triggerNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  eventType: string,
  entityId: number
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/notification-trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        event_type: eventType,
        entity_id: entityId,
      }),
    });

    if (response.ok) {
      console.log(`Notification triggered: ${eventType} for case ${entityId}`);
    }
  } catch (error) {
    console.error("Error triggering notification:", error);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const errors: string[] = [];

  try {
    let body: SlaEscalatorRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is OK
    }

    const warningThreshold = body.warning_threshold ?? DEFAULT_WARNING_THRESHOLD;
    const escalationThreshold = body.escalation_threshold ?? DEFAULT_ESCALATION_THRESHOLD;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load SLA thresholds from settings table
    await loadSlaThresholds(supabase);

    // Build query for open cases with SLA deadlines
    let casesQuery = supabase
      .from("cases")
      .select(`
        id,
        title,
        description,
        status,
        priority,
        sla_deadline,
        assigned_to_id,
        outlet_id,
        source_alert_id,
        created_at
      `)
      .not("sla_deadline", "is", null)
      .not("status", "eq", "RESOLVED")
      .not("status", "eq", "CLOSED");

    // Filter by specific cases if provided
    if (body.case_ids && body.case_ids.length > 0) {
      casesQuery = casesQuery.in("id", body.case_ids);
    }

    const { data: cases, error: casesError } = await casesQuery;

    if (casesError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch cases: ${casesError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cases || cases.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          checked: 0,
          warnings_sent: 0,
          escalated: 0,
          overdue: 0,
          errors: [],
          warnings: [],
          escalations: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let warningsSent = 0;
    let escalated = 0;
    let overdue = 0;
    const warningDetails: WarningDetail[] = [];
    const escalationDetails: EscalationDetail[] = [];

    // Process each case
    for (const caseData of cases) {
      const caseInfo = caseData as unknown as CaseInfo;

      if (!caseInfo.sla_deadline) continue;

      const elapsedPercent = calculateElapsedPercent(
        caseInfo.created_at,
        caseInfo.sla_deadline,
        (caseInfo.alert?.severity as Severity) || "P2_MEDIUM"
      );

      const remainingMinutes = calculateRemainingMinutes(caseInfo.sla_deadline);

      // Check if overdue (100%+ elapsed)
      if (elapsedPercent >= 100) {
        overdue++;

        // Find escalation target
        const escalationTarget = await findEscalationTarget(
          supabase,
          caseInfo.assignee,
          caseInfo.alert?.severity as Severity,
          caseInfo.outlet?.region_id ?? null
        );

        if (escalationTarget && caseInfo.assignee && escalationTarget.id !== caseInfo.assignee.id) {
          // Escalate the case
          await supabase
            .from("cases")
            .update({
              assigned_to_id: escalationTarget.id,
              status: "IN_PROGRESS",
            })
            .eq("id", caseInfo.id);

          escalationDetails.push({
            case_id: caseInfo.id,
            case_title: caseInfo.title,
            from_assignee_id: caseInfo.assignee.id,
            from_assignee_name: caseInfo.assignee.full_name,
            to_assignee_id: escalationTarget.id,
            to_assignee_name: escalationTarget.full_name,
            escalation_rule: `escalate_${caseInfo.assignee.role}_to_${escalationTarget.role}`,
            elapsed_percent: elapsedPercent,
          });

          escalated++;

          // Notify new assignee
          await triggerNotification(
            supabaseUrl,
            supabaseServiceKey,
            "CASE_ASSIGNED",
            caseInfo.id
          );

          // Send SLA warning to new assignee
          await triggerNotification(
            supabaseUrl,
            supabaseServiceKey,
            "SLA_WARNING",
            caseInfo.id
          );
        }
      }
      // Check if warning threshold reached (and not already notified)
      else if (elapsedPercent >= warningThreshold) {
        // Check if we already sent a warning recently (within last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data: recentWarnings } = await supabase
          .from("notification_logs")
          .select("id")
          .eq("case_id", caseInfo.id)
          .eq("status", "SENT")
          .eq("channel", "EMAIL")
          .gte("created_at", oneHourAgo);

        if (!recentWarnings || recentWarnings.length === 0) {
          warningDetails.push({
            case_id: caseInfo.id,
            case_title: caseInfo.title,
            assignee_id: caseInfo.assignee?.id || "",
            assignee_name: caseInfo.assignee?.full_name || "Unassigned",
            sla_deadline: caseInfo.sla_deadline,
            elapsed_percent: elapsedPercent,
            remaining_minutes: remainingMinutes,
          });

          // Send SLA warning notification
          await triggerNotification(
            supabaseUrl,
            supabaseServiceKey,
            "SLA_WARNING",
            caseInfo.id
          );

          warningsSent++;
        }
      }
    }

    // Log the escalation run
    try {
      await supabase.from("sla_escalation_runs").insert({
        cases_checked: cases.length,
        warnings_sent: warningsSent,
        cases_escalated: escalated,
        cases_overdue: overdue,
      });
    } catch (logError) {
      console.warn("Failed to log escalation run:", logError);
    }

    console.log(`SLA Escalation completed: ${cases.length} checked, ${warningsSent} warnings, ${escalated} escalations, ${overdue} overdue`);

    const response: SlaEscalatorResponse = {
      success: true,
      checked: cases.length,
      warnings_sent: warningsSent,
      escalated,
      overdue,
      errors,
      warnings: warningDetails,
      escalations: escalationDetails,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("SLA Escalator error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        checked: 0,
        warnings_sent: 0,
        escalated: 0,
        overdue: 0,
        errors: [error.message || "Internal server error"],
        warnings: [],
        escalations: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
