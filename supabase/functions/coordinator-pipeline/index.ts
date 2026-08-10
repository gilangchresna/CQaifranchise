/// <reference lib="deno.ns" />
// AI Pipeline Coordinator
// Full ML: anomaly + stockout + alerts
// No auth (service role)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sb = createClient(SB_URL, SB_KEY);

// FX rate to SGD (per 1 unit of local currency → SGD)
function toSGD(currency: string): number {
  if (currency === "SGD") return 1;
  if (currency === "IDR") return 1 / 12500;
  if (currency === "THB") return 1 / 27.5;
  if (currency === "MYR") return 1 / 3.4;
  return 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });

  const now = new Date();
  const out: Record<string, any> = {};
  const t0 = now.toISOString().slice(0, 10);        // today date string "YYYY-MM-DD"
  const t7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const t30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const t1h = new Date(now.getTime() - 3600000).toISOString();

  // ── STEP 1: Anomaly ──────────────────────────────────────
  try {
    const { data: regions } = await sb.from("regions").select("id, currency_code");
    const rmap: Record<number, string> = {};
    (regions || []).forEach((r: any) => { rmap[r.id] = r.currency_code || "SGD"; });

    const { data: outlets } = await sb.from("outlets").select("id, name, code, region_id");
    const omap: Record<number, any> = {};
    const cmap: Record<number, string> = {};
    (outlets || []).forEach((o: any) => {
      omap[o.id] = o;
      cmap[o.id] = rmap[o.region_id] || "SGD";
    });

    // 30-day daily totals per outlet (aggregated in memory from aggregated query)
    const { data: sales30 } = await sb
      .from("sales_transactions")
      .select("outlet_id, date, amount")
      .gte("date", t30);

    const dailyTotals: Record<number, Record<string, number>> = {};
    (sales30 || []).forEach((s: any) => {
      const fx = toSGD(cmap[s.outlet_id] || "SGD");
      const day = String(s.date).slice(0, 10);
      const amt = Number(s.amount || 0) * fx;
      if (!dailyTotals[s.outlet_id]) dailyTotals[s.outlet_id] = {};
      dailyTotals[s.outlet_id][day] = (dailyTotals[s.outlet_id][day] || 0) + amt;
    });

    // Today's transactions — FIX C1: date filter (was full table scan)
    const { data: todayRows } = await sb
      .from("sales_transactions")
      .select("outlet_id, amount")
      .eq("date", t0);

    const todayMap: Record<number, number> = {};
    (todayRows || []).forEach((t: any) => {
      const fx = toSGD(cmap[t.outlet_id] || "SGD");
      todayMap[t.outlet_id] = (todayMap[t.outlet_id] || 0) + Number(t.amount || 0) * fx;
    });

    let crit = 0, warn = 0, okCnt = 0;
    for (const [oid, daily] of Object.entries(dailyTotals)) {
      const vals = Object.values(daily as Record<string, number>);
      if (vals.length < 5) { okCnt++; continue; }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
      const std = Math.sqrt(variance);
      const tAmt = todayMap[Number(oid)] || 0;
      const z = std > 0 ? (tAmt - mean) / std : 0;
      const az = Math.abs(z);
      const st = az >= 2.5 ? "CRITICAL" : az >= 1.5 ? "WARNING" : "OK";
      if (st === "CRITICAL") crit++;
      else if (st === "WARNING") warn++;
      else okCnt++;
      const pct = st === "CRITICAL" ? 97 : st === "WARNING" ? 75 : 25;
      const outlet = omap[Number(oid)];
      const record = {
        outlet_id: Number(oid),
        anomaly_score: z,
        percentile: pct,
        is_anomaly: st === "CRITICAL",
        status: st,
        recorded_at: now.toISOString(),
      };
      sb.from("ml_anomaly_scores").upsert(record).catch(() => {});
      sb.from("ml_anomaly_scores").upsert(record).catch(() => {});
    }
    out.anomaly = { critical: crit, warning: warn, ok: okCnt };
  } catch (e) {
    out.anomaly = { error: String(e) };
  }

  // ── STEP 2: Stockout ─────────────────────────────────
  try {
    const { data: inventory } = await sb
      .from("inventory")
      .select("id, outlet_id, current_stock")
      .lt("current_stock", 25);

    const { data: recent7 } = await sb
      .from("sales_transactions")
      .select("outlet_id, transaction_count")
      .gte("date", t7);

    const tmap: Record<number, number> = {};
    (recent7 || []).forEach((t: any) => {
      tmap[t.outlet_id] = (tmap[t.outlet_id] || 0) + Number(t.transaction_count || 1);
    });

    let hi = 0, med = 0;
    (inventory || []).forEach((inv: any) => {
      const avg7 = (tmap[inv.outlet_id] || 0) / 7;
      const days = avg7 > 0 ? Number(inv.current_stock) / avg7 : 999;
      const risk = days < 7 ? "HIGH" : days < 14 ? "MEDIUM" : "LOW";
      if (risk === "HIGH") hi++;
      else if (risk === "MEDIUM") med++;
      sb.from("ml_stockout_risks").upsert({
        outlet_id: inv.outlet_id,
        risk_level: risk,
        days_remaining: Math.round(days),
        recorded_at: now.toISOString(),
      }).catch(() => {});
    });
    out.stockout = { high: hi, medium: med, checked: (inventory || []).length };
  } catch (e) {
    out.stockout = { error: String(e) };
  }

  // ── STEP 3: Alert creation ───────────────────────────────
  try {
    const { data: crits } = await sb
      .from("ml_anomaly_scores")
      .select("outlet_id, anomaly_score")
      .eq("status", "CRITICAL")
      .gte("recorded_at", t1h);

    let created = 0;
    for (const c of (crits || [])) {
      const dup = await sb
        .from("alerts").select("id")
        .eq("outlet_id", c.outlet_id)
        .eq("status", "NEW")
        .eq("type", "SALES_ANOMALY");
      if ((dup.data || []).length > 0) continue;
      const outlet = omap[c.outlet_id];
      await sb.from("alerts").insert({
        outlet_id: c.outlet_id,
        type: "SALES_ANOMALY",
        severity: "P0_CRITICAL",
        status: "NEW",
        title: `${outlet?.code || c.outlet_id} anomaly detected`,
        description: `z=${c.anomaly_score?.toFixed(2)}. Review immediately.`,
      }).catch(() => {});
      created++;
    }
    out.alerts = { created };
  } catch (e) {
    out.alerts = { error: String(e) };
  }

  // ── STEP 4: Agent log ─────────────────────────────────
  await sb.from("agent_tasks").insert({
    agent_id: "coordinator",
    task_type: "pipeline",
    description: "ML pipeline: anomaly + stockout + alerts",
    status: "completed",
    completed_at: now.toISOString(),
  }).catch(() => {});

  return new Response(JSON.stringify({
    success: true,
    timestamp: now.toISOString(),
    pipeline: out,
  }), { headers: { ...HEADERS, "Content-Type": "application/json" } });
});
