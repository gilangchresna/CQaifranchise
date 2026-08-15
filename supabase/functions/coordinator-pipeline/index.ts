/// <reference lib="deno.ns" />
/**
 * Coordinator Pipeline — AI Agent Orchestration
 * Runs every 15 min via pg_cron
 * 
 * Flow:
 *  1. Calculate z-score anomaly per outlet (30-day baseline vs today)
 *  2. Persist scores to ml_anomaly_scores table
 *  3. Check stockout risk per outlet
 *  4. Call alert-generator for CRITICAL/WARNING anomalies
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const sb = createClient(SB_URL, SB_KEY);

// FX rates to SGD
function toSGD(currency: string): number {
  if (currency === "SGD") return 1;
  if (currency === "IDR") return 1 / 12500;
  if (currency === "THB") return 1 / 27.5;
  if (currency === "MYR") return 1 / 3.4;
  return 1;
}

// Severity from z-score
function severityFromZ(z: number): { status: string; severity: string } {
  const az = Math.abs(z);
  if (az >= 2.5) return { status: "CRITICAL", severity: "P0_CRITICAL" };
  if (az >= 1.5) return { status: "WARNING", severity: "P1_HIGH" };
  return { status: "OK", severity: "P2_MEDIUM" };
}

// Call alert-generator edge function
async function createAlert(
  outletId: number,
  triggerType: "ANOMALY" | "STOCKOUT" | "MANUAL",
  currentSales?: number
): Promise<{ success: boolean; alert_id?: number; reason?: string }> {
  try {
    const res = await fetch(`${SB_URL}/functions/v1/alert-generator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SB_KEY}`,
        "apikey": SB_KEY,
      },
      body: JSON.stringify({
        outlet_id: outletId,
        trigger_type: triggerType,
        current_sales: currentSales,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, reason: err.reason || res.statusText };
    }
    return await res.json();
  } catch (e: any) {
    return { success: false, reason: e.message };
  }
}

// Insert alert directly (bypasses alert-generator's internal ML recalculation)
async function insertAlertDirect(
  outletId: number,
  alertType: string,
  severity: string,
  score: number,
  title: string,
  description: string
): Promise<{ success: boolean; alert_id?: number; reason?: string }> {
  try {
    const { data, error } = await sb.from("alerts").insert({
      outlet_id: outletId,
      type: alertType,
      severity,
      score,
      status: "NEW",
      title,
      description,
    }).select("id").single();

    if (error) return { success: false, reason: error.message };
    return { success: true, alert_id: data?.id };
  } catch (e: any) {
    return { success: false, reason: e.message };
  }
}

// Get outlet name for alert title
async function getOutletName(outletId: number): Promise<string> {
  const { data } = await sb.from("outlets").select("name").eq("id", outletId).single();
  return data?.name || `Outlet ${outletId}`;
}

// ── Workflow helpers ────────────────────────────────────────────────────────────

async function workflowCreate(name: string, payload: any, triggeredBy = "manual"): Promise<string | null> {
  try {
    const { data, error } = await sb.rpc("workflow_create", {
      p_workflow_name: name,
      p_payload: payload,
      p_triggered_by: triggeredBy,
    });
    if (error) { console.error("workflow_create error:", error); return null; }
    return data as string;
  } catch (e) {
    console.error("workflow_create exception:", e);
    return null;
  }
}

async function workflowUpdate(
  instanceId: string,
  status: string,
  step?: string,
  progress?: number,
  result?: any,
  errorDetail?: string,
) {
  try {
    await sb.rpc("workflow_update_status", {
      p_instance_id: instanceId,
      p_status: status,
      p_step: step ?? null,
      p_progress: progress ?? null,
      p_result: result ?? null,
      p_error: errorDetail ?? null,
    });
  } catch (e) {
    console.error("workflow_update_status error:", e);
  }
}

// ── Main pipeline ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: HEADERS });
  }

  const now = new Date();
  const t0 = now.toISOString().slice(0, 10); // today
  const t30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  let instanceId: string | null = null;
  let triggeredBy = "manual";

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.triggered_by) triggeredBy = body.triggered_by;
    instanceId = await workflowCreate("coordinator-pipeline", { date: t0 }, triggeredBy);
    if (instanceId) await workflowUpdate(instanceId, "running", "init", 5);
  } catch (_) {
    instanceId = await workflowCreate("coordinator-pipeline", { date: t0 }, triggeredBy);
    if (instanceId) await workflowUpdate(instanceId, "running", "init", 5);
  }

  const out: any = { errors: [] };
  const alertResults: any[] = [];

  try {
    // ── STEP 1: Anomaly Detection ───────────────────────────────────────────
    await workflowUpdate(instanceId, "running", "anomaly", 10);

    // Load regions + outlets
    const [{ data: regions }, { data: outlets }] = await Promise.all([
      sb.from("regions").select("id, currency_code"),
      sb.from("outlets").select("id, name, region_id"),
    ]);

    out.regions_count = (regions || []).length;
    out.outlets_count = (outlets || []).length;

    const rmap: Record<number, string> = {};
    (regions || []).forEach((r: any) => { rmap[r.id] = r.currency_code || "SGD"; });

    const cmap: Record<number, string> = {};
    (outlets || []).forEach((o: any) => { cmap[o.id] = rmap[o.region_id] || "SGD"; });

    // Load 30-day sales
    const { data: sales30, error: sErr } = await sb
      .from("sales_transactions")
      .select("outlet_id, date, amount")
      .gte("date", t30);
    out.sales30_count = (sales30 || []).length;

    if (sErr) throw new Error("sales30: " + sErr.message);

    // Aggregate daily totals (in SGD)
    const dailyTotals: Record<number, Record<string, number>> = {};
    (sales30 || []).forEach((s: any) => {
      const fx = toSGD(cmap[s.outlet_id] || "SGD");
      const day = String(s.date).slice(0, 10);
      const amt = Number(s.amount || 0) * fx;
      if (!dailyTotals[s.outlet_id]) dailyTotals[s.outlet_id] = {};
      dailyTotals[s.outlet_id][day] = (dailyTotals[s.outlet_id][day] || 0) + amt;
    });

    // Load today's sales
    const { data: todayRows } = await sb
      .from("sales_transactions")
      .select("outlet_id, amount")
      .eq("date", t0);
    out.today_count = (todayRows || []).length;

    const todayMap: Record<number, number> = {};
    (todayRows || []).forEach((t: any) => {
      const fx = toSGD(cmap[t.outlet_id] || "SGD");
      todayMap[t.outlet_id] = (todayMap[t.outlet_id] || 0) + Number(t.amount || 0) * fx;
    });

    // Score each outlet
    const scoreRecords: any[] = [];
    const anomalyOutlets: any[] = [];
    let crit = 0, warn = 0, okCnt = 0;

    for (const [oid, daily] of Object.entries(dailyTotals)) {
      const o = Number(oid);
      const vals = Object.values(daily as Record<string, number>);
      if (vals.length < 5) { okCnt++; continue; }

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
      const std = Math.sqrt(variance);
      const tAmt = todayMap[o] || 0;
      const z = std > 0 ? (tAmt - mean) / std : 0;
      const { status, severity } = severityFromZ(z);

      // Upsert ml_anomaly_scores
      scoreRecords.push({
        outlet_id: o,
        anomaly_score: z,
        percentile: Math.min(100, Math.round(Math.abs(z) * 30)),
        is_anomaly: status !== "OK",
        status: status,
        recorded_at: now.toISOString(),
      });

      if (status === "CRITICAL") { crit++; anomalyOutlets.push({ oid: o, status, severity, z, todayAmt: tAmt }); }
      else if (status === "WARNING") { warn++; anomalyOutlets.push({ oid: o, status, severity, z, todayAmt: tAmt }); }
      else { okCnt++; }
    }

    // Bulk upsert ml_anomaly_scores
    if (scoreRecords.length > 0) {
      for (const rec of scoreRecords) {
        await sb.from("ml_anomaly_scores").upsert(rec, { onConflict: "outlet_id" });
      }
    }

    out.anomaly = { critical: crit, warning: warn, ok: okCnt, scored: scoreRecords.length };
    out.anomaly_outlets = anomalyOutlets;

    // ── STEP 2: Stockout Risk ────────────────────────────────────────────────
    await workflowUpdate(instanceId, "running", "stockout", 40);

    const { data: inventory, error: invErr } = await sb
      .from("inventory")
      .select("id, outlet_id, current_stock")
      .lt("current_stock", 25);
    out.inventory_low_count = (inventory || []).length;
    out.stockout = { checked: (inventory || []).length };
    if (invErr) throw new Error("inventory: " + invErr.message);

    // ── STEP 3: Create Alerts ─────────────────────────────────────────────
    await workflowUpdate(instanceId, "running", "alerts", 70);

    let alertsCreated = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const item of anomalyOutlets) {
      const outletName = await getOutletName(item.oid);
      const title = `${item.severity.replace("_", " ")}: Sales Anomaly at ${outletName}`;
      const description = `Anomaly detected at ${outletName}.\n\nOutlet: ${outletName}\nZ-Score: ${item.z.toFixed(2)}\nStatus: ${item.status}\nToday's Revenue: S$${item.todayAmt.toFixed(2)}\n\nTriggered by: Coordinator Pipeline AI Agent\nDate: ${today}`;

      const r = await insertAlertDirect(
        item.oid,
        "SALES_ANOMALY",
        item.severity,
        Math.abs(item.z),
        title,
        description
      );
      alertResults.push({ outlet_id: item.oid, ...r });
      if (r.success) alertsCreated++;
    }

    // Stockout alerts
    const stockoutOutlets: number[] = [...new Set((inventory || []).map((i: any) => i.outlet_id))];
    for (const oid of stockoutOutlets) {
      const outletName = await getOutletName(Number(oid));
      const inv = (inventory || []).filter((i: any) => i.outlet_id === oid);
      const lowest = inv.reduce((min: number, i: any) => Math.min(min, i.current_stock), 999);
      const title = `STOCKOUT RISK: Low Stock Alert at ${outletName}`;
      const description = `Stockout risk detected at ${outletName}.\n\nOutlet: ${outletName}\nLowest Stock: ${lowest} units\nItems Below Threshold: ${inv.length}\n\nTriggered by: Coordinator Pipeline AI Agent\nDate: ${today}`;

      const r = await insertAlertDirect(
        Number(oid),
        "STOCKOUT_RISK",
        "P1_HIGH",
        0.7,
        title,
        description
      );
      alertResults.push({ outlet_id: oid, ...r });
      if (r.success) alertsCreated++;
    }

    out.alerts = { created: alertsCreated, details: alertResults.slice(0, 10) };

    await workflowUpdate(instanceId, "completed", "done", 100, out);

    return new Response(JSON.stringify({
      success: true,
      timestamp: now.toISOString(),
      pipeline: out,
      instance_id: instanceId,
    }), { headers: { ...HEADERS, "Content-Type": "application/json" } });

  } catch (e: any) {
    out.fatal = e.message;
    out.errors.push(e.message);
    if (instanceId) {
      await workflowUpdate(instanceId, "failed", "fatal", null, null, e.message);
    }
    return new Response(JSON.stringify({
      success: false,
      error: e.message,
      pipeline: out,
      instance_id: instanceId,
    }), { status: 500, headers: { ...HEADERS, "Content-Type": "application/json" } });
  }
});
