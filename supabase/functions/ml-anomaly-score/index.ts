/**
 * ML Anomaly Score Edge Function
 * Calculates z-score based anomaly detection for sales data
 * POST endpoint - Input: outlet_id, current_sales, hour, day_of_week
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Anomaly detection threshold
const Z_SCORE_THRESHOLD = 2.5;

// Minimum historical data points required for reliable statistics
const MIN_DATA_POINTS = 5;

interface AnomalyScoreRequest {
  outlet_id: number;
  current_sales: number;
  hour?: number;
  day_of_week?: number;
}

interface AnomalyScoreResponse {
  score: number;
  is_anomaly: boolean;
  threshold: number;
  avg: number;
  std_dev: number;
  message: string;
  percentile?: number;
  data_points?: number;
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
  if (std_dev === 0) {
    return 0; // No variation in historical data
  }
  return (current - avg) / std_dev;
}

/**
 * Calculate percentile (what percentage of historical data is below current value)
 */
function calculatePercentile(values: number[], current: number): number {
  if (values.length === 0) return 50;
  
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  
  for (const val of sorted) {
    if (val < current) count++;
    else break;
  }
  
  return Math.round((count / sorted.length) * 100);
}

/**
 * Get message based on z-score
 */
function getAnomalyMessage(zScore: number, percentile: number): string {
  const absScore = Math.abs(zScore);
  
  if (absScore < 1) {
    return "Normal sales pattern within expected range";
  } else if (absScore < 2) {
    return zScore > 0 
      ? "Sales are above average - potential positive anomaly"
      : "Sales are below average - potential negative anomaly";
  } else if (absScore < 2.5) {
    return zScore > 0
      ? "Significant positive anomaly - sales are notably higher than usual"
      : "Significant negative anomaly - sales are notably lower than usual";
  } else {
    return zScore > 0
      ? "CRITICAL: Sales anomaly detected - unusually high sales volume!"
      : "CRITICAL: Sales anomaly detected - unusually low sales volume!";
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify JWT authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify token with Supabase
  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": serviceKey,
    },
  });

  if (!verifyResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request body
    const body: AnomalyScoreRequest = await req.json();

    // Validate required fields
    if (!body.outlet_id || typeof body.outlet_id !== "number") {
      return new Response(
        JSON.stringify({ error: "outlet_id is required and must be a number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof body.current_sales !== "number" || body.current_sales < 0) {
      return new Response(
        JSON.stringify({ error: "current_sales is required and must be a non-negative number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query for historical data
    // Get sales data for the same outlet, hour, and day_of_week if provided
    let query = supabase
      .from("sales_transactions")
      .select("amount, hour, day_of_week")
      .eq("outlet_id", body.outlet_id)
      .order("created_at", { ascending: false })
      .limit(500); // Get last 500 transactions for better statistics

    // Apply time-based filters if provided
    if (body.hour !== undefined) {
      query = query.eq("hour", body.hour);
    }

    if (body.day_of_week !== undefined) {
      query = query.eq("day_of_week", body.day_of_week);
    }

    // Execute query
    const { data: historicalData, error } = await query;

    if (error) {
      console.error("Error fetching historical data:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch historical sales data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we don't have enough data with exact filters, broaden the search
    let amounts: number[] = [];
    
    if (historicalData && historicalData.length >= MIN_DATA_POINTS) {
      amounts = historicalData.map((row) => parseFloat(row.amount as unknown as string));
    } else {
      // Broaden query - just outlet level data
      const { data: broaderData } = await supabase
        .from("sales_transactions")
        .select("amount")
        .eq("outlet_id", body.outlet_id)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (broaderData && broaderData.length >= MIN_DATA_POINTS) {
        amounts = broaderData.map((row) => parseFloat(row.amount as unknown as string));
      }
    }

    // Calculate statistics
    const { avg, std_dev } = calculateStatistics(amounts);

    // If we still don't have enough data, use conservative defaults
    if (amounts.length < MIN_DATA_POINTS) {
      console.warn(`Insufficient historical data for outlet ${body.outlet_id}. Using fallback values.`);
      
      // Use reasonable defaults for new outlets
      const fallbackAvg = body.current_sales * 1.0; // Assume current is average
      const fallbackStdDev = fallbackAvg * 0.3; // 30% variation is typical
      
      const zScore = calculateZScore(body.current_sales, fallbackAvg, fallbackStdDev);
      const percentile = 50; // Neutral percentile for fallback
      const isAnomaly = false; // Don't flag anomalies with insufficient data

      const response: AnomalyScoreResponse = {
        score: Math.round(zScore * 100) / 100,
        is_anomaly: false,
        threshold: Z_SCORE_THRESHOLD,
        avg: fallbackAvg,
        std_dev: fallbackStdDev,
        message: "Insufficient historical data for accurate anomaly detection. Using conservative estimates.",
        percentile,
        data_points: amounts.length,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate z-score
    const zScore = calculateZScore(body.current_sales, avg, std_dev);
    const isAnomaly = Math.abs(zScore) > Z_SCORE_THRESHOLD;
    const percentile = calculatePercentile(amounts, body.current_sales);
    const message = getAnomalyMessage(zScore, percentile);

    const response: AnomalyScoreResponse = {
      score: Math.round(zScore * 100) / 100,
      is_anomaly: isAnomaly,
      threshold: Z_SCORE_THRESHOLD,
      avg: Math.round(avg * 100) / 100,
      std_dev: Math.round(std_dev * 100) / 100,
      message,
      percentile,
      data_points: amounts.length,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Anomaly score error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
