/// <reference lib="deno.ns" />
/**
 * Case Update Edge Function
 * Updates a case: status, assignee, priority
 * SECURITY: Requires authentication
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const VALID_PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();
  const { case_id, status, priority, assigned_to_id, notes } = body;

  if (!case_id) {
    return Response.json({ error: "case_id required" }, { status: 400, headers: corsHeaders });
  }

  // Build update payload
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (status && VALID_STATUSES.includes(status)) {
    updates.status = status;
    if (status === "RESOLVED" || status === "CLOSED") {
      updates.resolved_at = new Date().toISOString();
    }
  }

  if (priority && VALID_PRIORITIES.includes(priority)) {
    updates.priority = priority;
  }

  if (assigned_to_id !== undefined) {
    updates.assigned_to_id = assigned_to_id || null;
  }

  // Perform update
  const { data, error } = await supabase
    .from("cases")
    .update(updates)
    .eq("id", case_id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  // Add notes if provided
  if (notes) {
    await supabase.from("case_notes").insert({
      case_id,
      content: notes,
      created_by: auth.user?.id,
    }).catch(() => {}); // non-critical
  }

  return Response.json({
    success: true,
    case: data,
  }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
