// Pilot Dashboard Edge Function
// GET pilot outlet status and outreach progress

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pilot outlets with outreach info
    const { data: pilotData, error: pilotError } = await supabase
      .from("outlets")
      .select(`
        id,
        code,
        name,
        city,
        status,
        daily_target,
        regions (name),
        pilot_outreach (
          id,
          contact_name,
          contact_phone,
          contact_email,
          stage,
          contacted_at,
          demo_scheduled_at,
          demo_completed_at,
          agreement_signed_at,
          onboarding_completed_at,
          notes
        )
      `)
      .eq("status", "PILOT");

    if (pilotError) throw pilotError;

    // Get alerts for pilot outlets
    const pilotOutletIds = pilotData?.map(o => o.id) || [];
    const { data: alertsData } = await supabase
      .from("alerts")
      .select("id, outlet_id, type, severity, status, created_at")
      .in("outlet_id", pilotOutletIds)
      .order("created_at", { ascending: false });

    // Get transactions summary
    const { data: transactionData } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount, date")
      .in("outlet_id", pilotOutletIds)
      .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

    // Calculate metrics
    const pilotMetrics = pilotData?.map(outlet => {
      const outletAlerts = alertsData?.filter(a => a.outlet_id === outlet.id) || [];
      const outletTransactions = transactionData?.filter(t => t.outlet_id === outlet.id) || [];
      const totalSales = outletTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const avgDailySales = outletTransactions.length > 0 ? totalSales / outletTransactions.length : 0;

      return {
        ...outlet,
        metrics: {
          total_alerts: outletAlerts.length,
          new_alerts: outletAlerts.filter(a => a.status === "NEW").length,
          avg_daily_sales: avgDailySales,
          daily_target: outlet.daily_target,
          target_achievement: outlet.daily_target > 0 ? (avgDailySales / outlet.daily_target) * 100 : 0
        },
        stage: outlet.pilot_outreach?.[0]?.stage || "UNKNOWN"
      };
    });

    // Stage summary
    const stageSummary = {
      CONTACTED: pilotData?.filter(p => p.pilot_outreach?.[0]?.stage === "CONTACTED").length || 0,
      DEMO_SCHEDULED: pilotData?.filter(p => p.pilot_outreach?.[0]?.stage === "DEMO_SCHEDULED").length || 0,
      DEMO_COMPLETED: pilotData?.filter(p => p.pilot_outreach?.[0]?.stage === "DEMO_COMPLETED").length || 0,
      AGREEMENT_SIGNED: pilotData?.filter(p => p.pilot_outreach?.[0]?.stage === "AGREEMENT_SIGNED").length || 0,
      ONBOARDED: pilotData?.filter(p => p.pilot_outreach?.[0]?.stage === "ONBOARDED").length || 0
    };

    return new Response(
      JSON.stringify({
        pilot_outlets: pilotMetrics,
        stage_summary: stageSummary,
        total_pilot_outlets: pilotData?.length || 0,
        generated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
