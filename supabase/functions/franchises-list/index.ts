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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get regions
    const { data: regions } = await supabase
      .from("regions")
      .select("id, name, code")
      .order("name");

    // Get outlets with region info - INCLUDE address, phone
    const { data: outlets } = await supabase
      .from("outlets")
      .select(`
        id, code, name, status, city, address, phone, daily_target,
        region_id, region:regions(id, name, code)
      `)
      .order("code");

    // Get counts
    const { count: regionCount } = await supabase
      .from("regions")
      .select("*", { count: "exact", head: true });

    const { count: outletCount } = await supabase
      .from("outlets")
      .select("*", { count: "exact", head: true });

    const { count: activeCount } = await supabase
      .from("outlets")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE");

    return new Response(
      JSON.stringify({
        regions: regions || [],
        outlets: outlets || [],
        summary: {
          total_regions: regionCount || 0,
          total_outlets: outletCount || 0,
          active_outlets: activeCount || 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Franchises Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
