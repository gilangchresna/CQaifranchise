/// <reference lib="deno.ns" />
/**
 * Seed Stockout Risk Predictions
 * Creates risk predictions for all 20 outlets.
 * Uses service role — no RLS restrictions.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// outlet_id → { risk_level, risk_score, low_stock_items, out_of_stock_items, stock_level_pct, days_of_stock }
const STOCKOUT_DATA: Record<number, { risk_level: string; risk_score: number; low_stock: number; oos: number; stock_pct: number; days: number }> = {
  1:  { risk_level: "LOW",     risk_score: 0.12, low_stock: 1,  oos: 0, stock_pct: 82, days: 12 },
  2:  { risk_level: "LOW",     risk_score: 0.15, low_stock: 0,  oos: 0, stock_pct: 88, days: 15 },
  3:  { risk_level: "MEDIUM",  risk_score: 0.41, low_stock: 3,  oos: 1, stock_pct: 61, days: 7 },
  4:  { risk_level: "HIGH",    risk_score: 0.78, low_stock: 8,  oos: 3, stock_pct: 34, days: 3 },
  5:  { risk_level: "MEDIUM",  risk_score: 0.52, low_stock: 5,  oos: 2, stock_pct: 55, days: 6 },
  6:  { risk_level: "LOW",      risk_score: 0.22, low_stock: 2,  oos: 0, stock_pct: 75, days: 10 },
  7:  { risk_level: "MEDIUM",  risk_score: 0.48, low_stock: 4,  oos: 1, stock_pct: 58, days: 8 },
  8:  { risk_level: "LOW",      risk_score: 0.18, low_stock: 1,  oos: 0, stock_pct: 79, days: 11 },
  9:  { risk_level: "HIGH",    risk_score: 0.72, low_stock: 7,  oos: 2, stock_pct: 38, days: 4 },
  10: { risk_level: "MEDIUM",  risk_score: 0.45, low_stock: 4,  oos: 1, stock_pct: 60, days: 7 },
  11: { risk_level: "LOW",     risk_score: 0.25, low_stock: 2,  oos: 0, stock_pct: 73, days: 9 },
  12: { risk_level: "MEDIUM",  risk_score: 0.55, low_stock: 5,  oos: 2, stock_pct: 52, days: 6 },
  164: { risk_level: "LOW",    risk_score: 0.20, low_stock: 1,  oos: 0, stock_pct: 80, days: 11 },
  165: { risk_level: "LOW",    risk_score: 0.17, low_stock: 0,  oos: 0, stock_pct: 85, days: 13 },
  166: { risk_level: "LOW",    risk_score: 0.14, low_stock: 1,  oos: 0, stock_pct: 83, days: 12 },
  167: { risk_level: "MEDIUM",  risk_score: 0.44, low_stock: 3,  oos: 1, stock_pct: 59, days: 8 },
  168: { risk_level: "LOW",     risk_score: 0.19, low_stock: 1,  oos: 0, stock_pct: 78, days: 10 },
  169: { risk_level: "MEDIUM",  risk_score: 0.50, low_stock: 4,  oos: 1, stock_pct: 57, days: 7 },
  170: { risk_level: "LOW",     risk_score: 0.21, low_stock: 1,  oos: 0, stock_pct: 76, days: 10 },
  171: { risk_level: "MEDIUM",  risk_score: 0.47, low_stock: 3,  oos: 1, stock_pct: 60, days: 7 },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let upserted = 0;
  let errors = 0;
  const results: Record<string, string> = {};

  for (const [outlet_id, data] of Object.entries(STOCKOUT_DATA)) {
    const { error } = await supabase.from("stockout_risk_predictions").upsert({
      outlet_id: Number(outlet_id),
      risk_level: data.risk_level,
      risk_score: data.risk_score,
      low_stock_items: data.low_stock,
      out_of_stock_items: data.oos,
      stock_level_pct: data.stock_pct,
      days_of_stock: data.days,
      prediction_date: new Date().toISOString().split("T")[0],
      model_version: "v2.0",
      created_at: new Date().toISOString(),
    }, { onConflict: "outlet_id,prediction_date" });

    if (error) {
      errors++;
      results[`outlet:${outlet_id}`] = error.message;
    } else {
      upserted++;
      results[`outlet:${outlet_id}`] = "ok";
    }
  }

  return new Response(JSON.stringify({
    status: "ok",
    upserted,
    errors,
    total: Object.keys(STOCKOUT_DATA).length,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
