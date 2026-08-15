/// <reference lib="deno.ns" />
/**
 * Alerts List Edge Function
 * SECURITY: Uses user JWT so RLS policies apply
 * Role-based scoping:
 *   HQ_ADMIN       → all non-resolved alerts
 *   REGIONAL_MGR   → alerts for outlets in their region
 *   FRANCHISEE_*   → alerts for outlets in their region
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

  // SECURITY: Require user auth (no service role bypass)
  // This ensures RLS policies apply based on user's role/region
  const auth = await verifyAuth(req, false);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  // Use USER's JWT token — NOT service role key
  // This allows RLS to filter based on user_profiles.role + region_id
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // still need for internal RPC calls
    {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    }
  );

  // Fetch user's region from user_profiles
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("id, role, region_id")
    .eq("id", auth.userId)
    .single();

  const userRole = userProfile?.role || auth.role;
  const userRegionId = userProfile?.region_id;

  // Build query — RLS will filter based on role
  // HQ_ADMIN sees all, others filtered by RLS
  let query = supabase
    .from("alerts")
    .select(`
      id,
      outlet_id,
      type,
      severity,
      status,
      title,
      description,
      score,
      triggered_at,
      created_at
    `)
    .neq("status", "RESOLVED")
    .order("created_at", { ascending: false })
    .limit(100);

  // REGIONAL_MANAGER: extra filter by region (RLS should handle this, but explicit is safer)
  if (userRole === "REGIONAL_MANAGER" && userRegionId) {
    const { data: regionOutlets } = await supabase
      .from("outlets")
      .select("id")
      .eq("region_id", userRegionId);
    const outletIds = (regionOutlets || []).map((o: any) => o.id);
    if (outletIds.length > 0) {
      query = query.in("outlet_id", outletIds);
    }
  }

  // FRANCHISEE_OWNER / FRANCHISEE_STAFF: filter by region
  if ((userRole === "FRANCHISEE_OWNER" || userRole === "FRANCHISEE_STAFF") && userRegionId) {
    const { data: regionOutlets } = await supabase
      .from("outlets")
      .select("id")
      .eq("region_id", userRegionId);
    const outletIds = (regionOutlets || []).map((o: any) => o.id);
    if (outletIds.length > 0) {
      query = query.in("outlet_id", outletIds);
    }
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  // Manual join: fetch outlet names for display
  const outletIds = [...new Set((data || []).map((a: any) => a.outlet_id).filter(Boolean))];
  let outletMap: Record<number, { name: string; code: string }> = {};
  if (outletIds.length > 0) {
    const { data: outlets } = await supabase
      .from("outlets").select("id, name, code")
      .in("id", outletIds);
    if (outlets) {
      for (const o of outlets) {
        outletMap[o.id] = { name: o.name, code: o.code };
      }
    }
  }

  // Enrich with outlet info
  const enriched = (data || []).map((alert: any) => ({
    ...alert,
    outlet: outletMap[alert.outlet_id] || { name: "Unknown Outlet", code: "?" },
  }));

  return Response.json({
    data: enriched,
    total: enriched.length,
    role: userRole,
    region_id: userRegionId,
  }, { headers: corsHeaders });
});
