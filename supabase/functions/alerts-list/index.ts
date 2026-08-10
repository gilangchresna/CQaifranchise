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

  // SECURITY: Verify authentication
  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // C9: Filter alerts by user scope — show non-RESOLVED only
  let query = supabase
    .from('alerts')
    .select('*, outlet(name, code, region:regions(name, code))')
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
  } else if (auth.role === 'REGIONAL_MANAGER') {
    const userRegion = auth.user?.user_metadata?.region_id;
    if (userRegion) {
      query = query.eq('outlets.region_id', userRegion);
    }
  }
  // HQ_ADMIN: no filter — sees all

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return Response.json({
    data: data || [],
    total: (data || []).length
  }, { headers: corsHeaders });
});
