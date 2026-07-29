/// <reference lib="deno.ns" />

// Regions List - Serve regions data via service role
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Region {
  id: number;
  name: string;
  code: string;
  description: string | null;
}

interface OutletRow {
  region_id: number;
}

interface EnrichedRegion extends Region {
  outlet_count: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.substring(7);

  try {
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": supabaseServiceKey },
    });

    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: regions, error } = await supabase
      .from("regions")
      .select("id, name, code, description")
      .order("name");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get outlet count per region
    const { data: outlets } = await supabase
      .from("outlets")
      .select("region_id");

    const outletsByRegion: Record<number, number> = {};
    (outlets as OutletRow[] | null)?.forEach((o) => {
      outletsByRegion[o.region_id] = (outletsByRegion[o.region_id] || 0) + 1;
    });

    const enrichedRegions: EnrichedRegion[] = ((regions as Region[]) || []).map((r) => ({
      ...r,
      outlet_count: outletsByRegion[r.id] || 0,
    }));

    return new Response(JSON.stringify({
      regions: enrichedRegions,
      total: enrichedRegions.length,
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...corsHeaders,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
