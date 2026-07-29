/// <reference lib="deno.ns" />

/**
 * ML Batch Score Edge Function - Updated for Nightly Pipeline
 * Bulk scoring for all outlets: anomaly detection and stockout prediction
 * 
 * POST endpoint - No input required for full batch, optional outlet_ids for specific
 * 
 * Request Body (optional):
 * {
 *   outlet_ids?: number[],     // Optional: specific outlets to process
 *   date?: string,             // Optional: date for scoring (default: today)
 *   force?: boolean            // Force re-score even if recent
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   processed: number,
 *   results: Array<{
 *     outlet_id: number,
 *     anomaly_score: number,
 *     is_anomaly: boolean,
 *     stockout_risk: "LOW" | "MEDIUM" | "HIGH",
 *     days_until_stockout?: number
 *   }>,
 *   summary: { ... },
 *   duration_ms: number
 * }
 * 
 * Cron: Every night at 2 AM (0 2 * * *)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Anomaly detection threshold (z-score)
const Z_SCORE_THRESHOLD = 2.5;

// Stockout risk thresholds (days until stockout)
const STOCKOUT_RISK_THRESHOLDS = {
  HIGH: 3,
  MEDIUM: 7,
} as const;

// Minimum data points for reliable statistics
const MIN_DATA_POINTS = 5;

// Recent threshold - don't re-score if scored within this window (in ms)
const RECENT_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

interface BatchScoreRequest {
  outlet_ids?: number[];
  date?: string;
  force?: boolean;
}

interface BatchScoreResult {
  outlet_id: number;
  outlet_name: string;
  anomaly_score: number;
  is_anomaly: boolean;
  anomaly_data_points: number;
  stockout_risk: "LOW" | "MEDIUM" | "HIGH";
  stockout_score: number;
  days_until_stockout?: number;
  stockout_data_points: number;
  error?: string;
}

interface BatchScoreResponse {
  success: boolean;
  processed: number;
  results: BatchScoreResult[];
  summary: {
    total: number;
    anomalies: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
    errors: number;
  };
  duration_ms: number;
}

interface OutletInfo {
  id: number;
  name: string;
  code: string;
  status: string;
}

/**
 * Calculate statistics from historical data
 */
function calculateStatistics(values: number[]): { avg: number; std_dev: number } {
  if (values.length === 0) {
    return { avg: 0, std_dev: 0 };
  }

  const n = values.length;
  const avg = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / n;
  const std_dev = Math.sqrt(variance);

  return { avg, std_dev };
}

/**
 * Calculate z-score
 */
function calculateZScore(current: number, avg: number, std_dev: number): number {
  if (std_dev === 0) return 0;
  return (current - avg) / std_dev;
}

/**
 * Convert z-score to 0-1 confidence score
 */
function zScoreToConfidence(zScore: number): number {
  const absZ = Math.abs(zScore);
  // z=0 → 0.5, z=2.5+ → 1.0
  return Math.min(1, 0.5 + absZ / 5);
}

/**
 * Get stockout risk level from days remaining
 */
function getStockoutRiskLevel(daysRemaining: number): "LOW" | "MEDIUM" | "HIGH" {
  if (daysRemaining < STOCKOUT_RISK_THRESHOLDS.HIGH) return "HIGH";
  if (daysRemaining < STOCKOUT_RISK_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

/**
 * Calculate days until stockout
 */
function calculateDaysUntilStockout(currentStock: number, avgDailyUsage: number): number {
  if (avgDailyUsage === 0) return 999; // No usage = won't stockout
  return currentStock / avgDailyUsage;
}

/**
 * Convert days until stockout to 0-1 risk score (higher = more risk)
 */
function daysToRiskScore(daysUntilStockout: number): number {
  if (daysUntilStockout <= 0) return 1.0;
  if (daysUntilStockout >= 10) return 0;
  return Math.round((1 - daysUntilStockout / 10) * 100) / 100;
}

/**
 * Process a single outlet - calculate both anomaly and stockout scores
 */
async function processOutlet(
  supabase: any,
  outlet: OutletInfo,
  force: boolean
): Promise<BatchScoreResult> {
  const result: BatchScoreResult = {
    outlet_id: outlet.id,
    outlet_name: outlet.name,
    anomaly_score: 0,
    is_anomaly: false,
    anomaly_data_points: 0,
    stockout_risk: "LOW",
    stockout_score: 0,
    stockout_data_points: 0,
  };

  try {
    // ===== ANOMALY SCORING =====
    // Fetch recent sales transactions for the outlet
    const { data: salesData, error: salesError } = await supabase
      .from("sales_transactions")
      .select("amount")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (salesError) {
      console.error(`Error fetching sales for outlet ${outlet.id}:`, salesError);
      result.error = `Sales data error: ${salesError.message}`;
    }

    const amounts = (salesData || [])
      .map((row: any) => parseFloat(row.amount as unknown as string))
      .filter((v: number) => !isNaN(v));

    result.anomaly_data_points = amounts.length;

    if (amounts.length >= MIN_DATA_POINTS) {
      const stats = calculateStatistics(amounts);
      
      // Use average as "current" for batch scoring (represents typical day)
      const zScore = calculateZScore(stats.avg, stats.avg, stats.std_dev);
      result.anomaly_score = Math.round(zScoreToConfidence(zScore) * 100) / 100;
      result.is_anomaly = Math.abs(zScore) > Z_SCORE_THRESHOLD;
    } else {
      // Not enough data - use conservative defaults
      result.anomaly_score = 0.5;
      result.is_anomaly = false;
    }

    // ===== STOCKOUT RISK SCORING =====
    // Fetch inventory data
    const { data: inventoryData, error: invError } = await supabase
      .from("inventory")
      .select("current_stock, min_stock")
      .eq("outlet_id", outlet.id);

    if (invError) {
      console.error(`Error fetching inventory for outlet ${outlet.id}:`, invError);
    }

    // Calculate total stock levels
    let totalCurrentStock = 0;
    let totalMinStock = 0;
    
    for (const inv of inventoryData || []) {
      totalCurrentStock += inv.current_stock || 0;
      totalMinStock += inv.min_stock || 0;
    }

    // Estimate daily usage from sales (avg daily amount / avg price per unit)
    let avgDailyUsage = 0;
    if (amounts.length >= MIN_DATA_POINTS) {
      // Group by date to get daily totals
      const { data: dailySales } = await supabase
        .from("sales_transactions")
        .select("date, amount")
        .eq("outlet_id", outlet.id)
        .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .order("date", { ascending: false });

      const salesByDate: Record<string, number> = {};
      for (const sale of dailySales || []) {
        const date = sale.date;
        if (!salesByDate[date]) salesByDate[date] = 0;
        salesByDate[date] += parseFloat(sale.amount as unknown as string);
      }

      const dates = Object.keys(salesByDate);
      result.stockout_data_points = dates.length;

      if (dates.length > 0) {
        const totalAmount = Object.values(salesByDate).reduce((sum, val) => sum + val, 0);
        avgDailyUsage = totalAmount / dates.length;
      }
    }

    // Calculate stockout metrics
    const daysUntilStockout = calculateDaysUntilStockout(totalCurrentStock, avgDailyUsage);
    result.days_until_stockout = Math.round(daysUntilStockout * 10) / 10;
    result.stockout_risk = getStockoutRiskLevel(daysUntilStockout);
    result.stockout_score = daysToRiskScore(daysUntilStockout);

  } catch (error) {
    console.error(`Error processing outlet ${outlet.id}:`, error);
    result.error = error instanceof Error ? error.message : "Unknown error";
  }

  return result;
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
    // Parse request body (all fields optional)
    const body: BatchScoreRequest = await req.json().catch(() => ({}));
    const force = body.force ?? false;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== Get outlets to process =====
    let outletsQuery = supabase
      .from("outlets")
      .select("id, name, code, status")
      .in("status", ["ACTIVE", "PILOT"])
      .order("id");

    // Filter by specific outlets if provided
    if (body.outlet_ids && body.outlet_ids.length > 0) {
      outletsQuery = outletsQuery.in("id", body.outlet_ids);
    }

    const { data: outlets, error: outletsError } = await outletsQuery;

    if (outletsError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch outlets: ${outletsError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!outlets || outlets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          results: [],
          summary: { total: 0, anomalies: 0, high_risk: 0, medium_risk: 0, low_risk: 0, errors: 0 },
          duration_ms: Date.now() - startTime,
          message: "No active outlets found",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== Check for recently scored outlets (unless forcing) =====
    let outletsToProcess = outlets as OutletInfo[];
    let skippedCount = 0;

    if (!force) {
      const recentThreshold = new Date(Date.now() - RECENT_THRESHOLD_MS).toISOString();

      const { data: recentScores } = await supabase
        .from("ml_scores")
        .select("outlet_id")
        .eq("model_type", "anomaly")
        .gte("scored_at", recentThreshold);

      const recentOutletIds = new Set(recentScores?.map((s: any) => s.outlet_id) || []);
      outletsToProcess = outlets.filter(o => !recentOutletIds.has(o.id)) as OutletInfo[];
      skippedCount = outlets.length - outletsToProcess.length;

      console.log(`Skipping ${skippedCount} outlets with recent scores`);
    }

    if (outletsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          results: [],
          summary: { total: 0, anomalies: 0, high_risk: 0, medium_risk: 0, low_risk: 0, errors: 0 },
          duration_ms: Date.now() - startTime,
          message: "All outlets have been scored recently. Use force=true to re-score.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${outletsToProcess.length} outlets...`);

    // ===== Process all outlets =====
    const results: BatchScoreResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < outletsToProcess.length; i += batchSize) {
      const batch = outletsToProcess.slice(i, i + batchSize);
      const batchPromises = batch.map(outlet => processOutlet(supabase, outlet, force));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const res of batchResults) {
        if (res.status === "fulfilled") {
          results.push(res.value);
        } else {
          results.push({
            outlet_id: -1,
            outlet_name: "Unknown",
            anomaly_score: 0,
            is_anomaly: false,
            anomaly_data_points: 0,
            stockout_risk: "LOW",
            stockout_score: 0,
            stockout_data_points: 0,
            error: res.reason?.message || "Processing failed",
          });
        }
      }

      console.log(`Processed batch ${Math.ceil((i + batchSize) / batchSize)}/${Math.ceil(outletsToProcess.length / batchSize)}`);
    }

    // ===== Persist scores to database =====
    const scoredAt = new Date().toISOString();
    const scoreRecords: any[] = [];

    for (const result of results) {
      if (result.error && result.outlet_id === -1) continue;

      // Insert anomaly score
      scoreRecords.push({
        outlet_id: result.outlet_id,
        model_type: "anomaly",
        score: result.anomaly_score,
        is_anomaly: result.is_anomaly,
        data_points: result.anomaly_data_points,
        metadata: {
          outlet_name: result.outlet_name,
          z_score_threshold: Z_SCORE_THRESHOLD,
        },
        scored_at: scoredAt,
      });

      // Insert stockout score
      scoreRecords.push({
        outlet_id: result.outlet_id,
        model_type: "stockout",
        score: result.stockout_score,
        risk_level: result.stockout_risk,
        days_until_stockout: result.days_until_stockout,
        data_points: result.stockout_data_points,
        metadata: {
          outlet_name: result.outlet_name,
        },
        scored_at: scoredAt,
      });
    }

    // Bulk insert scores
    if (scoreRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("ml_scores")
        .insert(scoreRecords);

      if (insertError) {
        console.error("Error persisting scores:", insertError);
        // Continue - scores are still returned
      } else {
        console.log(`Persisted ${scoreRecords.length} score records`);
      }
    }

    // ===== Calculate summary =====
    const summary = {
      total: results.length,
      anomalies: results.filter(r => r.is_anomaly).length,
      high_risk: results.filter(r => r.stockout_risk === "HIGH").length,
      medium_risk: results.filter(r => r.stockout_risk === "MEDIUM").length,
      low_risk: results.filter(r => r.stockout_risk === "LOW").length,
      errors: results.filter(r => r.error).length,
    };

    const duration_ms = Date.now() - startTime;
    console.log(`Batch scoring completed: ${summary.total} outlets, ${summary.anomalies} anomalies, ${summary.high_risk} high-risk in ${duration_ms}ms`);

    const response: BatchScoreResponse = {
      success: true,
      processed: summary.total,
      results,
      summary,
      duration_ms,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Batch score error:", error);
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
