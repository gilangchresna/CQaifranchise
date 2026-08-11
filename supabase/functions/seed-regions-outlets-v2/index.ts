// seed-regions-outlets-v2: Seeds regions + outlets + fixes currency
// Run: POST to /functions/v1/seed-regions-outlets-v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_TOKEN")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Seed regions
    const regionsData = [
      { id: 1, name: "Jakarta", code: "JKT", description: "Jakarta Capital Region", currency_code: "IDR", locale_code: "id-ID" },
      { id: 2, name: "Jawa Barat", code: "JBR", description: "West Java Province", currency_code: "IDR", locale_code: "id-ID" },
      { id: 3, name: "Jawa Tengah", code: "JTG", description: "Central Java Province", currency_code: "IDR", locale_code: "id-ID" },
      { id: 4, name: "Jawa Timur", code: "JTM", description: "East Java Province", currency_code: "IDR", locale_code: "id-ID" },
      { id: 5, name: "Sumatera", code: "SUM", description: "Sumatra Region", currency_code: "IDR", locale_code: "id-ID" },
      { id: 6, name: "Singapore Central", code: "SGC", description: "Singapore Central Region", currency_code: "SGD", locale_code: "en-SG" },
    ];

    const { error: regionErr } = await supabase.from("regions").upsert(regionsData, { onConflict: "code" });
    if (regionErr) throw new Error(`Regions: ${regionErr.message}`);

    // 2. Seed outlets (mapping from existing transaction outlet_ids)
    // Existing outlet_ids in sales_transactions: 1,2,3,4,5,6,7,8,11,12,22,24,164,165,166,167,168,169,170,171
    const outletsData = [
      // Indonesia outlets (JKT region)
      { id: 1, region_id: 1, name: "Outlet Jakarta Pusat", code: "JKT-001", status: "ACTIVE" },
      { id: 2, region_id: 1, name: "Outlet Jakarta Selatan", code: "JKT-002", status: "ACTIVE" },
      { id: 3, region_id: 1, name: "Outlet Jakarta Barat", code: "JKT-003", status: "ACTIVE" },
      { id: 4, region_id: 1, name: "Outlet Jakarta Utara", code: "JKT-004", status: "ACTIVE" },
      { id: 5, region_id: 2, name: "Outlet Bandung", code: "JBR-001", status: "ACTIVE" },
      { id: 6, region_id: 2, name: "Outlet Bekasi", code: "JBR-002", status: "ACTIVE" },
      { id: 7, region_id: 3, name: "Outlet Semarang", code: "JTG-001", status: "ACTIVE" },
      { id: 8, region_id: 3, name: "Outlet Solo", code: "JTG-002", status: "ACTIVE" },
      { id: 11, region_id: 4, name: "Outlet Surabaya Pusat", code: "JTM-001", status: "ACTIVE" },
      { id: 12, region_id: 4, name: "Outlet Surabaya Selatan", code: "JTM-002", status: "ACTIVE" },
      { id: 22, region_id: 5, name: "Outlet Medan", code: "SUM-001", status: "ACTIVE" },
      { id: 24, region_id: 5, name: "Outlet Palembang", code: "SUM-002", status: "ACTIVE" },
      { id: 164, region_id: 1, name: "Outlet KT-TMP-001", code: "JKT-TMP-001", status: "ACTIVE" },
      { id: 165, region_id: 1, name: "Outlet 165", code: "JKT-165", status: "ACTIVE" },
      { id: 166, region_id: 1, name: "Outlet 166", code: "JKT-166", status: "ACTIVE" },
      { id: 167, region_id: 1, name: "Outlet 167", code: "JKT-167", status: "ACTIVE" },
      { id: 168, region_id: 1, name: "Outlet 168", code: "JKT-168", status: "ACTIVE" },
      { id: 169, region_id: 1, name: "Outlet 169", code: "JKT-169", status: "ACTIVE" },
      { id: 170, region_id: 1, name: "Outlet 170", code: "JKT-170", status: "ACTIVE" },
      { id: 171, region_id: 1, name: "Outlet 171", code: "JKT-171", status: "ACTIVE" },
    ];

    const { error: outletErr } = await supabase.from("outlets").upsert(outletsData, { onConflict: "code" });
    if (outletErr) throw new Error(`Outlets: ${outletErr.message}`);

    // 3. Verify
    const { data: regions } = await supabase.from("regions").select("id, code, currency_code");
    const { data: outlets } = await supabase.from("outlets").select("id, code, region_id");

    return new Response(
      JSON.stringify({
        ok: true,
        regions: regions,
        outlets: outlets,
        message: "Regions + outlets seeded. Dashboard should now show correct currency."
      }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
