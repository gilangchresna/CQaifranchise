/// <reference lib="deno.ns" />
/**
 * Apply Currency + Patch Outlet Names + Seed Test Outlets
 * - Step 1: Add currency_code to regions
 * - Step 2: Patch outlet names for outlets 1-8
 * - Step 3: Seed outlets 164-171 with names
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CURRENCY_UPDATES = [
  ["SG", "SGD", "en-SG"],
  ["JKT", "IDR", "id-ID"],
  ["BDG", "IDR", "id-ID"],
  ["SBY", "IDR", "id-ID"],
  ["BKK", "THB", "th-TH"],
  ["KUL", "MYR", "en-MY"],
  ["SG-CENTRAL", "SGD", "en-SG"],
  ["SG-NORTH", "SGD", "en-SG"],
  ["SG-EAST", "SGD", "en-SG"],
  ["SG-WEST", "SGD", "en-SG"],
  ["SG-NE", "SGD", "en-SG"],
];

const OUTLET_NAME_PATCH: Record<string, string> = {
  "1": "WKW Singapore Standard",
  "2": "MYB Singapore Standard",
  "3": "SAP Singapore Premium",
  "4": "JKT Jakarta Standard",
  "5": "BDG Bandung Standard",
  "6": "SBY Surabaya Standard",
  "7": "BKK Bangkok Premium",
  "8": "KUL KL Standard",
};

const TEST_OUTLETS = [
  { id: 164, code: "KT-TMP-001", name: "Kopitiam Tampines", regionId: 111 },
  { id: 165, code: "CR-JGP-001", name: "Chicken Rice Jurong Point", regionId: 109 },
  { id: 166, code: "NL-AMK-001", name: "Nasi Lemak AMK", regionId: 109 },
  { id: 167, code: "LK-PLB-001", name: "Laksa King Paya Lebar", regionId: 111 },
  { id: 168, code: "KT-CMT-001", name: "Kopitiam Clementis", regionId: 112 },
  { id: 169, code: "MT-WDL-001", name: "Mookata Woodlands", regionId: 110 },
  { id: 170, code: "RP-HGM-001", name: "Roti Prata Hougang", regionId: 113 },
  { id: 171, code: "ER-BSN-001", name: "Economic Rice Bishan", regionId: 109 },
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const results: Record<string, string> = {};

  // Step 1: currency code
  for (const [code, curr, locale] of CURRENCY_UPDATES) {
    const { error } = await supabase
      .from("regions")
      .update({ currency_code: curr, locale_code: locale })
      .eq("code", code);
    results[`region:${code}`] = error ? `ERR:${error.message}` : "ok";
  }

  // Step 2: patch outlet names
  const PLACEHOLDER = "00000000-0000-0000-0000-000000000001";
  for (const [id, name] of Object.entries(OUTLET_NAME_PATCH)) {
    const { error } = await supabase
      .from("outlets")
      .update({ name })
      .eq("id", Number(id));
    results[`name:${id}`] = error ? `ERR:${error.message}` : "patched";
  }

  // Step 3: upsert test outlets
  for (const o of TEST_OUTLETS) {
    const { error } = await supabase.from("outlets").upsert({
      id: o.id,
      region_id: o.regionId,
      franchisee_id: PLACEHOLDER,
      name: o.name,
      code: o.code,
      city: "Singapore",
      address: "Singapore",
      status: "ACTIVE",
      daily_target: 0,
    }, { onConflict: "id" });
    results[`outlet:${o.code}`] = error ? `ERR:${error.message}` : "upserted";
  }

  return new Response(JSON.stringify({ status: "ok", results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
