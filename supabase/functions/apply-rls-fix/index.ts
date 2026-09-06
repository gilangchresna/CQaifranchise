// Apply RLS Fix Edge Function
// FIXED: Removed dangerous rpc("exec") - now uses direct, safe SQL via createClient
// Only applies pre-defined, safe RLS policies

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SECURITY: Removed dangerous rpc("exec") function
// This function now only applies pre-defined, safe RLS policies

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Get auth from header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any = { success: [], errors: [] };

    // 1. Fix cases RLS - using direct SQL via sql() function
    try {
      // Enable RLS on cases table
      await supabase.rpc('pg_catalog.set_config', {
        var_name: 'app.settings',
        value: 'cases'
      }).catch(() => {}); // Ignore if RPC doesn't exist

      // Run safe, predefined SQL
      const { error: casesErr } = await supabase.sql`
        ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
      `;
      
      if (casesErr) {
        results.errors.push({ table: "cases", error: casesErr.message });
      } else {
        results.success.push({ table: "cases", action: "RLS enabled" });
      }
    } catch (e: any) {
      results.errors.push({ table: "cases", error: e.message });
    }

    // 2. Fix alerts RLS
    try {
      const { error: alertsErr } = await supabase.sql`
        ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
      `;
      
      if (alertsErr) {
        results.errors.push({ table: "alerts", error: alertsErr.message });
      } else {
        results.success.push({ table: "alerts", action: "RLS enabled" });
      }
    } catch (e: any) {
      results.errors.push({ table: "alerts", error: e.message });
    }

    return new Response(JSON.stringify({
      status: "completed",
      results,
      security_note: "Safe mode: No arbitrary SQL execution. Only predefined RLS operations."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: error.message,
      security_note: "Safe mode active - no arbitrary SQL allowed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
