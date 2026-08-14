/// <reference lib="deno.ns" />
/**
 * Alerts List Edge Function
 * SECURITY: Requires authentication
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

  // SECURITY: Verify authentication (service role bypass allowed)
  const auth = await verifyAuth(req, true);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // C9: Filter alerts by user scope — show non-RESOLVED only
  // Note: FK embedding removed — PostgREST schema cache stale, manual join in service role instead
  let query = supabase
    .from('alerts')
    .select('id, outlet_id, type, severity, status, title, description, score, triggered_at, created_at')
    .neq('status', 'RESOLVED') // C9: exclude resolved
    .order('created_at', { ascending: false })
    .limit(100);

  if (auth.role === 'FRANCHISEE_OWNER' || auth.role === 'FRANCHISEE_STAFF') {
    const { data: userOutlets } = await supabase
      .from("user_outlets").select("outlet_id")
      .eq("user_id", auth.user?.id);
    const userOutletIds = (userOutlets || []).map((r: any) => r.outlet_id);
    if (userOutletIds.length > 0) {
      query = query.in('outlet_id', userOutletIds);
    }
  }
  // HQ_ADMIN and REGIONAL_MANAGER: no filter — see all non-resolved alerts

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  // Manual join: fetch outlet names since FK embedding broken in PostgREST schema cache
  const outletIds = [...new Set((data || []).map((a: any) => a.outlet_id).filter(Boolean))];
  let outletMap: Record<number, { name: string; code: string }> = {};
  if (outletIds.length > 0) {
    const { data: outlets } = await supabase
      .from('outlets').select('id, name, code')
      .in('id', outletIds);
    if (outlets) {
      for (const o of outlets) {
        outletMap[o.id] = { name: o.name, code: o.code };
      }
    }
  }

  // Enrich alerts with outlet info
  const enriched = (data || []).map((alert: any) => ({
    ...alert,
    outlet: outletMap[alert.outlet_id] || { name: 'Unknown Outlet', code: '?' }
  }));

  return Response.json({
    data: enriched,
    total: enriched.length
  }, { headers: corsHeaders });
});
