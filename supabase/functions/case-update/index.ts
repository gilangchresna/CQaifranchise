/// <reference lib="deno.ns" />

/**
 * Case Update Edge Function
 * Updates case status: RESOLVED, REJECTED, ESCALATED
 * 
 * POST /functions/v1/case-update
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaseUpdateRequest {
  case_id: number;
  status: "RESOLVED" | "REJECTED" | "ESCALATED" | "CLOSED";
  notes?: string;
  resolved_by?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: CaseUpdateRequest = await req.json();

    if (!body.case_id || !body.status) {
      return new Response(
        JSON.stringify({ error: "case_id and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current case
    const { data: currentCase, error: fetchError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", body.case_id)
      .single();

    if (fetchError || !currentCase) {
      return new Response(
        JSON.stringify({ error: "Case not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update payload
    const updateData: any = {
      status: body.status,
      updated_at: new Date().toISOString(),
    };

    // Add resolved_at if resolving/closing
    if (body.status === "RESOLVED" || body.status === "CLOSED") {
      updateData.resolved_at = new Date().toISOString();
      if (body.resolved_by) {
        updateData.resolved_by = body.resolved_by;
      }
    }

    // Add notes if provided
    if (body.notes) {
      updateData.notes = body.notes;
    }

    // Update case
    const { data: updatedCase, error: updateError } = await supabase
      .from("cases")
      .update(updateData)
      .eq("id", body.case_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating case:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update case" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If closing/resolved, also update linked alert
    if (body.status === "RESOLVED" || body.status === "CLOSED") {
      await supabase
        .from("alerts")
        .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
        .eq("id", currentCase.alert_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        case_id: body.case_id,
        status: body.status,
        updated_case: updatedCase,
        message: `Case ${body.case_id} updated to ${body.status}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
