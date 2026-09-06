import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth, isAtLeastRole, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // SECURITY: this function uses the service-role key (bypasses RLS) and can
  // mutate/delete data. Restrict it to authenticated HQ_ADMIN callers only.
  const auth = await verifyAuth(req);
  if (!auth.success || !auth.user) {
    return unauthorizedResponse(auth.error);
  }
  if (!isAtLeastRole(auth.user, 'HQ_ADMIN')) {
    return forbiddenResponse('HQ_ADMIN role required for this operation');
  }

  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Seed Cases
    const cases = [
      { 
        title: "Investigate Sales Dip @ Tampines", 
        description: "Sales dropped 30% below baseline. Need investigation.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        type: "sales_investigation",
        outlet_id: 156,
        region_id: 106,
      },
      { 
        title: "Restock Chicken Rice @ Jurong", 
        description: "Critical stock level for main ingredient.",
        status: "NEW",
        priority: "URGENT",
        type: "stock_restock",
        outlet_id: 157,
        region_id: 107,
      },
      { 
        title: "Review GoFood Performance", 
        description: "GoFood orders down 20% vs last week.",
        status: "NEW",
        priority: "MEDIUM",
        type: "performance_review",
        outlet_id: 158,
        region_id: 104,
      },
      { 
        title: "Staff Training Required", 
        description: "Customer complaints about service time.",
        status: "RESOLVED",
        priority: "LOW",
        type: "staff_training",
        outlet_id: 159,
        region_id: 106,
      },
    ];

    // Seed Alerts
    const alerts = [
      {
        outlet_id: 156,
        type: "SALES_ANOMALY",
        severity: "P1_HIGH",
        status: "NEW",
        title: "Sales Anomaly Detected",
        description: "Sales at Tampines outlet 40% below expected baseline.",
        score: 0.85,
        triggered_at: new Date().toISOString(),
      },
      {
        outlet_id: 157,
        type: "STOCKOUT_RISK",
        severity: "P0_CRITICAL",
        status: "NEW",
        title: "Critical Stock: Chicken Rice Set",
        description: "Stock: 8 units, Min: 25 units. Immediate restock needed.",
        score: 0.95,
        triggered_at: new Date().toISOString(),
      },
      {
        outlet_id: 160,
        type: "STOCKOUT_RISK",
        severity: "P0_CRITICAL",
        status: "ACKNOWLEDGED",
        title: "Critical Stock: Milo",
        description: "Milo (Large) running low. 11 units remaining.",
        score: 0.78,
        triggered_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        outlet_id: 161,
        type: "STOCKOUT_RISK",
        severity: "P0_CRITICAL",
        status: "NEW",
        title: "Critical Stock: Mookata Set",
        description: "Mookata ingredients at 15% capacity.",
        score: 0.92,
        triggered_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    // Insert cases
    const { error: casesError } = await supabase.from("cases").upsert(cases, { onConflict: "id" });
    if (casesError) console.error("Cases error:", casesError);

    // Insert alerts
    const { error: alertsError } = await supabase.from("alerts").upsert(alerts, { onConflict: "id" });
    if (alertsError) console.error("Alerts error:", alertsError);

    // Get counts
    const { count: casesCount } = await supabase.from("cases").select("*", { count: "exact", head: true });
    const { count: alertsCount } = await supabase.from("alerts").select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      success: true,
      message: "Workflow data seeded",
      cases_created: cases.length,
      alerts_created: alerts.length,
      totals: {
        cases: casesCount,
        alerts: alertsCount,
      }
    }), { headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
