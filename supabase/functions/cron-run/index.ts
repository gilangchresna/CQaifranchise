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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any = {
      timestamp: new Date().toISOString(),
      jobs: [],
      outlets_processed: 0,
      total_outlets: 0,
    };

    // Fetch all active outlets
    const { data: outlets, error: outletError } = await supabase
      .from("outlets")
      .select("id, name, region_id")
      .eq("status", "active");

    if (outletError) {
      throw new Error(`Failed to fetch outlets: ${outletError.message}`);
    }

    results.total_outlets = outlets?.length || 0;

    // Process each outlet
    for (const outlet of outlets || []) {
      results.outlets_processed++;
      const outletId = outlet.id;

      // 1. Run ML Anomaly Score for this outlet
      try {
        const anomalyRes = await fetch(`${supabaseUrl}/functions/v1/ml-anomaly-score`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ outlet_id: outletId }),
        });
        const anomalyData = await anomalyRes.json();
        results.jobs.push({
          name: "ml-anomaly-score",
          outlet_id: outletId,
          status: "completed",
          result: anomalyData.is_anomaly ? "Anomaly detected" : "Normal",
        });
      } catch (e: any) {
        results.jobs.push({ name: "ml-anomaly-score", outlet_id: outletId, status: "error", error: e.message });
      }

      // 2. Run Stockout Risk for this outlet
      try {
        const stockoutRes = await fetch(`${supabaseUrl}/functions/v1/ml-stockout-risk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ outlet_id: outletId }),
        });
        const stockoutData = await stockoutRes.json();
        results.jobs.push({
          name: "ml-stockout-risk",
          outlet_id: outletId,
          status: "completed",
          high_risk_count: Array.isArray(stockoutData) ? stockoutData.filter((i: any) => i.risk_level === "HIGH").length : 0,
        });
      } catch (e: any) {
        results.jobs.push({ name: "ml-stockout-risk", outlet_id: outletId, status: "error", error: e.message });
      }

      // 3. Generate alerts for anomalies
      try {
        const alertRes = await fetch(`${supabaseUrl}/functions/v1/alert-generator`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ trigger_type: "ANOMALY", outlet_id: outletId }),
        });
        const alertData = await alertRes.json();
        results.jobs.push({
          name: "alert-generator",
          outlet_id: outletId,
          status: alertData.success ? "completed" : "skipped",
          alert_created: alertData.alert_id || null,
        });
      } catch (e: any) {
        results.jobs.push({ name: "alert-generator", outlet_id: outletId, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
