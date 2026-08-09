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

    // Get role from Authorization header
    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role"); // e.g. ?role=Franchisee from Dashboard
    const authHeader = req.headers.get("Authorization") || "";
    let userRole = roleParam || "HQ_ADMIN";
    let userId: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          // Normalize: UI role names → DB role names (for demo mode role switching)
          const roleMap: Record<string, string> = {
            "HQ": "HQ_ADMIN",
            "Regional": "REGIONAL_MANAGER",
            "Franchisee": "FRANCHISEE_OWNER",
          };
          // Use roleParam from UI if present (demo mode), otherwise use real JWT role
          userRole = roleParam ? (roleMap[roleParam] || roleParam) : userRole;
          userId = userData?.id || null;
        }
      } catch { /* use defaults */ }
    }

    // Build outlet filter based on role
    let outletsQuery = supabase
      .from("outlets")
      .select(`id, code, name, status, city, address, phone, daily_target, region_id, region:regions(id, name, code)`)
      .order("code");

    if (userRole === "FRANCHISEE_OWNER" || userRole === "FRANCHISEE_STAFF") {
      if (userId) {
        const { data: userOutlets } = await supabase
          .from("user_outlets")
          .select("outlet_id")
          .eq("user_id", userId);
        const outletIds = (userOutlets || []).map((uo: any) => uo.outlet_id);
        if (outletIds.length > 0) {
          outletsQuery = outletsQuery.in("id", outletIds);
        } else {
          outletsQuery = outletsQuery.eq("id", -1); // return empty
        }
      }
    } else if (userRole === "REGIONAL_MANAGER") {
      // Regional sees only outlets in their assigned region via user_profiles.region_id
      // (Production: filter by user's region — not demo mode anymore)
      if (userId) {
        const { data: up } = await supabase
          .from("user_profiles")
          .select("region_id")
          .eq("id", userId)
          .single();
        if (up?.region_id) {
          outletsQuery = outletsQuery.eq("region_id", up.region_id);
        }
        // regions filtered below based on allowed outlets
      }
    }

    const { data: outlets } = await outletsQuery;

    // Get regions (HQ/Regional see all; Franchisee sees only their regions)
    let regionsQuery = supabase.from("regions").select("id, name, code").order("name");
    if (userRole === "FRANCHISEE_OWNER" || userRole === "FRANCHISEE_STAFF") {
      const outletIds = (outlets || []).map((o: any) => o.id);
      if (outletIds.length > 0) {
        const { data: regionData } = await supabase.from("outlets").select("region_id").in("id", outletIds);
        const regionIds = [...new Set((regionData || []).map((r: any) => r.region_id))];
        if (regionIds.length > 0) {
          regionsQuery = regionsQuery.in("id", regionIds);
        }
      }
    }
    const { data: regions } = await regionsQuery;

    // Recalculate counts based on filtered outlets
    const { count: outletCount } = await supabase
      .from("outlets")
      .select("*", { count: "exact", head: true })
      .in("id", (outlets || []).map((o: any) => o.id));
    const { count: activeCount } = await supabase
      .from("outlets")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE")
      .in("id", (outlets || []).map((o: any) => o.id));

    return new Response(
      JSON.stringify({
        regions: regions || [],
        outlets: outlets || [],
        summary: {
          total_regions: regions?.length || 0,
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
