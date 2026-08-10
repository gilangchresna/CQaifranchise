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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all cases
    const { data: cases, error } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Cases error:", error);
      return Response.json({ error: error.message, cases: [] }, { headers: corsHeaders });
    }

    if (!cases || cases.length === 0) {
      return Response.json({ cases: [] }, { headers: corsHeaders });
    }

    // Manual join: fetch alert + outlet data
    const alertIds = [...new Set(cases.map(c => c.alert_id).filter(Boolean))];
    const caseIds = cases.map(c => c.id);
    const assigneeIds = [...new Set(cases.map(c => c.assigned_to_id).filter(Boolean))];

    // Fetch alerts
    let alertMap: Record<number, any> = {};
    if (alertIds.length > 0) {
      const { data: alerts } = await supabase
        .from("alerts")
        .select("id, outlet_id, type, severity, outlet:outlet_id(name, code)")
        .in("id", alertIds);
      (alerts || []).forEach((a: any) => { alertMap[a.id] = a; });
    }

    // Fetch assignees
    let userMap: Record<number, any> = {};
    if (assigneeIds.length > 0) {
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id, full_name, role")
        .in("id", assigneeIds);
      (users || []).forEach((u: any) => { userMap[u.id] = u; });
    }

    // Attach joined data to cases
    const enrichedCases = cases.map(c => ({
      ...c,
      alert: alertMap[c.alert_id] || null,
      assigned_to: userMap[c.assigned_to_id] || null,
    }));

    return Response.json({ cases: enrichedCases }, { headers: corsHeaders });

  } catch (error: any) {
    return Response.json({ error: error.message, cases: [] }, { status: 500, headers: corsHeaders });
  }
});
