/// <reference lib="deno.ns" />
/**
 * Fix Outlet Region Mapping
 * Reassigns 11 outlets that were incorrectly pointing to JKT (region_id=115)
 * Run once via GET, idempotent (skip if already correct).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: HEADERS });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const results: Record<string, any> = {};

    // Fix Singapore outlets (164,165,167,168,169,170,171) → region_id 114
    const { data: sgData, error: sgErr } = await sb
      .from("outlets")
      .update({ region_id: 114 })
      .in("id", [164, 165, 167, 168, 169, 170, 171])
      .select("id, region_id");

    results.singapore = { updated: sgData?.length || 0, error: sgErr?.message || null };

    // Fix Malaysia outlets (210, 211) → region_id 119
    const { data: myData, error: myErr } = await sb
      .from("outlets")
      .update({ region_id: 119 })
      .in("id", [210, 211])
      .select("id, region_id");

    results.malaysia = { updated: myData?.length || 0, error: myErr?.message || null };

    // Fix Thailand outlets (212, 213) → region_id 118
    const { data: thData, error: thErr } = await sb
      .from("outlets")
      .update({ region_id: 118 })
      .in("id", [212, 213])
      .select("id, region_id");

    results.thailand = { updated: thData?.length || 0, error: thErr?.message || null };

    // Verify
    const { data: verify } = await sb
      .from("outlets")
      .select("id, code, name, city, region_id")
      .in("id", [164, 165, 167, 168, 169, 170, 171, 210, 211, 212, 213])
      .order("region_id");

    return new Response(JSON.stringify({
      success: true,
      migration: results,
      verification: verify,
    }), { headers: HEADERS });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), { status: 500, headers: HEADERS });
  }
});
