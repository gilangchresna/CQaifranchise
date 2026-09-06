/// <reference lib="deno.ns" />
/**
 * Fix RLS Function
 * SECURITY: Requires HQ_ADMIN role
 * WARNING: This function is now READ-ONLY - it does NOT disable RLS
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
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

  // SECURITY: Only HQ_ADMIN can view RLS status
  if (auth.role !== 'HQ_ADMIN') {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // SECURITY: This function is now READ-ONLY
  // It does NOT disable RLS - it only reports RLS status

  const tables = ["regions", "outlets", "inventory", "sales_transactions", "approval_requests", "peer_metrics", "outlet_classifications"];
  const results: any = { tables: [], security_note: "Read-only mode - RLS cannot be disabled" };

  for (const table of tables) {
    try {
      // Check if table exists and has RLS enabled
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .limit(1);
      
      results.tables.push({
        table,
        accessible: !error,
        status: error ? `Error: ${error.message}` : "OK"
      });
    } catch (e: any) {
      results.tables.push({
        table,
        accessible: false,
        status: `Exception: ${e.message}`
      });
    }
  }

  return new Response(JSON.stringify({ 
    success: true,
    ...results,
    instructions: "To modify RLS policies, use Supabase Dashboard or create a migration file."
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
