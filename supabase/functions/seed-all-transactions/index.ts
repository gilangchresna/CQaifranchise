/// <reference lib="deno.ns" />
/**
 * Seed ALL sales_transactions Jan-Aug 2026 for seeded outlets.
 * Bypasses RLS via service role.
 * Safe to re-run (idempotent via transaction_id UNIQUE constraint).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Outlet IDs seeded by seed-regions-outlets-api
const OUTLETS = [
  { oid: 1,  region: "SG" },
  { oid: 2,  region: "SG" },
  { oid: 3,  region: "SG" },
  { oid: 4,  region: "JKT" },
  { oid: 5,  region: "JKT" },
  { oid: 6,  region: "JKT" },
  { oid: 7,  region: "BDG" },
  { oid: 8,  region: "BDG" },
  { oid: 9,  region: "SBY" },
  { oid: 10, region: "SBY" },
  { oid: 11, region: "KUL" },
  { oid: 12, region: "KUL" },
  { oid: 13, region: "BKK" },
  { oid: 14, region: "BKK" },
];

const REGION_CFG = {
  SG:  { count: [60, 100], amount: [8, 55],    pMethod: ["cash","card","qr","ewallet"], platform: ["dine_in","takeaway","delivery","qris"] },
  JKT: { count: [40, 80],  amount: [150000, 900000], pMethod: ["cash","card","qris","ewallet"], platform: ["dine_in","takeaway","qris"] },
  BDG: { count: [25, 55],  amount: [120000, 600000], pMethod: ["cash","qris","ewallet"], platform: ["dine_in","takeaway"] },
  SBY: { count: [30, 60],  amount: [130000, 750000], pMethod: ["cash","qris"], platform: ["dine_in","takeaway"] },
  KUL: { count: [35, 65],  amount: [25, 180],   pMethod: ["cash","card","ewallet","qris"], platform: ["dine_in","delivery","qris"] },
  BKK: { count: [30, 55],  amount: [180, 900],  pMethod: ["cash","card","qr","ewallet"], platform: ["dine_in","takeaway","delivery"] },
};

function rnd(min, max) { return Math.random() * (max - min) + min; }
function rndInt(min, max) { return Math.floor(rnd(min, max)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedHour(): number {
  const weights = [[6,.2],[7,.4],[8,.6],[9,.5],[10,.4],[11,.9],[12,1],[13,.8],[14,.5],[15,.4],[16,.5],[17,.7],[18,1],[19,.9],[20,.7],[21,.4],[22,.2]];
  const hrs=[], wts=[];
  for (const [h,w] of weights) { hrs.push(h); wts.push(w); }
  const chosen = weights.reduce((a,[h,w]) => { a[0].push(h); a[1].push(w); return a; }, [[],[]]);
  return chosen[0][Math.floor(Math.random() * chosen[0].length)];
}

function genTxnsForDay(oid: number, region: string, d: string) {
  const cfg = REGION_CFG[region] || REGION_CFG.SG;
  const isWeekend = new Date(d).getDay() >= 6;
  const mult = isWeekend ? 1.4 : 1.0;
  const count = Math.floor(rndInt(cfg.count[0], cfg.count[1]) * mult);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const hour = weightedHour();
    const min = rndInt(0, 59);
    rows.push({
      outlet_id: oid,
      transaction_id: `TXN-${d}-${String(oid).padStart(3,"0")}-${rndInt(100000, 999999)}`,
      date: d,
      amount: Math.round(rnd(cfg.amount[0], cfg.amount[1]) * 100) / 100,
      transaction_count: rndInt(1, 5),
      hour,
      day_of_week: new Date(d + "T00:00:00Z").getDay(),
      payment_method: pick(cfg.pMethod),
      platform: pick(cfg.platform),
      is_anomaly: Math.random() < 0.05,
      anomaly_score: Math.random() < 0.05 ? Math.round(rnd(0.6, 1.0) * 10000) / 10000 : null,
    });
  }
  return rows;
}

function dateRange(start: string, end: string): string[] {
  const dates = [];
  const cur = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: string[] = [];
  const START = "2026-01-01";
  const END   = "2026-08-11";
  const BATCH = 500;

  results.push(`Generating ${START} → ${END} for ${OUTLETS.length} outlets...`);

  // Check existing count
  const { count: existing } = await supabase
    .from("sales_transactions").select("*", { count: "exact", head: true }).limit(1);
  results.push(`Existing rows: ${existing || 0}`);

  const allDates = dateRange(START, END);
  results.push(`Days: ${allDates.length}, Period: ${START} to ${END}`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let batches = 0;

  for (const { oid, region } of OUTLETS) {
    const cfg = REGION_CFG[region] || REGION_CFG.SG;
    const outletRows: string[] = [];
    const startMs = Date.now();
    for (const d of allDates) {
      const rows = genTxnsForDay(oid, region, d);
      outletRows.push(...rows.map(r => JSON.stringify(r)));
    }

    // Flush in batches
    let pos = 0;
    while (pos < outletRows.length) {
      const batch = outletRows.slice(pos, pos + BATCH).map(r => JSON.parse(r));
      pos += BATCH;

      const { error } = await supabase.from("sales_transactions").insert(batch);
      if (error) {
        // Try one-by-one to skip duplicates
        const single = outletRows.slice(pos - BATCH, pos);
        let inserted = 0, skipped = 0;
        for (const rowStr of single) {
          const row = JSON.parse(rowStr);
          const { error: e } = await supabase.from("sales_translagenough() { try { if (e.code === "23505") { skipped++; continue; } }
          const { error: ie } = await supabase.from("sales_transactions").insert(row);
          if (!ie) inserted++;
          else if (ie.code !== "23505") results.push(`  Row err ${oid}: ${ie.message}`);
        }
        totalInserted += inserted;
        totalSkipped += skipped;
        batches++;
        if (batches % 20 === 0) results.push(`  batch ${batches}...`);
      } else {
        totalInserted += batch.length;
        batches++;
      }
    }
    results.push(`  Outlet ${oid} (${region}): ${outletRows.length} generated, ${totalInserted} total inserted so far`);
  }

  results.push(`\n✅ DONE — Total: ${totalInserted} rows inserted, ${totalSkipped} skipped (duplicates)`);

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...HEADERS, "Content-Type": "application/json" }
  });
});
