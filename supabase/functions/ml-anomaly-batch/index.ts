/**
 * ML Anomaly Batch Edge Function
 * Calculates anomaly scores for ALL outlets in one call
 * POST endpoint - Input: none (gets all outlets from DB)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Z_SCORE_THRESHOLD = 2.5;
const MIN_DATA_POINTS = 5;

interface OutletAnomalyScore {
  outlet_id: number;
  outlet_name: string;
  outlet_code: string;
  current_sales: number;
  anomaly_score: number;
  percentile: number;
  is_anomaly: boolean;
  status: "CRITICAL" | "WARNING" | "OK";
  message: string;
}

interface BatchAnomalyResponse {
  timestamp: string;
  outlets: OutletAnomalyScore[];
  summary: {
    total_outlets: number;
    anomalies_detected: number;
    critical_count: number;
    warning_count: number;
    ok_count: number;
  };
}

function calculateStatistics(values: number[]): { avg: number; std_dev: number } {
  if (values.length === 0) return { avg: 0, std_dev: 0 };
  const n = values.length;
  const avg = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / n;
  const std_dev = Math.sqrt(variance);
  return { avg, std_dev };
}

function calculateZScore(current: number, avg: number, std_dev: number): number {
  if (std_dev === 0) return 0;
  return (current - avg) / std_dev;
}

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

function getStatus(zScore: number): "CRITICAL" | "WARNING" | "OK" {
  const absScore = Math.abs(zScore);
  if (absScore >= 2.5) return "CRITICAL";
  if (absScore >= 1.5) return "WARNING";
  return "OK";
}

function getMessage(zScore: number): string {
  const absScore = Math.abs(zScore);
  if (absScore < 1) return "Normal sales pattern";
  if (absScore < 2) return zScore > 0 ? "Above average" : "Below average";
  if (absScore < 2.5) return zScore > 0 ? "High anomaly detected" : "Low anomaly detected";
  return zScore > 0 ? "CRITICAL: Unusually high sales!" : "CRITICAL: Unusually low sales!";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.substring(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify token
  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": serviceKey },
  });

  if (!verifyResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const today = new Date().toISOString().split("T")[0];

    // Get all outlets
    const { data: outlets, error: outletsError } = await supabase
      .from("outlets")
      .select("id, name, code, status")
      .eq("status", "active");

    if (outletsError) throw outletsError;

    // Get today's sales per outlet
    const { data: salesData, error: salesError } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    if (salesError) throw salesError;

    // Get historical data for ALL outlets
    const { data: historicalData, error: histError } = await supabase
      .from("sales_transactions")
      .select("outlet_id, amount")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (histError) throw histError;

    // Calculate total sales per outlet (today)
    const outletSales: Record<number, number> = {};
    for (const sale of salesData || []) {
      outletSales[sale.outlet_id] = (outletSales[sale.outlet_id] || 0) + parseFloat(sale.amount);
    }

    // Group historical data by outlet
    const historicalByOutlet: Record<number, number[]> = {};
    for (const row of historicalData || []) {
      if (!historicalByOutlet[row.outlet_id]) {
        historicalByOutlet[row.outlet_id] = [];
      }
      historicalByOutlet[row.outlet_id].push(parseFloat(row.amount));
    }

    // Calculate anomaly scores for each outlet
    const outletAnomalies: OutletAnomalyScore[] = [];
    let criticalCount = 0;
    let warningCount = 0;
    let okCount = 0;

    for (const outlet of outlets || []) {
      const currentSales = outletSales[outlet.id] || 0;
      const historicalSales = historicalByOutlet[outlet.id] || [];
      const { avg, std_dev } = calculateStatistics(historicalSales);

      let zScore = 0;
      let percentile = 50;
      let isAnomaly = false;

      if (historicalSales.length >= MIN_DATA_POINTS && std_dev > 0) {
        zScore = calculateZScore(currentSales, avg, std_dev);
        percentile = calculatePercentile(historicalSales, currentSales);
        isAnomaly = Math.abs(zScore) > Z_SCORE_THRESHOLD;
      } else {
        // Fallback: use simple percentage deviation from average
        // Assume avg is 100 and current is relative
        zScore = historicalSales.length > 0 ? (currentSales - avg) / (avg * 0.3) : 0;
        percentile = currentSales > avg ? 75 : 25;
      }

      const status = getStatus(zScore);

      if (status === "CRITICAL") criticalCount++;
      else if (status === "WARNING") warningCount++;
      else okCount++;

      outletAnomalies.push({
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        outlet_code: outlet.code,
        current_sales: Math.round(currentSales * 100) / 100,
        anomaly_score: Math.round(zScore * 100) / 100,
        percentile,
        is_anomaly: isAnomaly,
        status,
        message: getMessage(zScore),
      });
    }

    // Sort by anomaly score (most anomalous first)
    outletAnomalies.sort((a, b) => Math.abs(b.anomaly_score) - Math.abs(a.anomaly_score));

    const response: BatchAnomalyResponse = {
      timestamp: new Date().toISOString(),
      outlets: outletAnomalies,
      summary: {
        total_outlets: outlets?.length || 0,
        anomalies_detected: outletAnomalies.filter(o => o.is_anomaly).length,
        critical_count: criticalCount,
        warning_count: warningCount,
        ok_count: okCount,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Batch anomaly error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
