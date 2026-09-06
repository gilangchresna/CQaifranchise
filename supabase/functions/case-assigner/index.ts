/// <reference lib="deno.ns" />

/**
 * Case Assigner Edge Function
 * Automatically assigns cases to appropriate users based on rules
 *
 * POST /functions/v1/case-assigner
 *
 * Request Body:
 * {
 *   alert_id: number,           // Required: Alert to create case from
 *   force?: boolean             // Optional: Override existing assignment
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   case_id: number,
 *   assigned_to: string,
 *   assigned_to_name: string,
 *   assignment_rule: string,
 *   sla_deadline: string,
 *   case_priority: string
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SLA Hours based on severity
const SLA_HOURS: Record<string, number> = {
  P0_CRITICAL: 1,    // 1 hour
  P1_HIGH: 4,       // 4 hours
  P2_MEDIUM: 24,     // 24 hours (1 day)
  P3_LOW: 72,        // 72 hours (3 days)
};

// Severity escalation order (for escalation rules)
const SEVERITY_ORDER = ["P3_LOW", "P2_MEDIUM", "P1_HIGH", "P0_CRITICAL"];

type Severity = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
type CasePriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
type AssignmentRule = "HQ_PRIMARY" | "REGIONAL_PRIMARY" | "AREA_LEAD" | "FRANCHISEE_PRIMARY" | "AUTO_ESCALATED";

interface CaseAssignerRequest {
  alert_id: number;
  force?: boolean;
}

interface CaseAssignerResponse {
  success: boolean;
  case_id?: number;
  assigned_to?: string;
  assigned_to_name?: string;
  assignment_rule?: AssignmentRule;
  sla_deadline?: string;
  case_priority?: CasePriority;
  error?: string;
  reason?: string;
}

interface AlertInfo {
  id: number;
  type: string;
  severity: Severity;
  status: string;
  title: string;
  description: string;
  score: number;
  outlet_id: number;
  outlet: {
    id: number;
    name: string;
    code: string;
    region_id: number;
    franchisee_id: string | null;
    regions: {
      id: number;
      name: string;
      code: string;
    };
  };
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  region_id: number | null;
}

/**
 * Map alert severity to case priority
 */
function mapSeverityToCasePriority(severity: string): CasePriority {
  const mapping: Record<string, CasePriority> = {
    "P0_CRITICAL": "URGENT",
    "P1_HIGH": "HIGH",
    "P2_MEDIUM": "MEDIUM",
    "P3_LOW": "LOW",
  };
  return mapping[severity] || "MEDIUM";
}

/**
 * Calculate SLA deadline based on severity
 */
function calculateSLADeadline(severity: Severity): string {
  const hours = SLA_HOURS[severity] || 72;
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline.toISOString();
}

/**
 * Find HQ Admin for P0_CRITICAL and P1_HIGH
 */
async function findHQAdmin(supabase: any): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, phone, role, region_id")
    .eq("role", "HQ_ADMIN")
    .eq("is_active", true)
    .limit(1)
    .single();

  return data || null;
}

/**
 * Find Regional Manager for outlet's region
 */
async function findRegionalManager(supabase: any, regionId: number): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, phone, role, region_id")
    .eq("role", "REGIONAL_MANAGER")
    .eq("region_id", regionId)
    .eq("is_active", true)
    .limit(1)
    .single();

  return data || null;
}

/**
 * Find Area Lead for region (if exists)
 */
async function findAreaLead(supabase: any, regionId: number): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, phone, role, region_id")
    .eq("role", "AREA_LEAD")
    .eq("region_id", regionId)
    .eq("is_active", true)
    .limit(1)
    .single();

  return data || null;
}

/**
 * Find Franchisee Owner for outlet
 */
async function findFranchiseeOwner(supabase: any, franchiseeId: string | null): Promise<UserProfile | null> {
  if (!franchiseeId) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, phone, role, region_id")
    .eq("id", franchiseeId)
    .eq("is_active", true)
    .single();

  return data || null;
}

/**
 * Apply assignment rules based on severity
 */
async function applyAssignmentRules(
  supabase: any,
  alert: AlertInfo
): Promise<{ user: UserProfile; rule: AssignmentRule } | null> {
  const severity = alert.severity;
  const regionId = alert.outlet.region_id;
  const franchiseeId = alert.outlet.franchisee_id;

  // Priority 1: P0_CRITICAL → HQ_ADMIN
  if (severity === "P0_CRITICAL") {
    const hqAdmin = await findHQAdmin(supabase);
    if (hqAdmin) {
      return { user: hqAdmin, rule: "HQ_PRIMARY" };
    }
  }

  // Priority 2: P1_HIGH → Regional Manager
  if (severity === "P1_HIGH") {
    const regionalManager = await findRegionalManager(supabase, regionId);
    if (regionalManager) {
      return { user: regionalManager, rule: "REGIONAL_PRIMARY" };
    }
    // Fallback to HQ Admin if no regional manager
    const hqAdmin = await findHQAdmin(supabase);
    if (hqAdmin) {
      return { user: hqAdmin, rule: "HQ_PRIMARY" };
    }
  }

  // Priority 3: P2_MEDIUM → Area Lead (if exists), else Regional Manager
  if (severity === "P2_MEDIUM") {
    const areaLead = await findAreaLead(supabase, regionId);
    if (areaLead) {
      return { user: areaLead, rule: "AREA_LEAD" };
    }
    const regionalManager = await findRegionalManager(supabase, regionId);
    if (regionalManager) {
      return { user: regionalManager, rule: "REGIONAL_PRIMARY" };
    }
  }

  // Priority 4: P3_LOW → Franchisee Owner
  if (severity === "P3_LOW") {
    const franchisee = await findFranchiseeOwner(supabase, franchiseeId);
    if (franchisee) {
      return { user: franchisee, rule: "FRANCHISEE_PRIMARY" };
    }
    // Fallback to Regional Manager
    const regionalManager = await findRegionalManager(supabase, regionId);
    if (regionalManager) {
      return { user: regionalManager, rule: "REGIONAL_PRIMARY" };
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
      console.log(`Notification triggered: ${eventType} for ${entityId}`);
    } else {
      console.warn(`Failed to trigger notification: ${await response.text()}`);
    }
  } catch (error) {
    console.error("Error triggering notification:", error);
    // Don't fail the main operation if notification fails
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

  try {
    const body: CaseAssignerRequest = await req.json();

    // Validate required fields
    if (!body.alert_id || typeof body.alert_id !== "number") {
      return new Response(
        JSON.stringify({ success: false, error: "alert_id is required and must be a number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch alert with outlet and region info
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .select(`
        *,
        outlets (
          id,
          name,
          code,
          region_id,
          franchisee_id,
          regions (
            id,
            name,
            code
          )
        )
      `)
      .eq("id", body.alert_id)
      .single();

    if (alertError || !alert) {
      return new Response(
        JSON.stringify({ success: false, error: `Alert ${body.alert_id} not found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alertInfo = alert as unknown as AlertInfo;

    // Check if case already exists for this alert
    const { data: existingCase } = await supabase
      .from("cases")
      .select("id, assigned_to_id, status")
      .eq("alert_id", body.alert_id)
      .single();

    if (existingCase && !body.force) {
      // Get assignee name
      let assignedToName = "Unknown";
      if (existingCase.assigned_to_id) {
        const { data: assignee } = await supabase
          .from("user_profiles")
          .select("full_name")
          .eq("id", existingCase.assigned_to_id)
          .single();
        assignedToName = assignee?.full_name || "Unknown";
      }

      return new Response(
        JSON.stringify({
          success: false,
          reason: "case_exists",
          error: "Case already exists for this alert",
          existing_case_id: existingCase.id,
          assigned_to: existingCase.assigned_to_id,
          assigned_to_name: assignedToName,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if alert is in a valid status for case creation
    if (alertInfo.status === "RESOLVED" || alertInfo.status === "CLOSED") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cannot create case for resolved/closed alert (status: ${alertInfo.status})`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply assignment rules
    const assignment = await applyAssignmentRules(supabase, alertInfo);

    if (!assignment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No suitable assignee found for this alert",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user: assignee, rule: assignmentRule } = assignment;

    // Calculate SLA deadline
    const slaDeadline = calculateSLADeadline(alertInfo.severity);
    const casePriority = mapSeverityToCasePriority(alertInfo.severity);

    // If force=true and case exists, update existing case
    let caseId: number;
    let isNewCase = false;

    if (existingCase && body.force) {
      // Update existing case
      const { data: updatedCase, error: updateError } = await supabase
        .from("cases")
        .update({
          assigned_to_id: assignee.id,
          priority: casePriority,
          sla_deadline: slaDeadline,
          status: existingCase.status === "NEW" ? "NEW" : existingCase.status,
        })
        .eq("id", existingCase.id)
        .select("id")
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update case: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      caseId = updatedCase.id;
      isNewCase = false;
    } else {
      // Create new case
      const { data: newCase, error: createError } = await supabase
        .from("cases")
        .insert({
          alert_id: body.alert_id,
          title: alertInfo.title,
          description: alertInfo.description,
          priority: casePriority,
          assigned_to_id: assignee.id,
          status: "NEW",
          sla_deadline: slaDeadline,
        })
        .select("id")
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create case: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      caseId = newCase.id;
      isNewCase = true;

      // Update alert status to acknowledge it
      await supabase
        .from("alerts")
        .update({
          status: "ACKNOWLEDGED",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", body.alert_id);
    }

    // Trigger notification for case assignment
    await triggerNotification(
      supabaseUrl,
      supabaseServiceKey,
      isNewCase ? "CASE_ASSIGNED" : "CASE_UPDATED",
      caseId
    );

    console.log(`Case ${caseId} ${isNewCase ? "created" : "updated"} and assigned to ${assignee.full_name} (${assignmentRule})`);

    const response: CaseAssignerResponse = {
      success: true,
      case_id: caseId,
      assigned_to: assignee.id,
      assigned_to_name: assignee.full_name,
      assignment_rule: assignmentRule,
      sla_deadline: slaDeadline,
      case_priority: casePriority,
    };

    return new Response(JSON.stringify(response), {
      status: isNewCase ? 201 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Case assigner error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
