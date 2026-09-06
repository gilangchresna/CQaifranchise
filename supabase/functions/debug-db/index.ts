// Debug Function - Check Database State
// SECURITY: Requires HQ_ADMIN role

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, unauthorizedResponse, forbiddenResponse } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SECURITY: Verify authentication
  const auth = await verifyAuth(req);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  // SECURITY: Only HQ_ADMIN can access debug info
  if (auth.role !== 'HQ_ADMIN') {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results: any = {};

  // Check each table
  const tables = ["regions", "outlets", "user_profiles", "sales_transactions", "alerts", "pilot_outreach"];

  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    results[table] = { count: count || 0, error: error?.message || null };
  }

  return new Response(JSON.stringify({ 
    results,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
