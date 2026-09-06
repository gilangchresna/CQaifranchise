/// <reference lib="deno.ns" />
/**
 * Seed Test Outlets (SG Sub-Regions)
 * Populates outlets 164-171 that are referenced by alerts
 * but missing from the outlets table.
 * Uses service role — no RLS restrictions.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Region IDs from seed-regions-outlets output:
// SG-CENTRAL=109, SG-NORTH=110, SG-EAST=111, SG-WEST=112, SG-NE=113
const TEST_OUTLETS = [
  { id: 164, code: "KT-TMP-001", name: "Kopitiam Tampines",        region_id: 111 }, // SG-EAST
  { id: 165, code: "CR-JGP-001", name: "Chicken Rice @ Jurong Point", region_id: 109 }, // SG-CENTRAL
  { id: 166, code: "NL-AMK-001", name: "Nasi Lemak AMK",             region_id: 109 }, // SG-CENTRAL
  { id: 167, code: "LK-PLB-001", name: "Laksa King Paya Lebar",       region_id: 111 }, // SG-EAST
  { id: 168, code: "KT-CMT-001", name: "Kopitiam Clementi",          region_id: 112 }, // SG-WEST
  { id: 169, code: "MT-WDL-001", name: "Mookata Woodlands",           region_id: 110 }, // SG-NORTH
  { id: 170, code: "RP-HGM-001", name: "Roti Prata Hougang Mall",    region_id: 113 }, // SG-NE
  { id: 171, code: "ER-BSN-001", name: "Economic Rice @ Bishan",      region_id: 109 }, // SG-CENTRAL
];

const PLACEHOLDER_FRANCHISEE = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let upserted = 0;
  const details: Record<string, string> = {};

  for (const o of TEST_OUTLETS) {
    const { error } = await supabase.from("outlets").upsert({
      id: o.id,
      region_id: o.region_id,
      franchisee_id: PLACEHOLDER_FRANCHISEE,
      name: o.name,
      code: o.code,
      city: "Singapore",
      address: "Singapore",
      phone: null,
      status: "ACTIVE",
      daily_target: 0,
    }, { onConflict: "id" });

    details[o.code] = error ? `ERROR: ${error.message}` : "upserted";
    if (!error) upserted++;
  }

  const { data: allOutlets } = await supabase
    .from("outlets")
    .select("id, code, name, region_id")
    .in("id", TEST_OUTLETS.map(o => o.id));

  return new Response(JSON.stringify({
    status: "ok",
    upserted,
    total: TEST_OUTLETS.length,
    outlets: allOutlets,
    details,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
