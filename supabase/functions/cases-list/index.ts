/// <reference lib="deno.ns" />
/**
 * Cases List Edge Function
 * SECURITY: Requires authentication
 * GET ?status=&priority=&assignee_id=&limit=100
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Parse query params
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const assigneeId = url.searchParams.get("assignee_id");
  const outletId = url.searchParams.get("outlet_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  // Build scoped query
  let query = supabase
    .from("cases")
    .select(`
      id,
      title,
      description,
      type,
      priority,
      status,
      created_at,
      updated_at,
      sla_deadline,
      resolved_at,
      assigned_to_id,
      outlet_id,
      source_alert_id,
      assignee:user_profiles!assigned_to_id (
        id,
        full_name,
        role
      ),
      alert:alerts (
        id,
        type,
        severity
      ),
      outlet:outlets (
        id,
        name,
        code,
        region_id
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Role-based filtering (C9)
  if (auth.role === 'FRANCHISEE_OWNER' || auth.role === 'FRANCHISEE_STAFF') {
    const { data: userOutlets } = await supabase
      .from("user_outlets").select("outlet_id")
      .eq("user_id", auth.user?.id);
    const userOutletIds = (userOutlets || []).map((r: any) => r.outlet_id);
    if (userOutletIds.length > 0) {
      query = query.in("outlet_id", userOutletIds);
    } else {
      // No outlets assigned — return empty
      return Response.json({ data: [], total: 0 }, { headers: corsHeaders });
    }
  } else if (auth.role === 'REGIONAL_MANAGER') {
    const userRegion = auth.user?.user_metadata?.region_id;
    if (userRegion) {
      query = query.eq("outlets.region_id", userRegion);
    }
  }
  // HQ_ADMIN: no outlet filter

  // Apply filters
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (assigneeId) query = query.eq("assigned_to_id", assigneeId);
  if (outletId) query = query.eq("outlet_id", parseInt(outletId));

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  // Count by status for summary
  const { count: totalCount } = await supabase
    .from("cases").select("*", { count: "exact", head: true });

  const statusCounts: Record<string, number> = {};
  for (const c of (data || [])) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  }

  return Response.json({
    data: data || [],
    total: totalCount ?? 0,
    counts: statusCounts,
  }, { headers: corsHeaders });
});
