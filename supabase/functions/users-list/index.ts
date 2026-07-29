/// <reference lib="deno.ns" />

/**
 * Users List Edge Function
 * Lists users from user_profiles table
 *
 * GET /functions/v1/users-list
 * Query params: ?role=HQ_ADMIN&region_id=1&is_active=true
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Use service role for all queries (simplified auth for demo)
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const regionId = url.searchParams.get("region_id");
    const isActive = url.searchParams.get("is_active");

    let query = supabase
      .from("user_profiles")
      .select(`
        *,
        regions (
          id,
          name,
          code
        )
      `);

    if (role) {
      query = query.eq("role", role);
    }
    if (regionId) {
      query = query.eq("region_id", parseInt(regionId));
    }
    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    const { data: users, error } = await query.order("full_name");

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform data for frontend
    const transformedUsers = (users || []).map((user: any) => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      region_id: user.region_id,
      region: user.regions?.name,
      region_code: user.regions?.code,
      is_active: user.is_active,
      created_at: user.created_at,
    }));

    return new Response(
      JSON.stringify({
        users: transformedUsers,
        total: transformedUsers.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
