/// <reference lib="deno.ns" />

/**
 * Staff List Edge Function
 * Lists staff members from staff table
 *
 * GET /functions/v1/staff-list
 * Query params: ?region_id=1&outlet_id=37&status=ACTIVE
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

  // Use service role for all queries (simplified auth for demo)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const outletId = url.searchParams.get("outlet_id");
    const status = url.searchParams.get("status");
    const regionId = url.searchParams.get("region_id");

    let query = supabase
      .from("staff")
      .select(`
        *,
        outlets (
          id,
          name,
          code,
          regions (
            id,
            name
          )
        )
      `);

    if (outletId) {
      query = query.eq("outlet_id", parseInt(outletId));
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: staff, error } = await query.order("name");

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform data for frontend
    const transformedStaff = (staff || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      outlet_id: s.outlet_id,
      outlet_name: s.outlets?.name,
      outlet_code: s.outlets?.code,
      region: s.outlets?.regions?.name,
      region_id: s.outlets?.regions?.id,
      phone: s.phone,
      status: s.is_active ? "ACTIVE" : "OFF_DUTY",
      created_at: s.created_at,
    }));

    // Filter by region if needed (client-side for now)
    let filteredStaff = transformedStaff;
    if (regionId) {
      filteredStaff = transformedStaff.filter((s: any) => s.region_id === parseInt(regionId));
    }

    return new Response(
      JSON.stringify({
        staff: filteredStaff,
        total: filteredStaff.length,
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
