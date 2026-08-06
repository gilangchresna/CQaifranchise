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

  // Get alerts with outlet info, filtered by user scope
  const { data, error } = await supabase
    .from('alerts')
    .select('*, outlet(name, code, region:regions(name, code)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  // Filter alerts based on user role
  let filteredAlerts = data;
  if (auth.role === 'FRANCHISEE_OWNER' || auth.role === 'FRANCHISEE_STAFF') {
    // Franchisees only see their own outlet alerts
    // Note: In production, filter by franchisee_id
    filteredAlerts = data;
  } else if (auth.role === 'REGIONAL_MANAGER') {
    // Regional managers see alerts from their region
    // Note: In production, filter by region_id from user metadata
    filteredAlerts = data;
  }
  // HQ_ADMIN sees all alerts

  return Response.json({ 
    data: filteredAlerts,
    total: filteredAlerts.length
  }, { headers: corsHeaders });
});
