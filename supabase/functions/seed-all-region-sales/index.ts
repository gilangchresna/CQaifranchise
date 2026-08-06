/// <reference lib="deno.ns" />
/**
 * Seed Regional Sales Data
 * Populates sales_transactions for all outlets across SG/JKT/BDG/SBY/BKK/KUL
 * Uses service role key — no RLS restrictions.
 * Idempotent: checks existing data per outlet before inserting.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Outlet config: [outletId, outletCode, baseAmountMYR, currency, divisor]
type OutletConfig = [number, string, number, string, number];

const OUTLET_CONFIG: OutletConfig[] = [
  // Singapore (SGD) — S$1 ≈ RM3.6
  [1, "WKN-001", 1100, "SGD", 1],
  [2, "MYB-002",  850, "SGD", 1],
  [3, "SAP-003", 1400, "SGD", 1],
  // Jakarta (IDR) — Rp 1jt ≈ RM250
  [4,  "JKT-004",       8000, "IDR", 1000],
  [11, "OUT-JTG-001",   6000, "IDR", 1000],
  [12, "OUT-JTM-001",   7500, "IDR", 1000],
  [22, "JKT-PUSAT-001", 9000, "IDR", 1000],
  [24, "JKT-SELATAN-001", 7000, "IDR", 1000],
  // Bandung (IDR)
  [5, "BDG-005", 4000, "IDR", 1000],
  // Surabaya (IDR)
  [6, "SBY-006", 6000, "IDR", 1000],
  // Bangkok (THB) — ฿1 ≈ RM0.12
  [7, "BKK-007", 600, "THB", 1],
  // Kuala Lumpur (MYR)
  [8, "KUL-008", 900, "MYR", 1],
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateTransactionId(outletCode: string, dateStr: string, index: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${outletCode}-${dateStr}-T${index.toString().padStart(6, "0")}-${suffix}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let totalInserted = 0;
  let totalSkipped = 0;
  const details: Record<string, { status: string; count: number }> = {};

  for (const [outletId, outletCode, baseMYR, ,] of OUTLET_CONFIG) {
    // Check if this outlet already has data
    const { data: existing } = await supabase
      .from("sales_transactions")
      .select("id")
      .eq("outlet_id", outletId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Outlet ${outletId} (${outletCode}): already has data, skipping`);
      details[`${outletCode}`] = { status: "skipped", count: 0 };
      totalSkipped++;
      continue;
    }

    // Generate 13 days: July 24 - Aug 5, 2026
    const rows: any[] = [];
    const startDate = new Date("2026-07-24");

    for (let d = 0; d < 13; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];
      const dow = date.getDay(); // 0=Sun, 6=Sat

      // Day-of-week multiplier
      let dowMult = 1.0;
      if (dow === 0 || dow === 6) {
        dowMult = 1.25; // weekend boost
      } else if (dow === 1) {
        dowMult = 0.85; // Monday dip
      }

      // Random daily variation ±15%
      const noise = 0.85 + Math.random() * 0.30;
      const amountMYR = baseMYR * dowMult * noise;

      // Transaction count: 15-60 per day
      const txCount = Math.floor(randomBetween(15, 60));

      // Anomaly: ~5% chance of spike
      const isAnomaly = Math.random() < 0.05;
      const anomalyScore = isAnomaly
        ? randomBetween(0.7, 0.99)
        : randomBetween(0.0, 0.25);

      // Generate multiple tx per day to simulate real transactions
      // Split daily amount into 3-5 "transactions"
      const numTx = Math.floor(randomBetween(3, 6));
      for (let t = 0; t < numTx; t++) {
        const txAmount = Math.round((amountMYR / numTx) * 100) / 100;
        rows.push({
          transaction_id: generateTransactionId(outletCode, dateStr.replace(/-/g, ""), d * 10 + t),
          date: dateStr,
          amount: txAmount,
          transaction_count: Math.floor(txCount / numTx),
          outlet_id: outletId,
          anomaly_score: Math.round(anomalyScore * 100) / 100,
          is_anomaly: isAnomaly,
        });
      }
    }

    const { error } = await supabase.from("sales_transactions").insert(rows);
    if (error) {
      console.error(`Outlet ${outletCode}: insert error — ${error.message}`);
      details[`${outletCode}`] = { status: `error: ${error.message}`, count: 0 };
    } else {
      console.log(`Outlet ${outletCode}: inserted ${rows.length} rows`);
      details[`${outletCode}`] = { status: "inserted", count: rows.length };
      totalInserted += rows.length;
    }
  }

  // Get total count
  const { count } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true });

  return new Response(JSON.stringify({
    status: "ok",
    inserted: totalInserted,
    skipped: totalSkipped,
    total_rows: count,
    details,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
