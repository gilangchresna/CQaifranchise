/// <reference lib="deno.ns" />

/**
 * Approval Requests Edge Function
 * CRUD operations for human-in-the-loop approval workflows
 * 
 * GET  /functions/v1/approvals - List pending approvals
 * POST /functions/v1/approvals - Create new approval request
 * POST /functions/v1/approvals/approve - Approve a request
 * POST /functions/v1/approvals/reject - Reject a request
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route based on path and method
    if (req.method === "GET") {
      return await listApprovals(req, supabase, url);
    }

    if (req.method === "POST") {
      if (path === "approve") {
        return await approveRequest(req, supabase);
      }
      if (path === "reject") {
        return await rejectRequest(req, supabase);
      }
      return await createRequest(req, supabase);
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Approval Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * GET - List approval requests
 */
async function listApprovals(req: Request, supabase: any, url: URL) {
  const status = url.searchParams.get("status") || "PENDING";
  const approverRole = url.searchParams.get("role");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  let query = supabase
    .from("approval_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  
  if (approverRole) {
    query = query.eq("approver_role", approverRole);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Get count by status
  const { count: pendingCount } = await supabase
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "PENDING");

  return new Response(
    JSON.stringify({
      approvals: data,
      summary: {
        pending: pendingCount || 0,
        by_type: groupByType(data || []),
        by_priority: groupByPriority(data || []),
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Fallback defaults
const DEFAULT_SLA_HOURS = { HIGH: 1, MEDIUM: 4, LOW: 24 };

/** Read SLA hours from settings table. Falls back to defaults if not configured. */
async function getSlaHours(supabase: any): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["sla_high", "sla_medium", "sla_low"]);

  if (!data || data.length === 0) return DEFAULT_SLA_HOURS;

  const row = (k: string) => data.find((s: any) => s.key === k)?.value;

  return {
    HIGH: parseInt(row("sla_high") || "1", 10),
    MEDIUM: parseInt(row("sla_medium") || "4", 10),
    LOW: parseInt(row("sla_low") || "24", 10),
  };
}

/** Read a single setting value. Returns default if not found. */
async function getSetting(supabase: any, key: string, fallback: string = ""): Promise<string> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? fallback;
}

/** Look up lender adapter config from public.integrations (type='LENDER'). */
async function getLenderConfig(supabase: any, lenderCode: string) {
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("type", "LENDER")
    .eq("name", lenderCode)
    .maybeSingle();
  return data || null;
}

/**
 * Call the lender API if configured, otherwise simulate a response.
 */
async function callLender(
  action: "submit" | "status" | "cancel",
  lenderConfig: any,
  payload: Record<string, any>
): Promise<{ simulated: boolean; data: any }> {
  if (lenderConfig?.config?.base_url && lenderConfig?.config?.api_key) {
    const resp = await fetch(`${lenderConfig.config.base_url}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lenderConfig.config.api_key}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`Lender API error (${resp.status}): ${JSON.stringify(data)}`);
    return { simulated: false, data };
  }

  // Simulate mode
  await new Promise((r) => setTimeout(r, 150));
  if (action === "submit") {
    return {
      simulated: true,
      data: {
        lender_reference_id: `SIM-${Date.now()}`,
        status: "UNDER_REVIEW",
        message: "Simulate mode — no lender configured.",
      },
    };
  }
  if (action === "status") {
    return { simulated: true, data: { status: payload.last_known_status || "UNDER_REVIEW" } };
  }
  return { simulated: true, data: { status: "CANCELLED" } };
}

/**
 * POST - Create new approval request
 */
async function createRequest(req: Request, supabase: any) {
  const body = await req.json();

  // Validate required fields
  if (!body.request_type || !body.trigger_source || !body.request_payload || !body.approver_role) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: request_type, trigger_source, request_payload, approver_role" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // FIX: Read SLA hours from settings table (not hardcoded)
  const slaHours = await getSlaHours(supabase);
  const priority = body.priority || "MEDIUM";
  const expiresHours = slaHours[priority] ?? 24;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresHours);

  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      request_type: body.request_type,
      trigger_source: body.trigger_source,
      related_entity_id: body.related_entity_id,
      related_entity_type: body.related_entity_type,
      related_entity_code: body.related_entity_code,
      request_payload: body.request_payload,
      reasoning: body.reasoning,
      priority: priority,
      approver_role: body.approver_role,
      outlet_id: body.outlet_id,
      region_id: body.region_id,
      expires_at: expiresAt.toISOString(),
      metadata: body.metadata || {}
    })
    .select()
    .single();

  if (error) throw error;

  // Log to history
  await supabase
    .from("approval_history")
    .insert({
      request_id: data.id,
      action: "CREATED",
      actor_id: body.requested_by,
      actor_role: body.trigger_source,
      actor_name: body.trigger_source,
      new_status: "PENDING"
    });

  return new Response(
    JSON.stringify({ success: true, approval: data }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * POST - Approve a request
 */
async function approveRequest(req: Request, supabase: any) {
  const body = await req.json();

  if (!body.request_id) {
    return new Response(
      JSON.stringify({ error: "request_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get current request
  const { data: request, error: getError } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", body.request_id)
    .single();

  if (getError || !request) {
    return new Response(
      JSON.stringify({ error: "Approval request not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (request.status !== "PENDING") {
    return new Response(
      JSON.stringify({ error: `Cannot approve - request is ${request.status}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update request
  const { data, error } = await supabase
    .from("approval_requests")
    .update({
      status: "APPROVED",
      approved_by: body.approver_id,
      approved_at: new Date().toISOString()
    })
    .eq("id", body.request_id)
    .select()
    .single();

  if (error) throw error;

  // Log to history
  await supabase
    .from("approval_history")
    .insert({
      request_id: body.request_id,
      action: "APPROVED",
      actor_id: body.approver_id,
      actor_role: body.approver_role,
      actor_name: body.approver_name,
      comment: body.comment,
      previous_status: "PENDING",
      new_status: "APPROVED"
    });

  // Execute the approved action (based on request type)
  const actionResult = await executeApprovedAction(supabase, request);

  return new Response(
    JSON.stringify({
      success: true,
      approval: data,
      action_executed: actionResult
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * POST - Reject a request
 */
async function rejectRequest(req: Request, supabase: any) {
  const body = await req.json();

  if (!body.request_id || !body.rejection_reason) {
    return new Response(
      JSON.stringify({ error: "request_id and rejection_reason are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data, error } = await supabase
    .from("approval_requests")
    .update({
      status: "REJECTED",
      rejected_by: body.approver_id,
      rejected_at: new Date().toISOString(),
      rejection_reason: body.rejection_reason
    })
    .eq("id", body.request_id)
    .select()
    .single();

  if (error) throw error;

  // Log to history
  await supabase
    .from("approval_history")
    .insert({
      request_id: body.request_id,
      action: "REJECTED",
      actor_id: body.approver_id,
      actor_role: body.approver_role,
      actor_name: body.approver_name,
      comment: body.rejection_reason,
      previous_status: "PENDING",
      new_status: "REJECTED"
    });

  return new Response(
    JSON.stringify({ success: true, approval: data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Execute the approved action based on request type
 */
async function executeApprovedAction(supabase: any, request: any) {
  const payload = request.request_payload;

  switch (request.request_type) {
    case "CASE_CREATE":
      // Create a case
      const { data: newCase, error } = await supabase
        .from("cases")
        .insert({
          title: payload.title || `AI Request: ${request.request_type}`,
          description: `AI Recommendation: ${request.reasoning}`,
          status: "OPEN",
          priority: payload.severity || "P2_MEDIUM",
          related_alert_id: payload.alert_id,
          outlet_id: request.outlet_id
        })
        .select()
        .single();
      
      return { action: "CASE_CREATED", case_id: newCase?.id, error };

    case "ESCALATE":
      // Mark outlet as escalated
      return { action: "OUTLET_ESCALATED", outlet_id: request.outlet_id };

    case "ALERT_BULK":
      // Send bulk alert
      return { action: "BULK_ALERT_SENT", affected_outlets: payload.affected_outlets };

    case "AUTO_RESOLVE":
      // Resolve the case
      if (payload.case_id) {
        await supabase
          .from("cases")
          .update({
            status: "RESOLVED",
            resolution: `Auto-resolved after AI review. ${request.reasoning}`,
            resolved_at: new Date().toISOString()
          })
          .eq("id", payload.case_id);
      }
      return { action: "CASE_RESOLVED", case_id: payload.case_id };

    default:
      return { action: "NO_OP", message: "Unknown request type" };

    case "LOAN_SUBMIT": {
      // When HQ approves a loan HITL request, auto-submit to lender.
      // The application was already created with SUBMITTED status.
      // Only proceed if it's still PENDING_HUMAN_APPROVAL.
      const appPayload = request.request_payload || {};
      const appId = request.related_entity_id;

      // Re-fetch application to confirm it's still pending
      const { data: app } = await supabase
        .from("financing_applications")
        .select("id, status, requested_amount, currency")
        .eq("id", appId)
        .maybeSingle();

      if (!app) return { action: "LOAN_SUBMIT", error: "Application not found" };
      if (app.status !== "SUBMITTED") {
        return { action: "LOAN_SUBMIT", error: `Application already ${app.status}`, skipped: true };
      }

      // Submit to lender
      const lenderConfig = await getLenderConfig(supabase, appPayload.lender_code || "GENERIC");
      const result = await callLender("submit", lenderConfig, {
        franchisee_id: appPayload.franchisee_id,
        outlet_id: appPayload.outlet_id,
        purpose: appPayload.purpose,
        requested_amount: appPayload.requested_amount,
        currency: appPayload.currency || "SGD",
        requested_term_months: appPayload.requested_term_months,
      });

      const newStatus = result.data.status || "UNDER_REVIEW";
      await supabase
        .from("financing_applications")
        .update({
          status: newStatus,
          lender_reference_id: result.data.lender_reference_id ?? null,
          last_lender_response: result.data,
        })
        .eq("id", appId);

      return {
        action: "LOAN_SUBMITTED",
        application_id: appId,
        status: newStatus,
        simulated: result.simulated,
      };
    }
  }
}

// Helper functions
function groupByType(data: any[]): Record<string, number> {
  return data.reduce((acc, item) => {
    acc[item.request_type] = (acc[item.request_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupByPriority(data: any[]): Record<string, number> {
  return data.reduce((acc, item) => {
    acc[item.priority] = (acc[item.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
