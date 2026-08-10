// Create Case Edge Function
// POST endpoint - creates a case from an alert and updates alert status

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cqaifranchise.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaseRequest {
  alert_id: number;
  title: string;
  description?: string;
  assigned_to_id?: string;
  priority?: "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
}

// Map alert severity (P0_CRITICAL, P1_HIGH, etc.) to case priority (URGENT, HIGH, MEDIUM, LOW)
function mapAlertSeverityToCasePriority(severity: string): "URGENT" | "HIGH" | "MEDIUM" | "LOW" {
  const mapping: Record<string, "URGENT" | "HIGH" | "MEDIUM" | "LOW"> = {
    "P0_CRITICAL": "URGENT",
    "P1_HIGH": "HIGH",
    "P2_MEDIUM": "MEDIUM",
    "P3_LOW": "LOW",
  };
  return mapping[severity] || "MEDIUM";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { alert_id, title, description, assigned_to_id, priority }: CaseRequest =
      await req.json();

    // Validate required fields
    if (!alert_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: alert_id, title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate priority if provided
    if (priority && !["P0_CRITICAL", "P1_HIGH", "P2_MEDIUM", "P3_LOW"].includes(priority)) {
      return new Response(
        JSON.stringify({
          error: "Invalid priority. Must be P0_CRITICAL, P1_HIGH, P2_MEDIUM, or P3_LOW",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the alert
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

    // Check if case already exists for this alert
    const { data: existingCase } = await supabase
      .from("cases")
      .select("id")
      .eq("alert_id", alert_id)
      .single();

    if (existingCase) {
      return new Response(
        JSON.stringify({
          error: "Case already exists for this alert",
          existing_case_id: existingCase.id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate assigned_to_id if provided
    if (assigned_to_id) {
      const { data: assignee, error: assigneeError } = await supabase
        .from("user_profiles")
        .select("id, full_name, role")
        .eq("id", assigned_to_id)
        .single();

      if (assigneeError || !assignee) {
        return new Response(
          JSON.stringify({ error: "Assignee user not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Calculate SLA deadline based on priority
    const slaHours: Record<string, number> = {
      P0_CRITICAL: 4,
      P1_HIGH: 24,
      P2_MEDIUM: 72,
      P3_LOW: 168, // 1 week
    };
    const alertSeverity = priority || alert.severity;
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + (slaHours[alertSeverity] || 72));

    // Map alert severity to case priority
    const casePriority = mapAlertSeverityToCasePriority(alertSeverity);

    // Create the case
    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        alert_id,
        title,
        description: description || alert.description,
        priority: casePriority,
        assigned_to_id,
        status: "NEW",
        sla_deadline: slaDeadline.toISOString(),
      })
      .select()
      .single();

    if (caseError) {
      console.error("Case creation error:", caseError);
      return new Response(
        JSON.stringify({ error: "Failed to create case", details: caseError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update alert status to IN_PROGRESS
    const { error: alertUpdateError } = await supabase
      .from("alerts")
      .update({
        status: "IN_PROGRESS",
        acknowledged_at: alert.acknowledged_at || new Date().toISOString(),
      })
      .eq("id", alert_id);

    if (alertUpdateError) {
      console.error("Alert update error:", alertUpdateError);
      // Don't fail - case was created successfully
    }

    return new Response(
      JSON.stringify({
        case_id: newCase.id,
        alert_id,
        status: newCase.status,
        priority: newCase.priority,
        sla_deadline: newCase.sla_deadline,
        created_at: newCase.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Case creation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
