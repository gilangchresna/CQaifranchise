// Apply RLS Fix Edge Function
// Executes SQL to fix RLS policies

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any = { success: [], errors: [] };

    // 1. Fix cases RLS
    const { error: casesErr } = await supabase.rpc("exec", {
      sql: `
        ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Service role full access cases" ON public.cases;
        DROP POLICY IF EXISTS "Allow read cases" ON public.cases;
        CREATE POLICY "Service role full access cases" ON public.cases FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY "Allow read cases authenticated" ON public.cases FOR SELECT TO authenticated USING (true);
      `
    });
    
    if (casesErr) {
      results.errors.push({ table: "cases", error: casesErr.message });
    } else {
      results.success.push({ table: "cases", action: "RLS policies applied" });
    }

    // 2. Fix alerts RLS
    const { error: alertsErr } = await supabase.rpc("exec", {
      sql: `
        ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Service role full access alerts" ON public.alerts;
        DROP POLICY IF EXISTS "Allow read alerts" ON public.alerts;
        CREATE POLICY "Service role full access alerts" ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY "Allow read alerts authenticated" ON public.alerts FOR SELECT TO authenticated USING (true);
      `
    });
    
    if (alertsErr) {
      results.errors.push({ table: "alerts", error: alertsErr.message });
    } else {
      results.success.push({ table: "alerts", action: "RLS policies applied" });
    }

    return new Response(JSON.stringify({
      status: "completed",
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
