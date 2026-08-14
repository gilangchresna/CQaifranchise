/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sb = createClient(SB_URL, SB_KEY);

function toSGD(currency) {
  if (currency === "SGD") return 1;
  if (currency === "IDR") return 1 / 12500;
  if (currency === "THB") return 1 / 27.5;
  if (currency === "MYR") return 1 / 3.4;
  return 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });

  const now = new Date();
  const t0 = now.toISOString().slice(0, 10);
  const t7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const t30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const t1h = new Date(now.getTime() - 3600000).toISOString();
  const out: any = { errors: [] };

  try {
    // STEP 1: Anomaly
    try {
      const { data: regions, error: rErr } = await sb.from("regions").select("id, currency_code");
      out.regions_count = (regions || []).length;
      if (rErr) throw new Error("regions: " + rErr.message);
      const rmap: any = {};
      (regions || []).forEach((r: any) => { rmap[r.id] = r.currency_code || "SGD"; });

      const { data: outlets, error: oErr } = await sb.from("outlets").select("id, name, region_id");
      out.outlets_count = (outlets || []).length;
      if (oErr) throw new Error("outlets: " + oErr.message);
      const cmap: any = {};
      (outlets || []).forEach((o: any) => { cmap[o.id] = rmap[o.region_id] || "SGD"; });

      const { data: sales30, error: sErr } = await sb
        .from("sales_transactions").select("outlet_id, date, amount").gte("date", t30);
      out.sales30_count = (sales30 || []).length;
      if (sErr) throw new Error("sales30: " + sErr.message);

      const dailyTotals: any = {};
      (sales30 || []).forEach((s: any) => {
        const fx = toSGD(cmap[s.outlet_id] || "SGD");
        const day = String(s.date).slice(0, 10);
        const amt = Number(s.amount || 0) * fx;
        if (!dailyTotals[s.outlet_id]) dailyTotals[s.outlet_id] = {};
        dailyTotals[s.outlet_id][day] = (dailyTotals[s.outlet_id][day] || 0) + amt;
      });

      const { data: todayRows, error: tErr } = await sb
        .from("sales_transactions").select("outlet_id, amount").eq("date", t0);
      out.today_count = (todayRows || []).length;
      if (tErr) throw new Error("todayRows: " + tErr.message);

      const todayMap: any = {};
      (todayRows || []).forEach((t: any) => {
        const fx = toSGD(cmap[t.outlet_id] || "SGD");
        todayMap[t.outlet_id] = (todayMap[t.outlet_id] || 0) + Number(t.amount || 0) * fx;
      });

      let crit = 0, warn = 0, okCnt = 0;
      for (const [oid, daily] of Object.entries(dailyTotals)) {
        const vals = Object.values(daily as any) as number[];
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
      }
      out.anomaly = { critical: crit, warning: warn, ok: okCnt };
    } catch (e: any) {
      out.anomaly = { error: e.message };
      out.errors.push("anomaly: " + e.message);
    }

    // STEP 2: Stockout (skip if table empty)
    try {
      const { data: inventory, error: invErr } = await sb
        .from("inventory").select("id, outlet_id, current_stock").lt("current_stock", 25);
      out.inventory_low_count = (inventory || []).length;
      out.stockout = { checked: (inventory || []).length };
    } catch (e: any) {
      out.stockout = { error: e.message };
    }

    // STEP 3: Alert creation
    try {
      const { data: crits } = await sb
        .from("ml_anomaly_scores").select("outlet_id, anomaly_score")
        .eq("status", "CRITICAL").gte("recorded_at", t1h);
      out.alerts = { crit_count: (crits || []).length };
    } catch (e: any) {
      out.alerts = { error: e.message };
    }

  } catch (e: any) {
    out.fatal = e.message;
    out.errors.push(e.message);
  }

  return new Response(JSON.stringify({
    success: true,
    timestamp: now.toISOString(),
    pipeline: out,
  }), { headers: { ...HEADERS, "Content-Type": "application/json" } });
});
