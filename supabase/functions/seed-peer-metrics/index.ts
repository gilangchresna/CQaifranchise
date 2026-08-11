// seed-peer-metrics ETL — aggregate sales_transactions → peer_metrics
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apabase_key, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sb = createClient(SB_URL, SB_KEY);

const FX = { SGD: 1, IDR: 1/12500, THB: 1/27.5, MYR: 1/3.4 };

function toSGD(rgn) { return FX[rgn] || 1; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "daily";

  // Find latest transaction date
  const { data: latestRows } = await sb
    .from("sales_transactions")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  const latestDate = latestRows && latestRows[0] ? latestRows[0].date : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startDate = latestDate;
  const endDate = latestDate;

  // Fetch regions
  const { data: regions } = await sb.from("regions").select("id, name, currency_code");
  const rgMap = {};
  (regions||[]).forEach(r => { rgMap[r.id] = r; });

  // Fetch outlets
  const { data: outlets } = await sb.from("outlets").select("id, code, name, region_id");
  const om = {};
  const rMap = {};
  (outlets||[]).forEach(o => {
    om[o.id] = o;
    rMap[o.id] = rgMap[o.region_id];
  });

  // Fetch transactions
  const { data: txns } = await sb
    .from("sales_transactions")
    .select("outlet_id, date, settlement_amount, payment_method")
    .gte("date", startDate)
    .lte("date", endDate);

  // Aggregate by outlet
  const agg = {};
  (txns||[]).forEach(t => {
    const oid = t.outlet_id;
    const rgn = rMap[oid];
    const fx = toSGD(rgn ? rgn.currency_code : "SGD");
    const rev = (Number(t.settlement_amount)||0) * fx;
    if (!agg[oid]) agg[oid] = { rev: 0, txns: 0 };
    agg[oid].rev += rev;
    agg[oid].txns += 1;
  });

  // Compute peer averages
  const peers = {};
  Object.entries(agg).forEach(([oid, a]) => {
    const rg = (rMap[oid]||{}).name||"Other";
    if (!peers[rg]) peers[rg] = [];
    peers[rg].push(a.rev);
  });
  const peerAvg = {};
  Object.entries(peers).forEach(([rg, vals]) => {
    const sum = vals.reduce((a,b) => a+b, 0);
    peerAvg[rg] = sum / vals.length;
  });

  // Build records
  const today = latestDate;
  const records = Object.entries(agg).map(([oid, a]) => {
    const rg = (rMap[oid]||{}).name||"Other";
    const pavg = peerAvg[rg]||1;
    const vs = pavg > 0 ? (a.rev - pavg) / pavg * 100 : 0;
    const score = Math.max(0, a.rev / pavg * 100);
    const isTop = vs >= 20;
    const isUnder = vs <= -20;
    return {
      outlet_id: Number(oid),
      metric_date: today,
      period_type: period,
      revenue: Math.round(a.rev * 100)/100,
      peer_region: rg,
      vs_peer_pct: Math.round(vs*100)/100,
      peer_score: Math.round(score),
      transactions: a.txns,
      avg_transaction: a.txns > 0 ? Math.round(a.rev/a.txns*100)/100 : 0,
      is_top_performer: isTop,
      is_under_performer: isUnder,
      computed_at: new Date().toISOString(),
    };
  });

  let upserted = 0;
  let upsertErr = null;
  if (records.length > 0) {
    const { error } = await sb
      .from("peer_metrics")
      .upsert(records, { onConflict: "outlet_id,metric_date,period_type" });
    if (error) upsertErr = error.message;
    else upserted = records.length;
  }

  const top = records.filter(r => r.is_top_performer).slice(0,5);
  const under = records.filter(r => r.is_under_performer).slice(0,5);

  return new Response(JSON.stringify({
    success: !upsertErr,
    date: today,
    period,
    transactions_processed: (txns||[]).length,
    outlets_computed: records.length,
    upserted,
    upsert_error: upsertErr,
    aggregates: { total: records.length, top_performers: top.length, under_performers: under.length },
    top_performers: top.map(r => ({
      outlet_id: r.outlet_id,
      outlet_code: (om[r.outlet_id]||{}).code,
      revenue: r.revenue,
      vs_peer_pct: r.vs_peer_pct,
      peer_score: r.peer_score,
    })),
    under_performers: under.map(r => ({
      outlet_id: r.outlet_id,
      outlet_code: (om[r.outlet_id]||{}).code,
      revenue: r.revenue,
      vs_peer_pct: r.vs_peer_pct,
    })),
  }), { headers: { ...HEADERS, "Content-Type": "application/json" } });
});
