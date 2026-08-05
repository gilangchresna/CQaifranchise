/// <reference lib="deno.ns" />
/**
 * Seed Regions + Outlets from outlet_classifications
 * Reads region/outlet data from outlet_classifications and populates
 * the regions and outlets tables. Safe to re-run (idempotent).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Region code mapping
const REGION_MAP: Record<string, { code: string; country: string }> = {
  "Singapore": { code: "SG", country: "Singapore" },
  "Jakarta": { code: "JKT", country: "Indonesia" },
  "Bandung": { code: "BDG", country: "Indonesia" },
  "Surabaya": { code: "SBY", country: "Indonesia" },
  "Bangkok": { code: "BKK", country: "Thailand" },
  "Kuala Lumpur": { code: "KUL", country: "Malaysia" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // 1. Seed regions
    const regionData = Object.entries(REGION_MAP).map(([name, { code, country }]) => ({
      name,
      code,
      description: `${name}, ${country}`,
    }));

    const { error: regionErr } = await supabase.from("regions").upsert(regionData, { onConflict: "code" });
    if (regionErr) throw new Error(`Regions seed failed: ${regionErr.message}`);

    // 2. Fetch outlet_classifications
    const { data: oc, error: ocErr } = await supabase
      .from("outlet_classifications")
      .select("outlet_id, outlet_code, region, outlet_type, size_category, location_type, staff_count");
    if (ocErr) throw new Error(`outlet_classifications fetch failed: ${ocErr.message}`);

    // 3. Get region id map
    const { data: regions } = await supabase.from("regions").select("id, name");
    const regionIdMap: Record<string, number> = {};
    if (regions) {
      for (const r of regions) regionIdMap[r.name] = r.id;
    }

    // 4. Build a mapping of outlet_code -> franchisee_id
    // Since we don't have user data, create a placeholder UUID for franchisees
    const PLACEHOLDER_FRANCHISEE = "00000000-0000-0000-0000-000000000001";

    // 5. Seed outlets
    const outletData = (oc ?? []).map((o: any) => {
      const regionId = regionIdMap[o.region] || 1;
      // Derive city from region name
      const city = o.region === "Kuala Lumpur" ? "Kuala Lumpur"
        : o.region === "Bandung" ? "Bandung"
        : o.region === "Surabaya" ? "Surabaya"
        : o.region === "Bangkok" ? "Bangkok"
        : o.region === "Jakarta" ? "Jakarta"
        : "Singapore";
      return {
        id: o.outlet_id,
        region_id: regionId,
        franchisee_id: PLACEHOLDER_FRANCHISEE,
        name: `${o.region} ${o.outlet_type} Outlet`,
        code: o.outlet_code,
        address: `${city}, ${o.region}`,
        city,
        phone: null,
        status: "ACTIVE",
        daily_target: 0,
      };
    });

    const { error: outletErr } = await supabase.from("outlets").upsert(outletData, { onConflict: "id" });
    if (outletErr) throw new Error(`Outlets seed failed: ${outletErr.message}`);

    // 6. Verify
    const { data: finalRegions } = await supabase.from("regions").select("id, name, code").order("id");
    const { data: finalOutlets } = await supabase.from("outlets").select("id, name, code, region_id").order("id");

    return new Response(JSON.stringify({
      status: "ok",
      regions_seeded: finalRegions?.length ?? 0,
      outlets_seeded: finalOutlets?.length ?? 0,
      regions: finalRegions,
      outlets: finalOutlets?.map((o: any) => ({ id: o.id, code: o.code, region_id: o.region_id })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
