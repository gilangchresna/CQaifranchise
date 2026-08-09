import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // staff_productivity values per outlet (region base × type_mult × size_mult × variance)
  const updates = [
    { outlet_id: 1,  staff_productivity: 437.0 },  // SG standard large
    { outlet_id: 2,  staff_productivity: 281.0 },  // SG standard medium
    { outlet_id: 3,  staff_productivity: 579.0 },  // SG premium large
    { outlet_id: 4,  staff_productivity: 148.0 },  // JKT standard medium
    { outlet_id: 5,  staff_productivity: 67.0 },   // BDG standard small
    { outlet_id: 6,  staff_productivity: 145.0 },  // SBY standard medium
    { outlet_id: 7,  staff_productivity: 405.0 },  // BKK premium large
    { outlet_id: 8,  staff_productivity: 170.0 },  // KL standard medium
    { outlet_id: 164, staff_productivity: 151.0 },  // SG-Central standard small
    { outlet_id: 165, staff_productivity: 159.0 },  // SG-East standard small
    { outlet_id: 166, staff_productivity: 146.0 },  // SG-West standard small
    { outlet_id: 167, staff_productivity: 169.0 },  // SG-North standard small
    { outlet_id: 168, staff_productivity: 155.0 },  // SG-NE standard small
    { outlet_id: 169, staff_productivity: 78.0 },   // JKT standard small
    { outlet_id: 170, staff_productivity: 160.0 },  // JKT standard medium
    { outlet_id: 171, staff_productivity: 61.0 },   // BDG standard small
  ];

  const results: { outlet_id: number; success: boolean; error?: string }[] = [];

  for (const u of updates) {
    const { error } = await supabase
      .from("peer_metrics")
      .update({ staff_productivity: u.staff_productivity })
      .eq("outlet_id", u.outlet_id);

    results.push({ outlet_id: u.outlet_id, success: !error, error: error?.message });
  }

  const failed = results.filter(r => !r.success);
  return new Response(JSON.stringify({
    message: "Staff productivity updated",
    updated: results.filter(r => r.success).length,
    failed: failed.length,
    failures: failed,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
