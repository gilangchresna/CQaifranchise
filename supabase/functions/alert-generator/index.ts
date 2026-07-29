/// <reference lib="deno.ns" />

/**
 * Alert Generator Edge Function
 * Automatically creates alerts when ML scoring detects anomalies or stockout risks
 *
 * POST /functions/v1/alert-generator
 *
 * Request Body:
 * {
 *   outlet_id: number,           // Required: Outlet to generate alert for
 *   trigger_type: "ANOMALY" | "STOCKOUT" | "MANUAL",  // Type of trigger
 *   threshold_override?: number,  // Optional: Override default threshold
 *   current_sales?: number,      // Optional: Current sales amount (for anomaly)
 *   sku?: string                 // Optional: SKU for stockout check
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   alert_id?: number,
 *   alert_type?: "SALES_ANOMALY" | "STOCKOUT_RISK",
 *   severity?: "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW",
 *   score?: number,
 *   reason?: string              // When success is false
 * }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Severity thresholds
const SEVERITY_THRESHOLDS = {
  P0_CRITICAL: 0.9,   // score >= 0.9
  P1_HIGH: 0.7,       // score >= 0.7
  P2_MEDIUM: 0.5,     // score >= 0.5
  P3_LOW: 0.3,        // score >= 0.3
};

const DEFAULT_THRESHOLD = 0.5;

type TriggerType = "ANOMALY" | "STOCKOUT" | "MANUAL";
type AlertType = "SALES_ANOMALY" | "STOCKOUT_RISK";
type Severity = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";

interface AlertGeneratorRequest {
  outlet_id: number;
  trigger_type: TriggerType;
  threshold_override?: number;
  current_sales?: number;
  sku?: string;
}

interface AlertGeneratorResponse {
  success: boolean;
  alert_id?: number;
  alert_type?: AlertType;
  severity?: Severity;
  score?: number;
  reason?: string;
  message?: string;
}

/**
 * Determine severity based on score
 */
function getSeverity(score: number): Severity {
  if (score >= SEVERITY_THRESHOLDS.P0_CRITICAL) return "P0_CRITICAL";
  if (score >= SEVERITY_THRESHOLDS.P1_HIGH) return "P1_HIGH";
  if (score >= SEVERITY_THRESHOLDS.P2_MEDIUM) return "P2_MEDIUM";
  if (score >= SEVERITY_THRESHOLDS.P3_LOW) return "P3_LOW";
  return "P3_LOW"; // Default to lowest
}

/**
 * Generate alert title based on type and severity
 */
function generateAlertTitle(alertType: AlertType, severity: Severity, outletName: string): string {
  const severityLabel = severity.replace("_", " ");
  switch (alertType) {
    case "SALES_ANOMALY":
      return `${severityLabel}: Sales Anomaly Detected at ${outletName}`;
    case "STOCKOUT_RISK":
      return `${severityLabel}: Stockout Risk Alert at ${outletName}`;
    default:
      return `${severityLabel}: Alert at ${outletName}`;
  }
}

/**
 * Generate alert description based on ML results
 */
function generateAlertDescription(
  alertType: AlertType,
  score: number,
  mlMessage: string,
  outletName: string,
  sku?: string
): string {
  const scorePercent = Math.round(score * 100);
  const skuInfo = sku ? `SKU: ${sku}` : "";

  switch (alertType) {
    case "SALES_ANOMALY":
      return `${mlMessage}

Outlet: ${outletName}
Anomaly Score: ${scorePercent}%
Triggered by: Sales anomaly detection system

This alert was generated automatically based on deviation from historical sales patterns.`;

    case "STOCKOUT_RISK":
      return `${mlMessage}

Outlet: ${outletName}
${skuInfo}
Risk Score: ${scorePercent}%
Triggered by: Inventory stockout prediction

This alert was generated automatically based on current inventory levels and sales velocity.`;

    default:
      return `Alert at ${outletName} with ${scorePercent}% confidence. ${mlMessage}`;
  }
}

/**
 * Call ML Anomaly Score endpoint
 */
async function callMlAnomalyScore(
  supabase: any,
  outletId: number,
  currentSales?: number
): Promise<{ score: number; message: string; is_anomaly: boolean } | null> {
  const mlFunctionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ml-anomaly-score`;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Get latest sales data if not provided
  let salesAmount = currentSales;
  if (!salesAmount) {
    const { data: latestSale } = await supabase
      .from("sales_transactions")
      .select("amount")
      .eq("outlet_id", outletId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    salesAmount = latestSale ? parseFloat(String((latestSale as any).amount)) : 0;
  }

  if (salesAmount <= 0) {
    // No sales data - simulate a low anomaly score
    return { score: 0.2, message: "No recent sales data available", is_anomaly: false };
  }

  try {
    const response = await fetch(mlFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        outlet_id: outletId,
        current_sales: salesAmount,
      }),
    });

    if (!response.ok) {
      console.error("ML Anomaly Score error:", await response.text());
      return null;
    }

    const result = await response.json();

    // Convert z-score to 0-1 confidence score
    // z-score of 2.5+ = 0.9+, z-score of 0 = 0.5
    const absZScore = Math.abs(result.score || 0);
    const confidenceScore = Math.min(1, 0.5 + absZScore / 5);

    return {
      score: confidenceScore,
      message: result.message || "Anomaly detected",
      is_anomaly: result.is_anomaly || false,
    };
  } catch (error) {
    console.error("Failed to call ML Anomaly Score:", error);
    return null;
  }
}

/**
 * Call ML Stockout Risk endpoint
 */
async function callMlStockoutRisk(
  supabase: any,
  outletId: number,
  sku?: string
): Promise<{ score: number; message: string; risk_level: string } | null> {
  const mlFunctionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ml-stockout-risk`;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const response = await fetch(mlFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        outlet_id: outletId,
        sku: sku,
      }),
    });

    if (!response.ok) {
      console.error("ML Stockout Risk error:", await response.text());
      return null;
    }

    const result = await response.json();

    // Convert 0-100 risk_score to 0-1 confidence score
    const confidenceScore = (result.risk_score || 0) / 100;

    return {
      score: confidenceScore,
      message: result.message || "Stockout risk detected",
      risk_level: result.risk_level || "LOW",
    };
  } catch (error) {
    console.error("Failed to call ML Stockout Risk:", error);
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
      JSON.stringify({ success: false, reason: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: AlertGeneratorRequest = await req.json();

    // Validate required fields
    if (!body.outlet_id || typeof body.outlet_id !== "number") {
      return new Response(
        JSON.stringify({ success: false, reason: "outlet_id is required and must be a number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.trigger_type || !["ANOMALY", "STOCKOUT", "MANUAL"].includes(body.trigger_type)) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "trigger_type is required and must be one of: ANOMALY, STOCKOUT, MANUAL"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get outlet info
    const { data: outlet, error: outletError } = await supabase
      .from("outlets")
      .select("id, name, code, status, regions(name, code)")
      .eq("id", body.outlet_id)
      .single();

    if (outletError || !outlet) {
      return new Response(
        JSON.stringify({ success: false, reason: `Outlet ${body.outlet_id} not found` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip inactive outlets
    if (outlet.status !== "ACTIVE" && outlet.status !== "PILOT") {
      return new Response(
        JSON.stringify({ success: false, reason: `Outlet ${outlet.name} is not active` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== VALIDATION =====
    if (typeof body.outlet_id !== "number" || body.outlet_id <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "outlet_id is required and must be a positive number"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["ANOMALY", "STOCKOUT", "MANUAL"].includes(body.trigger_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: "trigger_type is required and must be one of: ANOMALY, STOCKOUT, MANUAL"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Boundary validation: threshold must be between 0 and 1
    if (body.threshold_override !== undefined && 
        (typeof body.threshold_override !== "number" || body.threshold_override < 0 || body.threshold_override > 1)) {
      return new Response(JSON.stringify({
        success: false,
        error: "threshold_override must be a number between 0 and 1"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Negative sales check
    if (body.current_sales !== undefined && body.current_sales < 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "current_sales cannot be negative"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const threshold = body.threshold_override ?? DEFAULT_THRESHOLD;
    const outletName = outlet.name;
    const regionName = (outlet.regions as any)?.name || "Unknown";

    // Initialize variables
    let alertType: AlertType;
    let mlScore = 0;
    let mlMessage = "";
    let severity: Severity;

    // Process based on trigger type
    switch (body.trigger_type) {
      case "ANOMALY":
        const anomalyResult = await callMlAnomalyScore(supabase, body.outlet_id, body.current_sales);
        if (!anomalyResult) {
          return new Response(
            JSON.stringify({ success: false, reason: "Failed to get anomaly score from ML service" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        alertType = "SALES_ANOMALY";
        mlScore = anomalyResult.score;
        mlMessage = anomalyResult.message;
        break;

      case "STOCKOUT":
        const stockoutResult = await callMlStockoutRisk(supabase, body.outlet_id, body.sku);
        if (!stockoutResult) {
          return new Response(
            JSON.stringify({ success: false, reason: "Failed to get stockout risk from ML service" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        alertType = "STOCKOUT_RISK";
        mlScore = stockoutResult.score;
        mlMessage = stockoutResult.message;
        break;

      case "MANUAL":
        // Manual trigger - use threshold as the score
        alertType = "SALES_ANOMALY";
        mlScore = threshold;
        mlMessage = "Manually triggered alert";
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, reason: "Invalid trigger_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Check if score meets threshold
    if (mlScore < threshold) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "below_threshold",
          message: `Score ${Math.round(mlScore * 100)}% is below threshold ${Math.round(threshold * 100)}%`,
          score: mlScore,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine severity
    severity = getSeverity(mlScore);

    // Check for recent duplicate alerts (within last hour for same outlet and type)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from("alerts")
      .select("id")
      .eq("outlet_id", body.outlet_id)
      .eq("type", alertType)
      .eq("status", "NEW")
      .gte("triggered_at", oneHourAgo);

    if (recentAlerts && recentAlerts.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "duplicate",
          message: "A similar alert was already created for this outlet in the last hour",
          existing_alert_id: recentAlerts[0].id,
          score: mlScore,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate alert content
    const title = generateAlertTitle(alertType, severity, outletName);
    const description = generateAlertDescription(alertType, mlScore, mlMessage, outletName, body.sku);

    // Insert alert into database
    const { data: newAlert, error: insertError } = await supabase
      .from("alerts")
      .insert({
        outlet_id: body.outlet_id,
        type: alertType,
        severity: severity,
        status: "NEW",
        title: title,
        description: description,
        score: mlScore,
        triggered_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !newAlert) {
      console.error("Failed to insert alert:", insertError);
      return new Response(
        JSON.stringify({ success: false, reason: "Failed to create alert in database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Alert created: ${newAlert.id} - ${title}`);

    const response: AlertGeneratorResponse = {
      success: true,
      alert_id: newAlert.id,
      alert_type: alertType,
      severity: severity,
      score: mlScore,
      message: "Alert created successfully",
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Alert generator error:", error);
    return new Response(
      JSON.stringify({ success: false, reason: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
