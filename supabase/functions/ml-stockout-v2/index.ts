/// <reference lib="deno.ns" />
/**
 * ML Stockout Risk v4
 * Reads real inventory + sales_transactions — no mock data
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-helper.ts";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: HEADERS });
  }

  // Allow internal calls (cron, scripts)
  const auth = await verifyAuth(req, true, true);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401, headers: HEADERS,
    });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // 1. Fetch all inventory items
    const { data: inventory } = await sb
      .from("inventory")
      .select("*")
      .order("current_stock", { ascending: true })
      .limit(50);

    if (!inventory || inventory.length === 0) {
      return new Response(JSON.stringify({ predictions: [], summary: { total: 0, critical: 0, avg_risk: 0 } }), { headers: HEADERS });
    }

    // 2. Get unique outlet IDs
    const outletIds: number[] = [];
    const seen = new Set<string>();
    for (const inv of inventory) {
      const oid = String(inv.outlet_id);
      if (!seen.has(oid)) {
        seen.add(oid);
        outletIds.push(Number(inv.outlet_id) || 0);
      }
    }
    if (outletIds.length === 0) outletIds.push(-1);

    // 3. Fetch 30 days sales for those outlets
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: sales } = await sb
      .from("sales_transactions")
      .select("outlet_id, transaction_count")
      .in("outlet_id", outletIds)
      .gte("date", since);

    // 4. Aggregate daily avg per outlet
    const totalByOutlet: Record<string, number> = {};
    const countByOutlet: Record<string, number> = {};
    for (const tx of (sales || [])) {
      const oid = String(tx.outlet_id);
      const amt = Number(tx.transaction_count || 0);
      totalByOutlet[oid] = (totalByOutlet[oid] || 0) + amt;
      countByOutlet[oid] = (countByOutlet[oid] || 0) + 1;
    }

    const velocity: Record<string, number> = {};
    for (const oid of Object.keys(totalByOutlet)) {
      const cnt = countByOutlet[oid] || 1;
      velocity[oid] = Math.round((totalByOutlet[oid] / cnt) * 10) / 10;
    }

    // FIX #6: Read stockout_threshold from settings table
    // stockout_threshold stored as "0.7" = 70% probability → risk >= 0.7 triggers HIGH/CRITICAL alert
    const { data: thresholdRows } = await sb
      .from("settings")
      .select("key, value")
      .in("key", ["stockout_threshold"]);

    let stockoutThreshold = 0.7; // default: 70%
    for (const r of thresholdRows || []) {
      if (r.key === "stockout_threshold") {
        stockoutThreshold = parseFloat(r.value) || 0.7;
      }
    }

    // Days → risk score: tunable boundaries based on stockout_threshold
    // stockout_threshold = alert cutoff probability → maps to HIGH boundary
    const RISK_HIGH = stockoutThreshold;         // e.g. 0.7 → HIGH if days <= 5 (risk=0.8)
    const RISK_CRITICAL = Math.min(1, stockoutThreshold * 1.2); // e.g. 0.84

    // 5. Predict risk per item
    const predictions = inventory.map((inv: any) => {
      const oid = String(inv.outlet_id);
      const vel = velocity[oid] || 0;
      const stock = Number(inv.current_stock) || 0;
      const min = Number(inv.min_stock) || 0;
      const max = Number(inv.max_stock) || 1;

      const days = vel > 0 ? Math.round(stock / vel) : 999;

      let risk = days <= 2 ? 1.0
        : days <= 5 ? 0.8
        : days <= 10 ? 0.5
        : days <= 20 ? 0.25
        : 0.05;
      if (stock < min) risk = 1.0;

      const level = risk >= RISK_CRITICAL ? "CRITICAL"
        : risk >= RISK_HIGH ? "HIGH"
        : risk >= 0.25 ? "MEDIUM"
        : "LOW";

      const reorder = Math.max(0, Math.round(min * 2 - stock));

      return {
        outlet_id: Number(inv.outlet_id),
        product_name: inv.product_name || inv.sku || "Unknown",
        sku: inv.sku || inv.id,
        current_stock: stock,
        min_stock: min,
        max_stock: max,
        velocity: vel,
        days_until_stockout: days === 999 ? null : days,
        risk_score: Math.round(risk * 100) / 100,
        risk_level: level,
        utilization_pct: Math.round((stock / max) * 100),
        recommended_order_qty: reorder,
        last_restock: inv.last_restock_at || null,
        updated_at: inv.updated_at || null,
      };
    });

    predictions.sort((a, b) => b.risk_score - a.risk_score);

    const critical = predictions.filter((p) => p.risk_level === "CRITICAL").length;
    const avgRisk = predictions.reduce((s, p) => s + p.risk_score, 0) / predictions.length;

    // ===== PERSIST ml_stockout_risk (per outlet) =====
    const outletRiskMap: Record<string, { worst_risk: number; worst_level: string; min_days: number | null }> = {};
    for (const p of predictions) {
      const oid = String(p.outlet_id);
      if (!outletRiskMap[oid] || p.risk_score > outletRiskMap[oid].worst_risk) {
        outletRiskMap[oid] = {
          worst_risk: p.risk_score,
          worst_level: p.risk_level,
          min_days: p.days_until_stockout,
        };
      }
    }

    const records = Object.entries(outletRiskMap).map(([oid, r]) => ({
      outlet_id: Number(oid),
      risk_level: r.worst_level,
      days_remaining: r.min_days,
      recorded_at: new Date().toISOString(),
    }));

    if (records.length > 0) {
      const { error: upsertError } = await sb
        .from("ml_stockout_risk")
        .upsert(records, { onConflict: "outlet_id" });
      if (upsertError) {
        console.error("Failed to persist ml_stockout_risk:", upsertError);
      } else {
        console.log(`Persisted stockout risk for ${records.length} outlets`);
      }
    }

    return new Response(JSON.stringify({
      predictions: predictions.slice(0, 20),
      persisted_outlets: records.length,
      summary: {
        total: predictions.length,
        critical,
        avg_risk_score: Math.round(avgRisk * 100) / 100,
        outlets_checked: outletIds.length,
        outlets_persisted: records.length,
        model: "ml-stockout-v4-real",
        features: ["velocity", "stock_level", "min_stock_ratio"],
      },
    }), { headers: HEADERS });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: HEADERS,
    });
  }
});
