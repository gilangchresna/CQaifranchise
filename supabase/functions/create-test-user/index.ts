/// <reference lib="deno.ns" />
/**
 * Create Test User - For RBAC testing only
 * Creates auth.user + links to user_profiles
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { email, password, user_profile_id } = await req.json();

    if (!email || !password || !user_profile_id) {
      return new Response(
        JSON.stringify({ error: "email, password, and user_profile_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user with specific ID
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      id: user_profile_id,
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { role: 'FRANCHISEE_OWNER' }
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: authUser }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
