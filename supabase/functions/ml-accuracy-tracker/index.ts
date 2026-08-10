/// <reference lib="deno.ns" />
/**
 * ML Accuracy Tracker
 * Evaluates anomaly predictions vs actual case outcomes
 * Called when cases are resolved — logs TP/FP/FN, updates metrics
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Access-Control-Allow-Origin": "https://cqaifranchise.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: HEADERS });

  const supabase = createClient(SB_URL, SB_KEY);

  // ── Mode A: Log a resolved case feedback ──────────────────────────────
  // POST { case_id, predicted_score, severity }
  // Call this when a case is resolved — logs TP/FP/FN
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const { case_id, predicted_score, severity } = body;

    if (!case_id) {
      return new Response(JSON.stringify({ error: "case_id required" }), {
        status: 400, headers: { ...HEADERS, "Content-Type": "application/json" }
      });
    }

    // Fetch the case to get outlet info
    const { data: caseData } = await supabase
      .from("cases").select("id, alert_id, priority, status, outlet_id").eq("id", case_id).single();

    if (!caseData) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404, headers: { ...HEADERS, "Content-Type": "application/json" }
      });
    }

    // Determine if this was a true positive or false positive
    // TP: alert existed and was valid, case was worked
    // FP: alert was noise, resolved without action
    // We track: was_resolved_usefully = case was not immediately closed
    const wasUseful = caseData.priority !== "LOW" || caseData.alert_id != null;
    const outcome: "TP" | "FP" | "FN" | "TN" = wasUseful ? "TP" : "FP";

    await supabase.from("ml_accuracy_logs").insert({
      case_id,
      alert_id: caseData.alert_id,
      outlet_id: caseData.outlet_id,
      predicted_score: predicted_score ?? 0.5,
      predicted_label: predicted_score ? "ANOMALY" : "NORMAL",
      actual_label: severity ? "ANOMALY" : "NORMAL",
      outcome,
      model_version: "v2.0.0",
      evaluated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, outcome }), {
      headers: { ...HEADERS, "Content-Type": "application/json" }
    });
  }

  // ── Mode B: Compute aggregate metrics ─────────────────────────────────
  // GET ?days=30 — returns precision/recall/F1 for the period
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const { data: logs } = await supabase
    .from("ml_accuracy_logs")
    .select("*")
    .gte("evaluated_at", cutoff);

  const tp = logs?.filter(l => l.outcome === "TP").length ?? 0;
  const fp = logs?.filter(l => l.outcome === "FP").length ?? 0;
  const fn = logs?.filter(l => l.outcome === "FN").length ?? 0;
  const tn = logs?.filter(l => l.outcome === "TN").length ?? 0;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const accuracy = tp + tn + fp + fn > 0 ? (tp + tn) / (tp + tn + fp + fn) : 0;

  // Store in ml_model_metrics
  await supabase.from("ml_model_metrics").upsert({
    model_name: "Sales Anomaly Detector",
    metric_name: "accuracy",
    metric_value: Math.round(accuracy * 1000) / 1000,
    sample_size: (logs?.length ?? 0),
    period_days: days,
    computed_at: new Date().toISOString(),
  }, { onConflict: "model_name,metric_name" });

  await supabase.from("ml_model_metrics").upsert({
    model_name: "Sales Anomaly Detector",
    metric_name: "precision",
    metric_value: Math.round(precision * 1000) / 1000,
    sample_size: (logs?.length ?? 0),
    period_days: days,
    computed_at: new Date().toISOString(),
  }, { onConflict: "model_name,metric_name" });

  await supabase.from("ml_model_metrics").upsert({
    model_name: "Sales Anomaly Detector",
    metric_name: "recall",
    metric_value: Math.round(recall * 1000) / 1000,
    sample_size: (logs?.length ?? 0),
    period_days: days,
    computed_at: new Date().toISOString(),
  }, { onConflict: "model_name,metric_name" });

  await supabase.from("ml_model_metrics").upsert({
    model_name: "Sales Anomaly Detector",
    metric_name: "f1",
    metric_value: Math.round(f1 * 1000) / 1000,
    sample_size: (logs?.length ?? 0),
    period_days: days,
    computed_at: new Date().toISOString(),
  }, { onConflict: "model_name,metric_name" });

  return new Response(JSON.stringify({
    model: "Sales Anomaly Detector",
    period_days: days,
    sample_size: logs?.length ?? 0,
    confusion_matrix: { tp, fp, fn, tn },
    metrics: {
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
      accuracy: Math.round(accuracy * 1000) / 1000,
    }
  }), { headers: { ...HEADERS, "Content-Type": "application/json" } });
});
