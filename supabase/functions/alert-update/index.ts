// Update Alert Status Edge Function
// PATCH endpoint - updates alert status and handles case resolution

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateAlertRequest {
  alert_id: number;
  new_status: "NEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  resolution_notes?: string;
}

const VALID_STATUSES = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

// Status transition rules
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["ACKNOWLEDGED", "IN_PROGRESS", "CLOSED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"], // Can reopen
  CLOSED: [], // Terminal state (except for admin override)
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { alert_id, new_status, resolution_notes }: UpdateAlertRequest = await req.json();

    // Validate required fields
    if (!alert_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: alert_id, new_status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate status value
    if (!VALID_STATUSES.includes(new_status)) {
      return new Response(
        JSON.stringify({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch current alert
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .select("*")
      .eq("id", alert_id)
      .single();

    if (alertError || !alert) {
      return new Response(
        JSON.stringify({ error: "Alert not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const previousStatus = alert.status;

    // Check if transition is allowed
    if (!ALLOWED_TRANSITIONS[previousStatus]?.includes(new_status)) {
      return new Response(
        JSON.stringify({
          error: `Invalid status transition from ${previousStatus} to ${new_status}`,
          allowed_transitions: ALLOWED_TRANSITIONS[previousStatus] || [],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: new_status,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on new status
    if (new_status === "ACKNOWLEDGED" && !alert.acknowledged_at) {
      updatePayload.acknowledged_at = new Date().toISOString();
    }
    if (new_status === "RESOLVED" && !alert.resolved_at) {
      updatePayload.resolved_at = new Date().toISOString();
    }

    // Update the alert
    const { data: updatedAlert, error: updateError } = await supabase
      .from("alerts")
      .update(updatePayload)
      .eq("id", alert_id)
      .select()
      .single();

    if (updateError) {
      console.error("Alert update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update alert", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Handle related case update if alert is resolved
    let caseUpdateResult: { case_id: number; status: string } | null = null;

    if (new_status === "RESOLVED") {
      // Find the related case
      const { data: relatedCase, error: caseError } = await supabase
        .from("cases")
        .select("id, status")
        .eq("alert_id", alert_id)
        .single();

      if (relatedCase) {
        const { data: updatedCase, error: caseUpdateError } = await supabase
          .from("cases")
          .update({
            status: "RESOLVED",
            resolution_notes: resolution_notes || `Resolved via alert status change to ${new_status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", relatedCase.id)
          .select("id, status")
          .single();

        if (caseUpdateError) {
          console.error("Case update error:", caseUpdateError);
        } else {
          caseUpdateResult = {
            case_id: updatedCase.id,
            status: updatedCase.status,
          };
        }
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        alert_id,
        previous_status: previousStatus,
        new_status,
        resolved_at: updatedAlert.resolved_at,
        updated_at: updatedAlert.updated_at,
        related_case: caseUpdateResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Alert update error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
