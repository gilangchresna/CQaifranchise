/// <reference lib="deno.ns" />

/**
 * ML Scheduler Edge Function - Nightly Batch Orchestrator
 * 
 * This function coordinates the nightly ML batch scoring pipeline:
 * 1. Triggers ml-batch-score to process all outlets
 * 2. Generates alerts for high-risk items (anomalies, stockouts)
 * 
 * POST /functions/v1/ml-scheduler
 * 
 * Request Body (optional):
 * {
 *   outlet_ids?: number[],     // Optional: specific outlets to process
 *   force?: boolean            // Force re-score even if recent
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   batch_result: { ... },      // Result from ml-batch-score
 *   alerts_created: number,
 *   run_id?: number,            // ID in ml_scheduler_runs
 *   duration_ms: number
 * }
 * 
 * Cron: Every night at 2 AM (configured in 034_ml_batch_cron.sql)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Alert thresholds
const ANOMALY_THRESHOLD = 0.7;    // Score >= 0.7 triggers alert
const STOCKOUT_HIGH_THRESHOLD = "HIGH";  // HIGH risk triggers alert

interface MlSchedulerRequest {
  outlet_ids?: number[];
  force?: boolean;
}

interface MlSchedulerResponse {
  success: boolean;
  batch_result?: any;
  alerts_created: number;
  run_id?: number;
  duration_ms: number;
  message?: string;
}

/**
 * Create alert for high-risk outlet
 */
async function createAlert(
  supabase: any,
  outletId: number,
  alertType: "SALES_ANOMALY" | "STOCKOUT_RISK",
  score: number,
  title: string,
  description: string
): Promise<number | null> {
  try {
    // Check for recent duplicate alerts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from("alerts")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("type", alertType)
      .eq("status", "NEW")
      .gte("triggered_at", oneHourAgo);

    if (recentAlerts && recentAlerts.length > 0) {
      console.log(`Skipping duplicate alert for outlet ${outletId}`);
      return null;
    }

    // Determine severity
    let severity: "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
    if (score >= 0.9) severity = "P0_CRITICAL";
    else if (score >= 0.7) severity = "P1_HIGH";
    else if (score >= 0.5) severity = "P2_MEDIUM";
    else severity = "P3_LOW";

    // Insert alert
    const { data: newAlert, error } = await supabase
      .from("alerts")
      .insert({
        outlet_id: outletId,
        type: alertType,
        severity: severity,
        status: "NEW",
        title: title,
        description: description,
        score: score,
        triggered_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !newAlert) {
      console.error(`Failed to create alert for outlet ${outletId}:`, error);
      return null;
    }

    return newAlert.id;
  } catch (error) {
    console.error(`Error creating alert for outlet ${outletId}:`, error);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify JWT authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized: Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
    });

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Authentication failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const startTime = Date.now();

  try {
    const body: MlSchedulerRequest = await req.json().catch(() => ({}));
    const force = body.force ?? false;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create scheduler run record
    const { data: runRecord, error: runError } = await supabase
      .from("ml_scheduler_runs")
      .insert({
        status: "running",
        scheduled_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError) {
      console.error("Failed to create scheduler run record:", runError);
    }

    // ===== Step 1: Call ml-batch-score =====
    console.log("Starting ML batch scoring...");

    let batchResult: any = null;
    try {
      const batchResponse = await fetch(`${supabaseUrl}/functions/v1/ml-batch-score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          outlet_ids: body.outlet_ids,
          force: force,
        }),
      });

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        console.error("ml-batch-score error:", errorText);
        throw new Error(`Batch scoring failed: ${errorText}`);
      }

      batchResult = await batchResponse.json();
      console.log(`Batch scoring completed: ${batchResult.processed} outlets processed`);
    } catch (batchError) {
      console.error("Failed to call ml-batch-score:", batchError);
      
      // Update run record as failed
      if (runRecord) {
        await supabase
          .from("ml_scheduler_runs")
          .update({
            status: "failed",
            error_message: batchError instanceof Error ? batchError.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", runRecord.id);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Batch scoring failed: ${batchError instanceof Error ? batchError.message : "Unknown error"}`,
          duration_ms: Date.now() - startTime,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== Step 2: Generate alerts for high-risk items =====
    console.log("Checking for high-risk items to generate alerts...");

    let alertsCreated = 0;
    const batchResults = batchResult.results || [];

    for (const result of batchResults) {
      if (result.error) continue;

      // Check for anomaly alerts
      if (result.is_anomaly && result.anomaly_score >= ANOMALY_THRESHOLD) {
        const alertId = await createAlert(
          supabase,
          result.outlet_id,
          "SALES_ANOMALY",
          result.anomaly_score,
          `Anomaly Alert: ${result.outlet_name}`,
          `Anomaly score: ${Math.round(result.anomaly_score * 100)}%. ${result.anomaly_data_points} data points analyzed.`
        );
        if (alertId) {
          alertsCreated++;
          console.log(`Created anomaly alert ${alertId} for outlet ${result.outlet_id}`);
        }
      }

      // Check for stockout alerts (HIGH risk only)
      if (result.stockout_risk === STOCKOUT_HIGH_THRESHOLD) {
        const alertId = await createAlert(
          supabase,
          result.outlet_id,
          "STOCKOUT_RISK",
          result.stockout_score,
          `Stockout Risk: ${result.outlet_name}`,
          `Stockout risk: HIGH. Days until stockout: ${result.days_until_stockout || 'N/A'}.`
        );
        if (alertId) {
          alertsCreated++;
          console.log(`Created stockout alert ${alertId} for outlet ${result.outlet_id}`);
        }
      }
    }

    // ===== Step 3: Update scheduler run record =====
    if (runRecord) {
      await supabase
        .from("ml_scheduler_runs")
        .update({
          status: "completed",
          outlets_processed: batchResult.processed || 0,
          anomalies_detected: batchResult.summary?.anomalies || 0,
          stockouts_detected: batchResult.summary?.high_risk || 0,
          alerts_created: alertsCreated,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runRecord.id);
    }

    const duration_ms = Date.now() - startTime;
    console.log(`ML Scheduler completed: ${batchResult.processed} processed, ${alertsCreated} alerts created in ${duration_ms}ms`);

    const response: MlSchedulerResponse = {
      success: true,
      batch_result: {
        processed: batchResult.processed,
        summary: batchResult.summary,
      },
      alerts_created: alertsCreated,
      run_id: runRecord?.id,
      duration_ms,
      message: `Processed ${batchResult.processed} outlets, created ${alertsCreated} alerts`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("ML Scheduler error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
