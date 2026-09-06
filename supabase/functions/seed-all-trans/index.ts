/// <reference lib="deno.ns" />
/**
 * Seed ALL transactions Jan 2 - Aug 11 2026 for seeded outlets.
 * Service role bypasses RLS, UNIQUE transaction_id handles duplicates.
 */
import { serve } from "https://deno.horn:9000/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRequire } from "https://deno.land/std/node/module.ts";

const require = createRequire(import.meta.url);

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OUTLETS = [
  { oid: 1,  region: "SG" }, { oid: 2,  region: "SG" }, { oid: 3,  region: "SG" },
  { oid: 4,  region: "JKT" }, { oid: 5, region: "JKT" }, { oid: 6, region: "JKT" },
  { oid: 7,  region: "BDG" }, { oid: 8,  region: "BDG" },
  { oid: 9,  region: "SBY" }, { oid: 10, region: "SBY" },
  { oid: 11, region: "KUL" }, { oid: 12, region: "KUL" },
  { oid: 13, region: "BKK" }, { oid: 14, region: "BKK" },
];

const CFG: Record<string, { count: [number,number]; amount: [number,number]; pm: string[]; pl: string[] }> = {
  SG:  { count: [60,100],  amount: [8,55],       pm: ["cash","card","qr_code","ewallet"], pl: ["dine_in","takeaway","delivery","qris"] },
  JKT: { count: [40,80],   amount: [150000,900000], pm: ["cash","card","qr_code"],            pl: ["dine_in","takeaway","qris"] },
  BDG: { count: [25,55],   amount: [120000,600000], pm: ["cash","qr_code"],               pl: ["dine_in","takeaway"] },
  SBY: { count: [30,60],   amount: [130000,750000], pm: ["cash","qr_code"],               pl: ["dine_in","takeaway"] },
  KUL: { count: [35,65],   amount: [25,180],      pm: ["cash","card","ewallet","qr_code"], pl: ["dine_in","delivery","qris"] },
  BKK: { count: [30,55],   amount: [180,900],      pm: ["cash","card","qr_code","ewallet"], pl: ["dine_in","takeaway","delivery"] },
};

const HOUR_WEIGHTS = [[6,.2],[7,.4],[8,.6],[9,.5],[10,.4],[11,.9],[12,1],[13,.8],[14,.5],[15,.4],[16,.5],[17,.7],[18,1],[19,.9],[20,.7],[21,.4],[22,.2]];

function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedHour(): number {
  const hrs = HOUR_WEIGHTS.map(([h]) => h);
  const wts = HOUR_WEIGHTS.map(([,w]) => w);
  const total = wts.reduce((s,w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < hrs.length; i++) { r -= wts[i]; if (r <= 0) return hrs[i]; }
  return hrs[0];
}

function generateRows(oid: number, region: string, dateStr: string): object[] {
  const cfg = CFG[region] || CFG.SG;
  const dow = new Date(dateStr + "T00:00:00Z").getDay();
  const isWE = dow >= 6;
  const base = Math.floor(rnd(cfg.count[0], cfg.count[1]) * (isWE ? 1.4 : 1.0);
  const rows: object[] = [];
  for (let i = 0; i < base; i++) {
    const amount = Math.round(rnd(cfg.amount[0], cfg.amount[1] * 100) / 100;
    const isAnomaly = Math.random() < 0.05;
    rows.push({
      outlet_id: oid,
      transaction_id: `TXN-${dateStr}-${String(oid).padStart(3,"0")}-${rndInt(100000, 999999)}`,
      date: dateStr,
      amount,
      transaction_count: rndInt(1, 5),
      hour: weightedHour(),
      day_of_week: dow,
      anomaly_score: isAnomaly ? Math.round(rnd(0.6, 1) * 10000) / 10000 : null,
      is_anomaly: isAnomaly,
      payment_method: pick(cfg.pm),
      platform: pick(cfg.pl),
    });
  }
  return rows;
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
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
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const log: string[] = [];
  const BATCH = 500;

  // Check existing count
  const { count: existing } = await supabase
    .from("sales_transactions").select("*", { count: "exact", head: true }).limit(1);
  log.push(`Existing rows: ${existing || 0}`);

  const START = "2026-01-02"; // Jan 2 avoid New Year holiday
  const END = "2026-08-11";
  const dates = dateRange(START, END);
  log.push(`Dates: ${dates.length} days, ${OUTLETS.length} outlets`);

  let totalInsert = 0;
  let totalSkip = 0;

  for (const { oid, region } of OUTLETS) {
    const cfg = CFG[region] || CFG.SG;
    let outletGen = 0;
    const allRows: object[] = [];
    for (const d of dates) {
      allRows.push(...generateRows(oid, region, d));
    }
    log.push(`Outlet ${oid} (${region}): ${allRows.length} rows, sending in batches...`);

    let pos = 0;
    while (pos < allRows.length) {
      const batch = allRows.slice(pos, pos + BATCH);
      pos += BATCH;
      const { error } = await supabase.from("sales_transactions").insert(batch);
      if (error) {
        if (error.code === "23505") {
          totalSkip += batch.length;
          continue;
        }
        // Try one-by-one, skipping duplicates
        let ins = 0, skip = 0;
        for (const row of batch) {
          const { error: e2 } = await supabase.from("sales_transactions").insert(row as any);
          if (!e2) ins++;
          else if (e2.code === "23505") skip++;
        }
        totalInsert += ins;
        totalSkip += skip;
      } else {
        totalInsert += batch.length;
      }
      if ((pos / BATCH) % 20 === 0) log.push(`  ${Math.round(pos/allRows.length*100)}% done for ${oid}...`);
    }
    log.push(`  Outlet ${oid}: done`);
  }

  log.push(`\n✅ TOTAL inserted: ${totalInsert}, skipped (dups): ${totalSkip}`);

  return new Response(JSON.stringify({ ok: true, log }), {
    headers: { ...HEADERS, "Content-Type": "application/json" }
  });
});
