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

  const auth = await verifyAuth(req, true);
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
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  // Build scoped query — NO FK embedding (PostgREST schema cache stale)
  // NOTE: cases table has: id, alert_id, assigned_to_id, title, description, priority, status, sla_deadline, resolved_at, created_at, updated_at
  let query = supabase
    .from("cases")
    .select(`
      id,
      alert_id,
      assigned_to_id,
      title,
      description,
      priority,
      status,
      sla_deadline,
      resolved_at,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Role-based filtering (C9)
  // NOTE: cases table has alert_id (not source_alert_id), NO outlet_id
  // FRANCHISEE sees cases via: (1) their alerts' outlets OR (2) assigned to them
  if (auth.role === 'FRANCHISEE_OWNER' || auth.role === 'FRANCHISEE_STAFF') {
    const userId = auth.userId;
    
    // First: check cases assigned directly to this user
    const { data: assignedCases } = await supabase
      .from("cases")
      .select("id")
      .eq("assigned_to_id", userId);
    const assignedCaseIds = (assignedCases || []).map((c: any) => c.id);
    
    // Second: check cases via their alerts' outlets
    const { data: userOutlets } = await supabase
      .from("user_outlets").select("outlet_id")
      .eq("user_id", userId);
    const userOutletIds = (userOutlets || []).map((r: any) => r.outlet_id);
    
    let alertIds: number[] = [];
    if (userOutletIds.length > 0) {
      const { data: userAlerts } = await supabase
        .from("alerts").select("id").in("outlet_id", userOutletIds);
      alertIds = (userAlerts || []).map((a: any) => a.id);
    }
    
    // Combine: cases assigned to user OR cases linked to user's outlet alerts
    if (assignedCaseIds.length > 0 || alertIds.length > 0) {
      // Use OR filter - cases where alert_id in user's alert IDs OR assigned_to_id = user ID
      const orFilter = `assigned_to_id.eq.${userId}${alertIds.length > 0 ? `,alert_id.in.(${alertIds.join(',')})` : ''}`;
      query = query.or(orFilter);
    } else {
      return Response.json({ data: [], total: 0, counts: {} }, { headers: corsHeaders });
    }
  }
  // HQ_ADMIN and REGIONAL_MANAGER: no outlet filter

  // Apply filters
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (assigneeId) query = query.eq("assigned_to_id", assigneeId);
  // outletId: not available directly on cases — skip for now

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  // Manual join: fetch related data since FK embedding broken in PostgREST schema cache
  // NOTE: cases table has alert_id (not source_alert_id), NO outlet_id
  const allIds = {
    assigneeIds: [...new Set((data || []).map((c: any) => c.assigned_to_id).filter(Boolean))],
    alertIds: [...new Set((data || []).map((c: any) => c.alert_id).filter(Boolean))],
  };

  const [assignees, alerts] = await Promise.all([
    allIds.assigneeIds.length > 0
      ? supabase.from("user_profiles").select("id, full_name, role").in("id", allIds.assigneeIds)
      : { data: [] },
    allIds.alertIds.length > 0
      ? supabase.from("alerts").select("id, type, severity").in("id", allIds.alertIds)
      : { data: [] },
  ]);

  const assigneeMap: Record<string, any> = {};
  (assignees.data || []).forEach((u: any) => { assigneeMap[u.id] = u; });
  const alertMap: Record<number, any> = {};
  (alerts.data || []).forEach((a: any) => { alertMap[a.id] = a; });

  // Enrich cases
  const enriched = (data || []).map((c: any) => ({
    ...c,
    assignee: assigneeMap[c.assigned_to_id] || null,
    alert: alertMap[c.alert_id] || null,
  }));

  // Count by status for summary
  const { count: totalCount } = await supabase
    .from("cases").select("*", { count: "exact", head: true });

  const statusCounts: Record<string, number> = {};
  for (const c of enriched) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  }

  return Response.json({
    data: enriched,
    total: totalCount ?? 0,
    counts: statusCounts,
  }, { headers: corsHeaders });
});
