/// <reference lib="deno.ns" />
/**
 * Reset Password - Admin helper
 * Sends password reset email to user
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
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = authUser?.users.find(u => u.email === email);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found in auth.users. User must be invited first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send password reset email
    const { error: resetError } = await supabase.auth.admin.resetPasswordForEmail(email);

    if (resetError) {
      return new Response(
        JSON.stringify({ error: resetError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Password reset email sent to ${email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
